import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormationField } from './formation-field';
import { blend, contrast, type Rgb } from '@/test/contraste';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, search, ...rest }: any) => <a {...rest} href={String(to)}>{children}</a>,
}));

// L233 — l'anneau de focus du lien joueur doit contraster ≥ 3:1 avec le terrain (WCAG 1.4.11).
// Le terrain est un dégradé vertical hsl(155 28% 12%) → hsl(155 22% 7%) : on mesure sur sa teinte la plus claire.
const BLANC: Rgb = [255, 255, 255];
function hsl(h: number, s: number, l: number): Rgb {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [f(0), f(8), f(4)];
}
const TERRAIN_CLAIR = hsl(155, 28, 12);

function lienJoueur() {
  render(
    <FormationField
      starters={[{ id: 1, athleteId: 1, name: 'Joueur Test', shortName: 'Test', jerseyNumber: 8, ranking: null, yardLine: 3 } as any]}
      formation="4-3-3"
      retour={{}}
    />,
  );
  return screen.getByRole('link', { name: 'Fiche de Joueur Test' });
}

describe('anneau de focus du lien joueur (L233)', () => {
  it('R1 — l\'ancien anneau rouge à 60 % tombait sous 3:1 sur le terrain (la mesure sait échouer)', () => {
    const ancien = blend([220, 38, 38], TERRAIN_CLAIR, 0.6);
    expect(contrast(ancien, TERRAIN_CLAIR)).toBeLessThan(3);
  });

  it('R2 — l\'anneau est blanc plein (pas de rouge translucide) et contraste ≥ 3:1 avec le terrain', () => {
    const classes = lienJoueur().className;
    expect(classes).toContain('focus-visible:ring-2');
    expect(classes).toContain('focus-visible:ring-white');
    expect(classes).not.toMatch(/ring-ol-red/);
    expect(contrast(BLANC, TERRAIN_CLAIR)).toBeGreaterThanOrEqual(3);
  });

  it('R3 — l\'anneau est décalé du contenu (offset) pour ne pas se confondre avec le rond bordé de blanc', () => {
    const classes = lienJoueur().className;
    expect(classes).toContain('focus-visible:ring-offset-2');
    expect(classes).toContain('focus-visible:ring-offset-bg');
  });
});
