import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShotMap } from './shot-map';

// L160 — revue UX de conformité : les libellés d'attaque verticaux recouvraient les marqueurs de tirs
// (dans les surfaces de réparation, justement là où les tirs se concentrent), et la légende répétait le
// nom (« LYO LYON · REN RENNES ») quand 365scores ne donne pas de sigle.
const shot = (side: number, line: number) =>
  ({ playerId: 1, competitorId: 10, time: 5, line, side, xg: 0.2, outcome: 'Saved' }) as never;

const renderMap = (props: { homeIsOl: boolean; homeName: string; awayName: string; homeSymbol?: string; awaySymbol?: string }) =>
  render(
    <ShotMap
      shots={[shot(92, 50), shot(8, 50)]}
      homeId={10}
      homeIsOl={props.homeIsOl}
      homeName={props.homeName}
      awayName={props.awayName}
      homeSymbol={props.homeSymbol ?? ''}
      awaySymbol={props.awaySymbol ?? ''}
    />,
  );

/** Tous les ancêtres de `el` jusqu'à `stop` (exclu). */
const ancestors = (el: Element, stop: Element): Element[] => {
  const out: Element[] = [];
  for (let n = el.parentElement; n && n !== stop; n = n.parentElement) out.push(n);
  return out;
};

describe('ShotMap — libellés d\'attaque hors du terrain (L160)', () => {
  it('R5 — les libellés d\'attaque ne sont pas posés sur le terrain : ni dans son conteneur, ni en position absolue', () => {
    renderMap({ homeIsOl: true, homeName: 'Lyon', awayName: 'Rennes' });
    const carte = screen.getByTestId('carte-tirs');
    const terrain = within(carte).getByRole('img', { name: 'Carte des tirs' });
    const surface = terrain.parentElement as HTMLElement;
    for (const re of [/← .* attaque/, /.* attaque →/]) {
      const label = within(carte).getByText(re);
      expect(surface.contains(label), String(re)).toBe(false);
      for (const a of [label, ...ancestors(label, carte)]) {
        expect(a.className, String(re)).not.toMatch(/\babsolute\b/);
      }
    }
  });

  it('R5 — les libellés sont du texte horizontal, sur une seule ligne, sous le terrain', () => {
    renderMap({ homeIsOl: true, homeName: 'Lyon', awayName: 'Rennes' });
    const carte = screen.getByTestId('carte-tirs');
    const terrain = within(carte).getByRole('img', { name: 'Carte des tirs' });
    const gauche = within(carte).getByText(/← .* attaque/);
    const droite = within(carte).getByText(/.* attaque →/);
    for (const el of [gauche, droite]) {
      expect(el.className + el.parentElement!.className).not.toMatch(/writing-mode|vertical|rotate/);
      expect(terrain.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // une seule ligne : les deux libellés sont frères, dans la même rangée
    expect(gauche.parentElement).toBe(droite.parentElement);
    expect(gauche.parentElement!.className).toMatch(/\bflex\b/);
    expect(gauche.parentElement!.className).not.toMatch(/flex-col|flex-wrap/);
  });

  it('R5 — la couleur suit le club (OL rouge, adversaire bleu) et reste ≥ 4,5:1, OL à domicile comme à l\'extérieur', () => {
    for (const homeIsOl of [true, false]) {
      const { unmount } = renderMap({ homeIsOl, homeName: homeIsOl ? 'Lyon' : 'Rennes', awayName: homeIsOl ? 'Rennes' : 'Lyon' });
      const carte = screen.getByTestId('carte-tirs');
      const olLabel = within(carte).getByText(homeIsOl ? /OL attaque →/ : /← OL attaque/);
      const advLabel = within(carte).getByText(homeIsOl ? /← REN attaque/ : /REN attaque →/);
      expect(olLabel.className).toMatch(/text-ol-red-bright/);
      expect(advLabel.className).toMatch(/226_70%_70%/);
      unmount();
    }
  });
});
