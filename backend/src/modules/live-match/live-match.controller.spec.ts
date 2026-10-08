import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { LiveMatchController } from './live-match.controller';
import { LiveMatchService } from './live-match.service';

describe('LiveMatchController GET /live-match/current', () => {
  let app: INestApplication;
  const getCurrent = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveMatchController],
      providers: [{ provide: LiveMatchService, useValue: { getCurrent } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('répond 200 avec le JSON `null` (jamais un corps vide) hors fenêtre de match', async () => {
    getCurrent.mockResolvedValue(null);
    const res = await request(app.getHttpServer()).get('/live-match/current').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.text).toBe('null');
  });

  it('renvoie le match courant tel quel', async () => {
    getCurrent.mockResolvedValue({ gameId: 1 });
    const res = await request(app.getHttpServer()).get('/live-match/current').expect(200);
    expect(res.body).toEqual({ gameId: 1 });
  });
});
