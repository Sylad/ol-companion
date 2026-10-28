// L13 — journal des Nouveautés : données générées par `cadence news build`
// (npm run news dans frontend/) dans public/nouveautes-data/, VERSIONNÉES :
// la CI construit l'image sans cadence, la page /nouveautes lit ce JSON.
// Ces tests vérifient que le JSON versionné suit bien docs/nouveautes/.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const ENTRIES = join(ROOT, 'docs/nouveautes');
const DATA = join(ROOT, 'frontend/public/nouveautes-data');
const JSON_FILE = join(DATA, 'nouveautes.json');
const SIZES_FILE = join(DATA, 'tailles.json');

interface Entry {
  slug: string;
  date: string;
  captures: string[];
}

const readJson = (): { entries: Entry[] } => JSON.parse(readFileSync(JSON_FILE, 'utf8'));
const mdFiles = () => readdirSync(ENTRIES).filter((f) => f.endsWith('.md'));

// En-tête YAML minimal des entrées (clé: valeur).
function header(file: string): Record<string, string> {
  const src = readFileSync(join(ENTRIES, file), 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error(`${file} : en-tête absent`);
  const out: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

const pngSize = (file: string): [number, number] => {
  const buf = readFileSync(file);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
};

function cadenceAvailable(): boolean {
  try {
    execFileSync('cadence', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

describe('données des Nouveautés (public/nouveautes-data)', () => {
  it('le JSON versionné existe et porte une entrée par fichier de docs/nouveautes/', () => {
    expect(existsSync(JSON_FILE), 'nouveautes.json absent (cd frontend && npm run news)').toBe(true);
    const slugs = readJson().entries.map((e) => e.slug).sort();
    expect(slugs).toEqual(mdFiles().map((f) => f.replace(/\.md$/, '')).sort());
  });

  it('ordre DÉCROISSANT : date puis heure de création (created), la plus récente en haut', () => {
    const order = readJson().entries.map((e) => e.slug);
    const expected = mdFiles()
      .map((f) => {
        const h = header(f);
        return { slug: f.replace(/\.md$/, ''), date: h.date ?? '', created: h.created ?? '' };
      })
      .sort((a, b) => b.date.localeCompare(a.date) || Date.parse(b.created) - Date.parse(a.created));
    expect(order).toEqual(expected.map((e) => e.slug));
  });

  it('chaque entrée a au moins une capture, servie depuis public/nouveautes-data/', () => {
    for (const e of readJson().entries) {
      expect(e.captures.length, `${e.slug} : aucune capture`).toBeGreaterThan(0);
      for (const c of e.captures) expect(existsSync(join(DATA, c)), `${e.slug} : ${c} manquante`).toBe(true);
    }
  });

  it('aucune capture déclarée deux fois dans une entrée (L200 : liste YAML dupliquée)', () => {
    for (const e of readJson().entries) {
      expect(e.captures, `${e.slug} : capture en double`).toEqual([...new Set(e.captures)]);
    }
  });

  it("pas de page index.html de cadence sous /nouveautes-data/ (doublon non habillé de /nouveautes)", () => {
    expect(existsSync(join(DATA, 'index.html'))).toBe(false);
  });

  it('tailles.json donne la taille réelle de chaque capture (place réservée avant chargement)', () => {
    const sizes: Record<string, [number, number]> = JSON.parse(readFileSync(SIZES_FILE, 'utf8'));
    const captures = readJson().entries.flatMap((e) => e.captures);
    expect(Object.keys(sizes).sort()).toEqual([...new Set(captures)].sort());
    for (const c of captures) expect(sizes[c], c).toEqual(pngSize(join(DATA, c)));
  });

  // Leçon evatosorus L13 : un bandeau 2000×98 devient illisible à la largeur d'un téléphone.
  it('captures lisibles : pas de bandeau plus de 6 fois plus large que haut', () => {
    for (const c of readJson().entries.flatMap((e) => e.captures)) {
      const [w, h] = pngSize(join(DATA, c));
      expect(w / h, `${c} : ${w}×${h}`).toBeLessThanOrEqual(6);
    }
  });

  // Leçon evatosorus L13 : « et » jamais seuls en bout de ligne → U+202F.
  it('guillemets français tenus par une espace fine insécable (U+202F)', () => {
    for (const f of mdFiles()) {
      const src = readFileSync(join(ENTRIES, f), 'utf8');
      const bad = src.match(/«[  \t]|[  \t]»|«(?=[^ ])|(?<=[^ ])»/g);
      expect(bad, `${f} : ${bad?.length} guillemet(s) sans U+202F`).toBeNull();
    }
  });

  // L141 — les captures des tirs au but (L135, L138, L139) montrent des matchs d'exemple :
  // aucun match de la saison n'a encore été décidé aux tirs au but. Le texte et le texte
  // alternatif le disent, pour qu'on ne lise pas un résultat réel.
  it("les Nouveautés L135, L138 et L139 disent que leur capture montre un match d'exemple", () => {
    const EXEMPLE = /exemple, aucun match de la saison n.a encore été décidé aux tirs au but/i;
    const entries = readJson().entries as (Entry & { lots: string[]; alts: string[]; html: string })[];
    for (const lot of ['L135', 'L138', 'L139']) {
      const e = entries.find((x) => x.lots.includes(lot));
      expect(e, `${lot} : entrée Nouveautés absente`).toBeDefined();
      expect(e!.html, `${lot} : le texte ne dit pas que la capture est un exemple`).toMatch(EXEMPLE);
      for (const alt of e!.alts) {
        expect(alt, `${lot} : le texte alternatif ne dit pas que la capture est un exemple`).toMatch(EXEMPLE);
      }
    }
  });

  it.skipIf(!cadenceAvailable())('le JSON versionné est à jour avec docs/nouveautes/ (sinon : npm run news)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ol-news-'));
    try {
      execFileSync('cadence', ['news', 'build', '-o', tmp], { cwd: ROOT, stdio: 'pipe' });
      const fresh = JSON.parse(readFileSync(join(tmp, 'nouveautes.json'), 'utf8'));
      expect(readJson().entries).toEqual(fresh.entries);
      for (const c of fresh.entries.flatMap((e: Entry) => e.captures)) {
        expect(readFileSync(join(DATA, c)).equals(readFileSync(join(tmp, c))), `${c} différente de la source`).toBe(true);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  // L230 — les états comparés par une Nouveauté « pastille compacte » (55 px, minute dans role=status,
  // gameTimeDisplay brut) n'ont existé que dans git entre deux commits de L64 : aucun visiteur ne les a vus.
  // L230 se rattache à l'entrée de L64 (précédent : lots [L38, L110]) au lieu d'en publier une seconde.
  it('L230 — la correction de L64 n\'a pas d\'entrée à elle : elle est rattachée à celle de L64', () => {
    const entries = readJson().entries as (Entry & { lots: string[]; captures: string[] })[];
    const parL230 = entries.filter((x) => x.lots.includes('L230'));
    expect(parL230.map((x) => x.lots)).toEqual([expect.arrayContaining(['L64', 'L230'])]);
    expect(entries.some((x) => x.slug.startsWith('2026-10-28-pendant-un-match-la-pastille'))).toBe(false);
    expect(entries.flatMap((x) => x.captures).some((c) => c.includes('L230'))).toBe(false);
  });

  // L230 — sur /plan, la carte du lot renvoie (« Voir la nouveauté ») à l'entrée de L64, qui dit
  // « Sur ordinateur, rien ne change ». Son titre public doit donc décrire ce que le visiteur a vu
  // (la pastille au téléphone), jamais un changement sur ordinateur ni une minute « lue » que
  // seul git a connue (Nielsen H4, H2).
  it('L230 — le titre public du lot décrit la suite de L64 au téléphone, pas un changement sur ordinateur', () => {
    const plan = JSON.parse(readFileSync(join(ROOT, 'frontend/public/plan-data/plan.json'), 'utf8')) as {
      lots: { id: string; title: string }[];
    };
    const l230 = plan.lots.find((l) => l.id === 'L230');
    expect(l230).toBeDefined();
    expect(l230!.title).toMatch(/téléphone/i);
    expect(l230!.title).not.toMatch(/ordinateur|lue sans bruit/i);
  });
});
