import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
const regle = (sel: string) => {
  const m = css.match(new RegExp(`^${sel.replace(/[.:*()-]/g, '\\$&')} \\{ ([^}]*) \\}`, 'm'));
  return m?.[1] ?? '';
};

describe('L166 — barre de défilement des faits, piste arrondie', () => {
  it('R12 — la piste a le même rayon (5 px) que le curseur, bordure bleue néon et fond inchangés', () => {
    const piste = regle('.faits-liste::-webkit-scrollbar-track');
    const curseur = regle('.faits-liste::-webkit-scrollbar-thumb');
    const rayonCurseur = curseur.match(/border-radius:\s*([^;]+);/)?.[1];
    expect(rayonCurseur).toBe('5px');
    expect(piste.match(/border-radius:\s*([^;]+);/)?.[1]).toBe(rayonCurseur);
    expect(piste).toContain('border: 1px solid hsl(var(--ol-blue-bright))');
    expect(piste).toContain('background: hsl(var(--surface))');
  });
});
