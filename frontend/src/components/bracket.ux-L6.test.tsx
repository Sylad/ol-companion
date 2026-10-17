import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Bracket } from './bracket';
import { blend, contrast, token } from '@/test/contraste';
import type { BracketInfo } from '@/types/api';

// L6 — revue UX de Coupes : tableau (t2 contraste du texte atténué, t5 plein écran en dialogue).

const m = (id: number, o: object = {}) => ({
  id, date: '2026-03-01T20:00:00Z', homeTeam: 'Lyon', homeTeamId: 465, awayTeam: 'Lille', awayTeamId: 79,
  homeScore: 2, awayScore: 0, status: 'FINISHED' as const, stageNum: 6, stageFr: 'Quarts de finale', hasOL: true, ...o,
});
const bracket: BracketInfo = { stages: [{ stageNum: 6, stageFr: 'Quarts de finale', matches: [m(1), m(2, { homeTeam: 'Nice', homeTeamId: 9, awayTeam: 'Brest', awayTeamId: 8, hasOL: false })] }] } as BracketInfo;

describe('L6 t2 — le texte atténué du tableau', () => {
  it('t2 — la ligne perdante du tableau est en fg-muted (≥ 4,5:1 sur le fond rouge teinté de l’OL), plus en fg-dim', () => {
    const { container } = render(<Bracket bracket={bracket} />);
    const perdant = [...container.querySelectorAll('span.truncate')].find((s) => s.textContent === 'Lille')!;
    expect(perdant.parentElement!.className).toMatch(/\btext-fg-muted\b/);
    expect(perdant.parentElement!.className).not.toMatch(/\btext-fg-dim\b/);
    const fond = blend(token('ol-red'), token('surface'), 0.1);
    expect(contrast(token('fg-muted'), fond)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('L6 t5 — le tableau plein écran est un dialogue', () => {
  const ouvrir = () => {
    const view = render(<Bracket bracket={bracket} />);
    const bouton = screen.getByRole('button', { name: 'Ouvrir le tableau en plein écran' });
    bouton.focus();
    fireEvent.click(bouton);
    return { ...view, bouton };
  };

  it('t5 — rendu dans body (hors du conteneur de la page), role=dialog aria-modal', () => {
    const { container } = ouvrir();
    const dialogue = screen.getByRole('dialog');
    expect(dialogue).toHaveAttribute('aria-modal', 'true');
    expect(dialogue).toHaveAccessibleName();
    expect(container.contains(dialogue)).toBe(false);
    expect(document.body.contains(dialogue)).toBe(true);
  });

  it('t5 — le focus passe sur « Fermer » à l’ouverture', () => {
    ouvrir();
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus();
  });

  it('t5 — Tab est piégé dans le dialogue (« Fermer » est le seul élément focalisable)', () => {
    ouvrir();
    const fermer = within(screen.getByRole('dialog')).getByRole('button', { name: 'Fermer' });
    fireEvent.keyDown(fermer, { key: 'Tab' });
    expect(fermer).toHaveFocus();
    fireEvent.keyDown(fermer, { key: 'Tab', shiftKey: true });
    expect(fermer).toHaveFocus();
  });

  it('t5 — Tab depuis l’extérieur du dialogue y ramène le focus', () => {
    const { bouton } = ouvrir();
    bouton.focus();
    fireEvent.keyDown(bouton, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus();
  });

  it('t5 — Échap ferme et rend le focus au bouton « Plein écran »', () => {
    const { bouton } = ouvrir();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bouton).toHaveFocus();
  });

  it('t5 — « Fermer » ferme aussi et rend le focus', () => {
    const { bouton } = ouvrir();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bouton).toHaveFocus();
  });
});
