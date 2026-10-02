// @vitest-environment node
// L23 — générateur des données publiques de la page « Plan de travail » (modèle
// finance-tracker L48) et preuve qu'aucun texte privé du plan (notes, verdicts UX,
// titres bruts) n'atteint le JSON publié ni le bundle construit.
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildPlan,
  checkPublicTitle,
  findLeaks,
  isDenied,
  isProcessLot,
  privateTexts,
  readNewsTitles,
  readPlan,
  renderPlan,
  scanDir,
} from './plan-data.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const RAF = `${root}/docs/plan/raf.yaml`;
const NEWS = `${root}/docs/nouveautes`;
const PLAN_JSON = `${root}/frontend/public/plan-data/plan.json`;
const DIST = `${root}/frontend/dist`;

const raf = {
  version: 1,
  project: 'demo',
  prefix: 'L',
  lots: [
    {
      id: 'L1',
      title: 'Page publique (route /x, localStorage)',
      public: 'Une page publique',
      status: 'done',
      visible: true,
      estimate: 0.5,
      quickwin: true,
      created: '2026-09-01',
      started: '2026-09-02',
      finished: '2026-09-03',
      ux: { date: '2026-09-03', verdict: 'conforme après reprise du contraste' },
      notes: [{ date: '2026-09-02', text: 'note privée : 1234 € sur le compte joint' }],
      tasks: [
        { id: 't1', title: 'Contraste fg-dim', public: 'Textes plus contrastés', status: 'done', notes: [{ date: '2026-09-02', text: 'sous-tâche : remarque privée' }] },
        { id: 't2', title: 'Clavier (tabindex)', status: 'todo', sha: 'abc1234' },
      ],
    },
    { id: 'L2', title: 'Correctif interne', public: 'Interne', status: 'done', started: '2026-09-02', finished: '2026-09-02' },
    { id: 'L3', title: 'Lot visible: false', status: 'todo', visible: false },
    { id: 'L4', title: 'Nouvelle page (titre brut)', status: 'doing', visible: true, started: '2026-09-04' },
    { id: 'L5', title: 'Prévu sans titre public ni Nouveauté', status: 'todo', visible: true },
    { id: 'L6', title: 'Abandonné', public: 'Abandonné', status: 'dropped', visible: true, finished: '2026-09-04', reason: 'raison privée de l’abandon' },
    { id: 'L7', title: 'État inconnu', public: 'Inconnu', status: 'blocked', visible: true },
    { id: 'L8', title: 'Corriger une faille de sécurité', public: 'Plus robuste', status: 'done', visible: true },
    { id: 'L9', title: 'Écran X', public: 'Écran X', status: 'todo', visible: true, tasks: [{ id: 't1', title: 'Le PIN se lit en clair', public: 'Saisie masquée', status: 'todo' }] },
    { id: 'L10', title: 'Revue UX — Écran Y', status: 'done', visible: true, finished: '2026-09-05' },
    { id: 'L11', title: 'Revue UX — Écran Z', public: 'Un écran Z plus lisible', status: 'todo', visible: true },
  ],
};
// L4 et L10 ont une entrée Nouveautés ; L10 est un lot de processus (revue UX) sans `public:`.
const news = new Map([['L4', 'Une nouvelle page'], ['L10', 'Écran Y revu']]);

