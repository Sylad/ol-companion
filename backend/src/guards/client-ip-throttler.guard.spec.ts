import 'reflect-metadata';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import {
  ClientIpThrottlerGuard,
  clientTracker,
} from './client-ip-throttler.guard';

/**
 * L16 : derrière le tunnel Cloudflare puis le nginx du frontend, `req.ip`
 * vaut l'IP du nginx pour TOUS les visiteurs → quota partagé. Le tracker
 * doit être l'IP réelle transmise par Cloudflare (CF-Connecting-IP, que le
 * nginx pose lui-même), avec repli sur req.ip (dev local).
 */
describe('clientTracker', () => {
  it('prend CF-Connecting-IP quand il est présent', () => {
    expect(
      clientTracker({
        ip: '10.42.0.7',
        headers: { 'cf-connecting-ip': '203.0.113.9' },
      }),
    ).toBe('203.0.113.9');
  });

  it('retire les espaces autour d’une IPv6', () => {
    expect(
      clientTracker({
        ip: '10.42.0.7',
        headers: { 'cf-connecting-ip': ' 2001:db8::1 ' },
      }),
    ).toBe('2001:db8::/64');
  });

  it('se replie sur req.ip sans en-tête (dev local)', () => {
    expect(clientTracker({ ip: '127.0.0.1', headers: {} })).toBe('127.0.0.1');
  });

  it('se replie sur req.ip si l’en-tête est vide ou n’est pas une IP', () => {
    expect(
      clientTracker({ ip: '10.42.0.7', headers: { 'cf-connecting-ip': '' } }),
    ).toBe('10.42.0.7');
    expect(
      clientTracker({
        ip: '10.42.0.7',
        headers: { 'cf-connecting-ip': 'pas-une-ip' },
      }),
    ).toBe('10.42.0.7');
  });

  it('ignore X-Forwarded-For (forgeable, trust proxy non activé)', () => {
    expect(
      clientTracker({
        ip: '10.42.0.7',
        headers: { 'x-forwarded-for': '198.51.100.1' },
      }),
    ).toBe('10.42.0.7');
  });

  it('prend la première valeur si l’en-tête arrive en tableau', () => {
    expect(
      clientTracker({
        ip: '10.42.0.7',
        headers: { 'cf-connecting-ip': ['203.0.113.9', '1.2.3.4'] },
      }),
    ).toBe('203.0.113.9');
  });
});

/**
 * L19 : un visiteur IPv6 reçoit un /64 entier et change d'adresse à volonté
 * (adresses temporaires) : tracker l'adresse complète lui donnerait un
 * quota neuf à chaque changement. Le tracker d'une IPv6 est son préfixe /64.
 */
describe('clientTracker — IPv6 au /64 (L19)', () => {
  const tracker = (ip: string) =>
    clientTracker({ ip: '10.42.0.7', headers: { 'cf-connecting-ip': ip } });

  it('deux adresses du même /64 ont le même tracker', () => {
    expect(tracker('2001:db8:1:2::1')).toBe(
      tracker('2001:db8:1:2:a1b2:c3d4:e5f6:7788'),
    );
    expect(tracker('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
  });

  it('deux /64 voisins ont des trackers différents', () => {
    expect(tracker('2001:db8:1:2::1')).not.toBe(tracker('2001:db8:1:3::1'));
  });

  it('écriture compressée ou développée, casse : même tracker', () => {
    expect(tracker('2001:DB8:0:0:0:0:0:1')).toBe('2001:db8::/64');
    expect(tracker('2001:db8::1')).toBe('2001:db8::/64');
    expect(tracker('::1')).toBe('::/64');
  });

  it('une IPv4 reste telle quelle, une IPv4 mappée redevient une IPv4', () => {
    expect(tracker('203.0.113.9')).toBe('203.0.113.9');
    expect(tracker('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(tracker('::ffff:cb00:7109')).toBe('203.0.113.9');
  });

  it('le repli sur req.ip applique aussi le /64', () => {
    expect(clientTracker({ ip: '2001:db8:1:2::5', headers: {} })).toBe(
      '2001:db8:1:2::/64',
    );
    expect(clientTracker({ ip: '::ffff:127.0.0.1', headers: {} })).toBe(
      '127.0.0.1',
    );
  });

  it('un identifiant de zone est ignoré', () => {
    expect(tracker('fe80::1%eth0')).toBe('fe80::/64');
  });
});

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return 'ok';
  }
}

describe('ClientIpThrottlerGuard — un quota par visiteur', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'short', ttl: 60_000, limit: 2 }]),
      ],
      controllers: [PingController],
      providers: [{ provide: APP_GUARD, useClass: ClientIpThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deux visiteurs derrière le même nginx ont chacun leur quota', async () => {
    const server: App = app.getHttpServer();
    const hit = (ip: string) =>
      request(server).get('/ping').set('CF-Connecting-IP', ip);

    expect((await hit('203.0.113.1')).status).toBe(200);
    expect((await hit('203.0.113.1')).status).toBe(200);
    expect((await hit('203.0.113.1')).status).toBe(429);
    // Même IP réseau (celle du nginx), autre visiteur : pas bloqué.
    expect((await hit('203.0.113.2')).status).toBe(200);
  });

  it('L19 — changer d’adresse dans son /64 ne redonne pas de quota', async () => {
    const server: App = app.getHttpServer();
    const hit = (ip: string) =>
      request(server).get('/ping').set('CF-Connecting-IP', ip);

    expect((await hit('2001:db8:aa:1::1')).status).toBe(200);
    expect((await hit('2001:db8:aa:1::2')).status).toBe(200);
    expect((await hit('2001:db8:aa:1:dead:beef:0:3')).status).toBe(429);
    // Autre /64 : autre visiteur.
    expect((await hit('2001:db8:aa:2::1')).status).toBe(200);
  });
});

describe('AppModule — garde de limite de débit (L16)', () => {
  it('enregistre ClientIpThrottlerGuard comme APP_GUARD', () => {
    const providers = (Reflect.getMetadata('providers', AppModule) ??
      []) as Array<{
      provide?: unknown;
      useClass?: unknown;
    }>;
    const guards = providers
      .filter((p) => p.provide === APP_GUARD)
      .map((p) => p.useClass);
    expect(guards).toContain(ClientIpThrottlerGuard);
  });
});
