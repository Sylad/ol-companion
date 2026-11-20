import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_USER_AGENT, APP_VERSION, outboundHeaders } from './outbound-http';
import { scores365Headers } from './scores365-http';
import { FixturesService } from '../modules/fixtures/fixtures.service';
import { NewsService } from '../modules/news/news.service';
import { WikiImageService } from '../modules/wiki-image/wiki-image.service';
import { EventBusService } from '../modules/events/event-bus.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));

/**
 * L267 — aucune requête sortante ne porte d'en-tête imité : l'app se nomme
 * (`ol-companion/<version> (+https://ol.sladoire.dev)`), jamais un navigateur,
 * et n'envoie ni `Referer`, ni `Origin`, ni `X-Domain` qui la ferait passer
 * pour le site d'une source. Les services 365scores sont déroulés pour de bon
 * dans `scores365-host.spec.ts` ; ici football-data, Wikipédia et les flux RSS,
 * plus une garde sur les sources de tout `backend/src`.
 */

const SRC = path.resolve(__dirname, '..');
const IMITATED = ['referer', 'origin', 'x-domain'];
const BROWSER_UA = /Mozilla\/|AppleWebKit|Chrome\/\d|Safari\/|Gecko\//;

/** Vérifie qu'un jeu d'en-têtes est honnête ; rend la liste des écarts. */
function honestHeaderViolations(init: RequestInit | undefined): string[] {
  const h = new Headers(init?.headers);
  const out: string[] = [];
  if (h.get('user-agent') !== APP_USER_AGENT) out.push(`User-Agent=${h.get('user-agent')}`);
  for (const name of IMITATED) if (h.has(name)) out.push(`${name}=${h.get(name)}`);
  for (const [name, value] of h) if (BROWSER_UA.test(value)) out.push(`${name}=${value}`);
  return out;
}

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSources(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

describe("L267 — l'app se présente sous son vrai nom", () => {
  it('User-Agent « ol-companion/<version du backend> (+https://ol.sladoire.dev) »', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(SRC, '../package.json'), 'utf-8')) as {
      version: string;
    };
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_USER_AGENT).toBe(`ol-companion/${pkg.version} (+https://ol.sladoire.dev)`);
    expect(outboundHeaders()).toEqual({ 'User-Agent': APP_USER_AGENT });
  });

  it('365scores : nom de l\'app, JSON en français, et rien d\'imité', () => {
    expect(scores365Headers()).toEqual({
      'User-Agent': APP_USER_AGENT,
      'Accept': 'application/json',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    });
    expect(honestHeaderViolations({ headers: scores365Headers() })).toEqual([]);
  });

  it('garde sur les sources : aucun en-tête imité ni User-Agent de navigateur dans backend/src', () => {
    const found: string[] = [];
    for (const file of listSources(SRC)) {
      const rel = path.relative(SRC, file);
      fs.readFileSync(file, 'utf-8')
        .split('\n')
        .forEach((line, i) => {
          if (/^\s*(\*|\/\/)/.test(line)) return; // commentaires
          // clé citée (toute casse) ou clé nue capitalisée ; `origin:` de CORS n'est pas un en-tête sortant
          if (/['"`](Referer|Origin|X-Domain)['"`]\s*:|\b(Referer|Origin)\s*:/.test(line) || /['"`](referer|origin|x-domain)['"`]\s*:/i.test(line)) found.push(`${rel}:${i + 1} ${line.trim()}`);
          if (BROWSER_UA.test(line)) found.push(`${rel}:${i + 1} ${line.trim()}`);
          if (/['"`]User-Agent['"`]\s*:/i.test(line) && rel !== 'config/outbound-http.ts') {
            found.push(`${rel}:${i + 1} ${line.trim()} (User-Agent hors outbound-http.ts)`);
          }
        });
    }
    expect(found).toEqual([]);
  });

  describe('garde sur le comportement : football-data, Wikipédia, flux RSS', () => {
    const realFetch = globalThis.fetch;
    let calls: { url: string; init?: RequestInit }[] = [];
    let previousCwd: string;
    let tmpDir: string;

    beforeAll(() => {
      Logger.overrideLogger(false);
      previousCwd = process.cwd();
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-outbound-'));
      fs.mkdirSync(path.join(tmpDir, 'data'));
      process.chdir(tmpDir);
    });
    afterAll(() => {
      process.chdir(previousCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);
    });
    beforeEach(() => {
      calls = [];
      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        const url = String(input);
        const body = url.includes('football-data')
          ? { matches: [] }
          : url.includes('wikipedia')
            ? { query: { pages: {}, search: [] } }
            : null;
        return body
          ? new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
          : new Response('<rss><channel></channel></rss>', { status: 200 });
      }) as typeof fetch;
    });
    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    function expectHonest(minCalls: number): void {
      expect(calls.length).toBeGreaterThanOrEqual(minCalls);
      expect(calls.map((c) => ({ url: c.url, ecarts: honestHeaderViolations(c.init) }))
        .filter((c) => c.ecarts.length > 0)).toEqual([]);
    }

    it('football-data : clé d\'API et nom de l\'app, rien d\'autre', async () => {
      const config = { get: () => 'test-key' } as unknown as ConfigService;
      await new FixturesService(config, new EventBusService()).getFixtures({ force: true });
      expectHonest(2);
      for (const c of calls) expect(new Headers(c.init?.headers).get('x-auth-token')).toBe('test-key');
    });

    it('Wikipédia FR', async () => {
      await new WikiImageService().getImage('Groupama Stadium L267');
      expectHonest(2);
    });

    it('flux RSS des actualités', async () => {
      await new NewsService().getNews({ force: true });
      expectHonest(1);
    });
  });
});
