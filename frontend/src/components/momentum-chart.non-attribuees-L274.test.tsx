import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MomentumChart } from './momentum-chart';
import { basisNote, unattributedNote } from '@/lib/momentum-note';
import type { LiveMatchStats } from '@/types/api';
// Réponse réelle de LiveMatchService.getStats (Lyon 0-0 Lillestrøm), vérifiée égale au service par
// backend/src/modules/live-match/live-match.service.momentum-L274.spec.ts : `momentumBasis` y sort de la table des poids.
import reponse from '@/test/fixtures/live-match-lyon-lillestrom-L274.json';

const servi = reponse as unknown as LiveMatchStats;

/** L274 (D-4) : une part d'actions sans équipe se dit sous le graphe ; le graphe se dit reconstruction. */
const points = Array.from({ length: 90 }, (_, i) => ({ minute: i + 1, value: i % 2 ? 30 : -30 }));
const base = { points, homeName: 'Lyon', awayName: 'Lillestrom', goalMinutes: [], homeIsOl: true };

describe('Momentum — actions sans équipe (L274)', () => {
  it("dit la part non attribuée dans l'en-tête, forme courte à l'écran, phrase entière pour les lecteurs d'écran", () => {
    render(<MomentumChart {...base} actions={{ home: 44, away: 0, unattributed: 27 }} />);
    const note = screen.getByTestId('elan-non-attribuees');
    // Dans l'en-tête, pas sous le graphe : une ligne de plus sous le graphe passait sous le pli de 1366 × 768 (R16).
    expect(note.closest('header')).not.toBeNull();
    const court = note.querySelector('[aria-hidden="true"]')!;
    expect(court.textContent).toBe('27/71 actions (38\u00a0%) sans\u00a0équipe');
    expect(note.querySelector('.sr-only')!.textContent).toBe('27 actions sur 71 (38 %) sans équipe, absentes du graphe.');
    // La phrase sous le graphe ne la répète pas.
    expect(screen.getByTestId('elan').querySelector('header ~ div p')!.textContent).not.toContain('sans équipe');
  });

  it('ne dit rien quand tout est attribué, ou sans compte', () => {
    const { rerender } = render(<MomentumChart {...base} actions={{ home: 44, away: 27, unattributed: 0 }} />);
    expect(screen.queryByTestId('elan-non-attribuees')).toBeNull();
    rerender(<MomentumChart {...base} />);
    expect(screen.queryByTestId('elan-non-attribuees')).toBeNull();
  });

  it('singulier et part sous 1 %', () => {
    expect(unattributedNote({ home: 150, away: 100, unattributed: 1 })).toEqual({
      court: '1/251 action (moins\u00a0de\u00a01\u00a0%) sans\u00a0équipe',
      complet: '1 action sur 251 (moins de 1 %) sans équipe, absente du graphe.',
    });
  });

  it('la phrase sous le graphe cite exactement les sortes d\'actions que le calcul pèse (réponse réelle du service)', () => {
    render(
      <MomentumChart
        {...base}
        points={servi.momentum!}
        actions={servi.momentumActions}
        basis={servi.momentumBasis}
      />,
    );
    const txt = screen.getByTestId('elan').textContent ?? '';
    expect(servi.momentumBasis!.length).toBeGreaterThan(0);
    expect(txt).toContain(`Reconstruction : ${servi.momentumBasis!.join(', ')}\u00a0; sans possession ni occasions franches.`);
    // Les hors-jeu pèsent dans le calcul (0,5) : la phrase les cite.
    expect(txt).toContain('hors-jeu');
    expect(txt).toContain('Vers le haut : Lyon, vers le bas : Lillestrom.');
  });

  it('sans liste du serveur (réponse plus ancienne), la phrase n\'énumère rien', () => {
    expect(basisNote(undefined)).toBe('Reconstruction à partir du fil du match, sans possession ni occasions franches.');
    expect(basisNote([])).toBe(basisNote(undefined));
    render(<MomentumChart {...base} />);
    expect(screen.getByTestId('elan').textContent).toContain('Reconstruction à partir du fil du match');
  });
});

describe('Momentum — en-tête avec un nom long (L274)', () => {
  it("la légende des clubs passe à la ligne au lieu de chevaucher le titre (Lillestrom, 1440 px)", () => {
    render(<MomentumChart {...base} />);
    const header = screen.getByTestId('elan').querySelector('header')!;
    expect(header.className).toContain('flex-wrap');
  });
});