describe('buildPlan', () => {
  const plan = buildPlan(raf, { newsTitles: news });

  it('publie les lots visibles ayant un titre public (public: puis Nouveauté), hors processus sans public:, liste noire et états inconnus', () => {
    expect(plan.lots.map((l) => l.id)).toEqual(['L1', 'L4', 'L9', 'L11']);
  });

  it('ne garde que id, titre public, état, dates et sous-tâches (titre public éventuel, état)', () => {
    expect(plan).toEqual({
      version: 1,
      project: 'demo',
      lots: [
        {
          id: 'L1',
          title: 'Une page publique',
          status: 'done',
          started: '2026-09-02',
          finished: '2026-09-03',
          tasks: [{ title: 'Textes plus contrastés', status: 'done' }, { status: 'todo' }],
        },
        { id: 'L4', title: 'Une nouvelle page', status: 'doing', started: '2026-09-04' },
        { id: 'L9', title: 'Écran X', status: 'todo' },
        { id: 'L11', title: 'Un écran Z plus lisible', status: 'todo' },
      ],
    });
  });

  it('refuse un titre public non conforme (chemin, technique, identifiant, > 80 caractères)', () => {
    const one = (pub) => ({ project: 'x', lots: [{ id: 'L1', title: 'A', public: pub, status: 'todo', visible: true }] });
    for (const bad of ['Route /plan', 'Plan depuis raf.yaml', 'Pastille en localStorage', 'Suite de L12', 'x'.repeat(81)]) {
      expect(() => buildPlan(one(bad))).toThrow(/titre public/);
    }
    expect(() => buildPlan(one('y'.repeat(80)))).not.toThrow();
  });

  it('accepte les dates déjà converties en Date par un autre lecteur YAML', () => {
    const p = buildPlan({ project: 'x', lots: [{ id: 'L1', title: 'A', public: 'A', status: 'doing', visible: true, started: new Date('2026-09-04T00:00:00Z') }] });
    expect(p.lots[0].started).toBe('2026-09-04');
  });

  it('refuse un plan sans liste de lots', () => {
    expect(() => buildPlan({ project: 'x' })).toThrow(/lots/);
  });
});

describe('textes privés et fuites', () => {
  const plan = buildPlan(raf, { newsTitles: news });
  const json = renderPlan(plan);

  it('privateTexts : notes (lots et sous-tâches), verdicts UX, raisons, titres bruts — jamais un titre publié', () => {
    const texts = privateTexts(raf, plan);
    for (const t of [
      'note privée : 1234 € sur le compte joint',
      'sous-tâche : remarque privée',
      'conforme après reprise du contraste',
      'raison privée de l’abandon',
      'Page publique (route /x, localStorage)',
      'Nouvelle page (titre brut)',
      'Le PIN se lit en clair',
    ]) {
      expect(texts).toContain(t);
    }
    // « Écran X » est à la fois titre brut et titre public de L9 : publié, donc pas privé.
    expect(texts).not.toContain('Écran X');
  });

  it('le JSON publié ne contient aucun texte privé', () => {
    expect(findLeaks(raf, json, plan)).toEqual([]);
    for (const leak of ['PIN', 'Saisie', 'note', 'privé', '1234', 'abc1234', 'estimate', 'quickwin', 'conforme', 'created', 'Revue UX']) {
      expect(json).not.toContain(leak);
    }
  });

  it('findLeaks repère une note recopiée telle quelle ou échappée façon JSON / JS', () => {
    const note = 'note privée : 1234 € sur le compte joint';
    expect(findLeaks(raf, `bundle ${note} fin`, plan)).toEqual([note]);
    expect(findLeaks(raf, `x=${JSON.stringify(note).replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}`, plan)).toEqual([note]);
  });

  it('scanDir parcourt un dossier construit et nomme le fichier fautif', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plan-dist-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    writeFileSync(join(dir, 'assets', 'app.js'), 'const a = "rien";');
    expect(scanDir(raf, plan, dir)).toEqual([]);
    writeFileSync(join(dir, 'assets', 'plan.js'), 'const n = "sous-tâche : remarque privée";');
    expect(scanDir(raf, plan, dir)).toEqual([{ file: join('assets', 'plan.js'), text: 'sous-tâche : remarque privée' }]);
  });
});

describe('checkPublicTitle', () => {
  it.each(['a/b', 'raf.yaml', 'localStorage', 'voir L48', 'z'.repeat(81), ''])('rejette « %s »', (t) => {
    expect(() => checkPublicTitle(t, 'L1')).toThrow(/titre public/);
  });
});

describe('isProcessLot', () => {
  it('reconnaît les revues UX', () => {
    expect(isProcessLot({ title: 'Revue UX — Accueil' })).toBe(true);
    expect(isProcessLot({ title: 'Page Nouveautés' })).toBe(false);
  });
});

