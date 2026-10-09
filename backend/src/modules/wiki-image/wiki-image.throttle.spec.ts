import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { ClientIpThrottlerGuard } from '../../guards/client-ip-throttler.guard';
import { THROTTLERS } from '../../config/throttlers';
import { WikiImageController } from './wiki-image.controller';
import { WikiImageService } from './wiki-image.service';

/**
 * L32 : un visiteur ordinaire qui ouvre /standings déclenche une rafale de
 * ~26 appels /api en 250 ms dont une vingtaine de logos ; la limite globale
 * (10 par seconde) en refusait 12. wiki-image répond depuis un cache serveur :
 * sa limite est plus large que celle des endpoints qui sortent vers 365scores.
 */
describe('/api/wiki-image — limite de débit (L32)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(THROTTLERS)],
      controllers: [WikiImageController],
      providers: [
        { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
        {
          provide: WikiImageService,
          useValue: { getImage: async () => ({ imageUrl: null, pageTitle: null, pageUrl: null }) },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepte une rafale de 40 logos d’un même visiteur sans 429', async () => {
    const server: App = app.getHttpServer();
    const statuses = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        request(server)
          .get(`/wiki-image?q=club-${i}`)
          .set('CF-Connecting-IP', '203.0.113.50')
          .then((r) => r.status),
      ),
    );
    expect(statuses.filter((s) => s === 429)).toHaveLength(0);
  });

  it('reste bornée : un visiteur qui martèle finit refusé', async () => {
    const server: App = app.getHttpServer();
    const statuses: number[] = [];
    for (let i = 0; i < 400; i++) {
      statuses.push(
        (await request(server).get(`/wiki-image?q=x-${i}`).set('CF-Connecting-IP', '203.0.113.51')).status,
      );
    }
    expect(statuses).toContain(429);
  });
});
