// L121 — import local des carrières (R7 de docs/specs/fcnoobz-carrieres/fiche.yaml) : liste blanche, fusion, fichier publié.
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { validerCarrieres } from './fcnoobz-carrieres-schema.mjs';
import { fusionnerReleves, main, SORTIE_PAR_DEFAUT } from './fcnoobz-import.mjs';

const saison = (o = {}) => ({ saison: '2025-2026', division: 'Division Test', place: 3, provenance: 'saisie', ...o });
const releve = (editions) => ({ editions });

function dossier() {
  return mkdtempSync(join(tmpdir(), 'fcnoobz-'));
}

describe('R7 — liste blanche', () => {
  it("R7 — l'import refuse un champ hors liste blanche", () => {
    const d = dossier();
    const f = join(d, 'releve.json');
    const sortie = join(d, 'carrieres.json');
    writeFileSync(f, JSON.stringify(releve([{ edition: 26, clubs: [{ club: 'Club', saisons: [saison({ meilleurButeur: 'Un Joueur' })] }] }])));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(main([f, '--sortie', sortie])).toBe(1);
    expect(err.mock.calls.join('\n')).toContain('champ hors liste blanche « meilleurButeur »');
    expect(existsSync(sortie)).toBe(false);
    err.mockRestore();
  });

  it('R7 — refuse aussi un champ en trop sur le club, l’édition ou la racine', () => {
    expect(validerCarrieres({ releveLe: null, editions: [], finances: 1 })).toContain('racine : champ hors liste blanche « finances »');
    const e = validerCarrieres({ releveLe: '2026-11-25', editions: [{ edition: 26, build: 'x', clubs: [{ club: 'C', budget: 1, saisons: [saison()] }] }] });
    expect(e.join('\n')).toContain('« build »');
    expect(e.join('\n')).toContain('« budget »');
  });

  it('R7 — valeurs contrôlées : saison, place, provenance, date du relevé', () => {
    const e = validerCarrieres({
      releveLe: '25/11/2026',
      editions: [{ edition: 26, clubs: [{ club: 'C', saisons: [saison({ saison: '2025-2027', place: 0, provenance: 'web' })] }] }],
    }).join('\n');
    for (const m of ['releveLe', '.saison', '.place', '.provenance']) expect(e).toContain(m);
  });

  it('R7 — le fichier publié respecte la liste blanche', () => {
    const publie = JSON.parse(readFileSync(resolve(SORTIE_PAR_DEFAUT), 'utf8'));
    expect(validerCarrieres(publie)).toEqual([]);
  });
});

describe('import — fusion et écriture', () => {
  it('fusionne les relevés : éditions récentes en tête, saisons chronologiques, le dernier relevé l’emporte', () => {
    const a = releve([{ edition: 24, clubs: [{ club: 'B', saisons: [saison({ saison: '2024-2025' }), saison({ saison: '2023-2024' })] }] }]);
    const b = releve([{ edition: 26, clubs: [{ club: 'A', saisons: [saison({ place: 5 })] }] }]);
    const c = releve([{ edition: 26, clubs: [{ club: 'A', saisons: [saison({ place: 2, provenance: 'sauvegarde' })] }] }]);
    const out = fusionnerReleves([a, b, c], '2026-11-25');
    expect(out.releveLe).toBe('2026-11-25');
    expect(out.editions.map((e) => e.edition)).toEqual([26, 24]);
    expect(out.editions[0].clubs[0].saisons).toEqual([saison({ place: 2, provenance: 'sauvegarde' })]);
    expect(out.editions[1].clubs[0].saisons.map((s) => s.saison)).toEqual(['2023-2024', '2024-2025']);
    expect(validerCarrieres(out)).toEqual([]);
  });

  it('écrit le fichier vérifié avec la date du relevé', () => {
    const d = dossier();
    const f = join(d, 'releve.json');
    const sortie = join(d, 'sortie', 'carrieres.json');
    writeFileSync(f, JSON.stringify(releve([{ edition: 21, clubs: [{ club: 'Club', saisons: [saison({ titres: ['Coupe'] })] }] }])));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(main([f, '--releve', '2026-11-20', '--sortie', sortie])).toBe(0);
    log.mockRestore();
    const ecrit = JSON.parse(readFileSync(sortie, 'utf8'));
    expect(ecrit.releveLe).toBe('2026-11-20');
    expect(ecrit.editions[0].clubs[0].saisons[0].titres).toEqual(['Coupe']);
  });

  it('sans relevé : usage, code 2', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(main([])).toBe(2);
    err.mockRestore();
  });
});