describe('readNewsTitles', () => {
  it('lit le titre de la Nouveauté la plus récente de chaque lot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'news-'));
    writeFileSync(join(dir, '2026-09-01-a.md'), '---\ntitle: "Ancien titre"\ndate: 2026-09-01\nlots: [L1, L2]\n---\nTexte.\n');
    writeFileSync(join(dir, '2026-09-10-b.md'), '---\ntitle: Nouveau titre\ndate: 2026-09-10\nlots: [L1]\n---\nTexte.\n');
    writeFileSync(join(dir, 'README.txt'), 'pas une entrée');
    const m = readNewsTitles(dir);
    expect(m.get('L1')).toBe('Nouveau titre');
    expect(m.get('L2')).toBe('Ancien titre');
  });
  it('dossier absent = aucune Nouveauté', () => {
    expect(readNewsTitles(join(tmpdir(), 'n-existe-pas-l23')).size).toBe(0);
  });
});

describe('isDenied (filet de sécurité)', () => {
  it.each([
    'Sécurité : PIN absent en prod',
    'démo décidée sur X-Forwarded-Host forgeable',
    'Corriger une faille',
    'Injection SQL',
    'Renouveler le token',
    'Secret Kubernetes',
    'CVE-2026-1234',
    'ThrottlerGuard : bypass du quota',
  ])('écarte « %s »', (title) => {
    expect(isDenied(title)).toBe(true);
  });

  it.each(['Page Nouveautés', 'Revue UX — Classement', 'Carte Ligue 1', 'Opinion', 'Épingler un match'])('laisse passer « %s »', (title) => {
    expect(isDenied(title)).toBe(false);
  });
});

// ── Le vrai plan du dépôt ─────────────────────────────────────────────────────
describe('plan publié (docs/plan/raf.yaml → public/plan-data/plan.json)', () => {
  const realRaf = readPlan(RAF);
  const committedText = () => readFileSync(PLAN_JSON, 'utf8');
  const committed = () => JSON.parse(committedText());

  it('plan.json est à jour avec docs/plan/raf.yaml et docs/nouveautes (sinon : npm run plan)', () => {
    expect(committedText()).toBe(renderPlan(buildPlan(realRaf, { newsTitles: readNewsTitles(NEWS) })));
  });

  it('le plan réel a bien des notes à protéger, et AUCUNE n’apparaît dans plan.json', () => {
    const notes = realRaf.lots.flatMap((l) => (l.notes ?? []).map((n) => String(n.text)));
    expect(notes.length).toBeGreaterThan(5);
    expect(findLeaks(realRaf, committedText(), committed())).toEqual([]);
  });

  it('aucun titre publié ne contient de chemin, de technique, d’identifiant de lot, ni ne dépasse 80 caractères', () => {
    const titles = committed().lots.flatMap((l) => [l.title, ...(l.tasks ?? []).map((t) => t.title).filter(Boolean)]);
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) {
      expect(t).not.toMatch(/\/|\.yaml|localStorage|\bL\d+\b/);
      expect(t.length).toBeLessThanOrEqual(80);
      expect(isDenied(t)).toBe(false);
    }
  });

  it('aucun module de l’application n’importe le plan brut (raf.yaml)', () => {
    const walk = (d) =>
      readdirSync(d).flatMap((f) => {
        const p = join(d, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    // Une chaîne (import, fetch, ?raw…) qui vise le plan brut ; les commentaires peuvent le citer.
    const offenders = walk(`${root}/frontend/src`).filter(
      (f) => /['"`][^'"`\n]*(raf\.ya?ml|docs\/plan)[^'"`\n]*['"`]/.test(readFileSync(f, 'utf8')) && !/\.test\.[jt]sx?$/.test(f),
    );
    expect(offenders).toEqual([]);
  });

  // Le bundle construit (npm run build, qui relance aussi cette vérification) : aucune
  // note, aucun verdict UX, aucun titre brut du plan dans les fichiers servis.
  it.skipIf(!existsSync(DIST))('dist/ (bundle construit) ne contient aucun texte privé du plan', () => {
    expect(scanDir(realRaf, committed(), DIST)).toEqual([]);
  });
});
