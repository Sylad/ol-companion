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

  it('accepte une IPv6 et retire les espaces', () => {
    expect(
      clientTracker({
        ip: '10.42.0.7',
        headers: { 'cf-connecting-ip': ' 2001:db8::1 ' },
      }),
    ).toBe('2001:db8::1');
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
