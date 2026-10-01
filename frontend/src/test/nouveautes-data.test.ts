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
});
