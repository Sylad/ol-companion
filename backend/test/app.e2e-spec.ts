/* eslint-disable @typescript-eslint/no-require-imports */
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// Pas exporté par l'index du paquet : c'est lui qui monte crons, intervalles
// et timeouts au démarrage (onApplicationBootstrap).
import { SchedulerOrchestrator } from '@nestjs/schedule/dist/scheduler.orchestrator';
import { SchedulerRegistry } from '@nestjs/schedule';
import request from 'supertest';
import { App } from 'supertest/types';

/**
 * L18 — e2e hermétique : démarre TOUT l'AppModule et interroge /api/health.
 *
 * - Aucun appel réseau sortant : `fetch` global remplacé par un stub qui
 *   rejette, et `net.Socket.prototype.connect` refuse toute connexion TCP
 *   hors boucle locale (couvre http/https, axios, undici, tls). Chaque
 *   tentative est consignée et fait échouer le test.
 * - Caches : tous les services écrivent sous `process.cwd()/data` (parfois
 *   dans des constantes de module) → on se place dans un dossier temporaire
 *   AVANT de charger l'AppModule ; backend/data/ n'est jamais réécrit.
 * - Tâches planifiées : SchedulerOrchestrator remplacé par un orchestrateur
 *   inerte (aucun @Cron monté). Rafraîchissements au démarrage : le
 *   onModuleInit des services qui interrogent une source externe est
 *   neutralisé. Tout se fait côté test, sans toucher au code de prod ; un
 *   nouveau service qui rafraîchit au démarrage sans être listé ici fera
 *   échouer le test « aucun appel réseau sortant ».
 */

/** Services dont onModuleInit lance un appel réseau (src/modules/…). */
const STARTUP_REFRESHERS = [
  ['fixtures/fixtures.service', 'FixturesService'],
  ['season-matches/season-matches.service', 'SeasonMatchesService'],
  ['standings/standings.service', 'StandingsService'],
  ['news/news.service', 'NewsService'],
  ['cups/cups.service', 'CupsService'],
  ['lineup/lineup.service', 'LineupService'],
  ['live-match/live-match.service', 'LiveMatchService'],
] as const;

const inertScheduler: Partial<Record<keyof SchedulerOrchestrator, () => void>> =
  {
    onApplicationBootstrap: () => {},
    onApplicationShutdown: () => {},
    addCron: () => {},
    addInterval: () => {},
    addTimeout: () => {},
  };

const BACKEND_DATA = path.resolve(__dirname, '..', 'data');

const outbound: string[] = [];
const realFetch = globalThis.fetch;
// Référence brute volontaire : réappliquée plus bas avec le bon `this`.
// eslint-disable-next-line @typescript-eslint/unbound-method
const realConnect = net.Socket.prototype.connect;

function isLoopback(host: string | undefined): boolean {
  return (
    !host ||
    host === 'localhost' ||
    host === '::1' ||
    host === '::' ||
    host === '::ffff:127.0.0.1' ||
    host.startsWith('127.')
  );
}

function installNetworkGuard(): void {
  globalThis.fetch = (input: unknown) => {
    const url =
      typeof input === 'object' && input !== null && 'url' in input
        ? String((input as { url: string }).url)
        : String(input);
    outbound.push(`fetch ${url}`);
    return Promise.reject(
      new Error(`e2e : appel réseau sortant interdit (${url})`),
    );
  };

  net.Socket.prototype.connect = function (
    this: net.Socket,
    ...args: unknown[]
  ) {
    // net.connect() passe un tableau normalisé [options, cb].
    const first = Array.isArray(args[0]) ? (args[0] as unknown[])[0] : args[0];
    let host: string | undefined;
    if (typeof first === 'object' && first !== null) {
      const opts = first as { host?: string; path?: string };
      if (opts.path) return realConnect.apply(this, args as never); // IPC
      host = opts.host;
    } else if (typeof first === 'string' && Number.isNaN(Number(first))) {
      return realConnect.apply(this, args as never); // IPC
    } else if (typeof args[1] === 'string') {
      host = args[1];
    }
    if (isLoopback(host)) return realConnect.apply(this, args as never);
    outbound.push(`socket ${host}`);
    process.nextTick(() =>
      this.destroy(new Error(`e2e : connexion sortante interdite (${host})`)),
    );
    return this;
  };
}

function restoreNetwork(): void {
  globalThis.fetch = realFetch;
  net.Socket.prototype.connect = realConnect;
}

function snapshotMtimes(dir: string): Record<string, number> {
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(
    fs
      .readdirSync(dir)
      .map((f) => [f, fs.statSync(path.join(dir, f)).mtimeMs] as const),
  );
}

describe('AppModule (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let tmpDir: string;
  let previousCwd: string;
  let backendDataBefore: Record<string, number>;

  beforeAll(async () => {
    backendDataBefore = snapshotMtimes(BACKEND_DATA);
    installNetworkGuard();

    previousCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-e2e-'));
    fs.mkdirSync(path.join(tmpDir, 'data'));
    process.chdir(tmpDir);

    // Chargé APRÈS le chdir : les chemins de cache sont résolus au chargement.
    const { AppModule } = require('../src/app.module') as {
      AppModule: new () => unknown;
    };

    for (const [file, name] of STARTUP_REFRESHERS) {
      const mod = require(`../src/modules/${file}`) as Record<
        string,
        { prototype: { onModuleInit: () => void } }
      >;
      jest
        .spyOn(mod[name].prototype, 'onModuleInit')
        .mockImplementation(() => {});
    }

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SchedulerOrchestrator)
      .useValue(inertScheduler)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // comme main.ts
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    restoreNetwork();
    jest.restoreAllMocks();
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /api/health → 200 { status: "ok" }', async () => {
    await request(app!.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('garde-fou du test lui-même : fetch et sockets sortants sont bloqués', async () => {
    const before = outbound.length;
    await expect(fetch('https://example.invalid/x')).rejects.toThrow(
      /sortant interdit/,
    );
    await expect(
      new Promise((resolve, reject) =>
        https.get('https://example.invalid/y', resolve).on('error', reject),
      ),
    ).rejects.toThrow(/sortante interdite/);
    expect(outbound.slice(before)).toEqual([
      'fetch https://example.invalid/x',
      'socket example.invalid',
    ]);
    outbound.splice(before);
  });

  it('ne monte aucune tâche planifiée', () => {
    const registry = app!.get(SchedulerRegistry);
    expect(registry.getCronJobs().size).toBe(0);
    expect(registry.getIntervals()).toEqual([]);
    expect(registry.getTimeouts()).toEqual([]);
  });

  it("n'émet aucun appel réseau sortant", async () => {
    // Laisse s'exécuter ce qui aurait été lancé au démarrage.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(outbound).toEqual([]);
  });

  it('ne réécrit pas backend/data/', () => {
    expect(snapshotMtimes(BACKEND_DATA)).toEqual(backendDataBefore);
  });
});
