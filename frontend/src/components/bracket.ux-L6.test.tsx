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

// Contraste de CHAQUE texte rendu d'une tuile, d'après sa classe de couleur réelle, sur le fond réel :
// tuile de l'OL = bg-ol-red/10 (translucide) posé sur le fond du tableau (surface-2), sinon bg-surface.
function contrastesDeLaTuile(tuile: Element, olRouge: boolean): { texte: string; nom: string; ratio: number }[] {
  const fond = olRouge ? blend(token('ol-red'), token('surface-2'), 0.1) : token('surface');
  const sortie: { texte: string; nom: string; ratio: number }[] = [];
  const walker = document.createTreeWalker(tuile, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const texte = n.textContent?.trim();
    if (!texte) continue;
    let el: Element | null = n.parentElement;
    let nom = 'fg';
    for (; el && el !== tuile.parentElement; el = el.parentElement) {
      const c = el.className.toString().match(/(?:^|\s)text-(fg(?:-[a-z]+)?)(?:\s|$)/)?.[1];
      if (c) { nom = c; break; }
    }
    sortie.push({ texte, nom, ratio: contrast(token(nom), fond) });
  }
  return sortie;
}

describe('L6 t2 — tous les textes des tuiles du tableau tiennent 4,5:1 sur leur fond réel', () => {
  const aller = m(1, { date: '2026-03-01T20:00:00Z' });
  const retour = m(2, { date: '2026-03-08T20:00:00Z', homeTeam: 'Lille', homeTeamId: 79, awayTeam: 'Lyon', awayTeamId: 465, homeScore: null, awayScore: null, status: 'SCHEDULED' });
  const avenir = m(3, { homeTeam: 'Lyon', awayTeam: 'Nice', awayTeamId: 9, homeScore: null, awayScore: null, status: 'SCHEDULED', stageNum: 5, stageFr: 'Demi-finales' });
  const jouee = m(4, { stageNum: 5, stageFr: 'Demi-finales' });
  const tableau = (...stages: object[][]): BracketInfo => ({
    stages: stages.map((matches, i) => ({ stageNum: 6 - i, stageFr: i ? 'Demi-finales' : 'Quarts de finale', matches })),
  } as BracketInfo);

  it.each([
    ['confrontation aller-retour de l’OL (en-têtes A/R, dates aller et retour)', tableau([aller, retour]), 'A'],
    ['match de l’OL à venir (date)', tableau([avenir]), '0'],
  ])('t2 — %s', (_nom, br, attendu) => {
    const { container } = render(<Bracket bracket={br} />);
    // Disposition bureau (la tuile existe aussi en pile mobile) : première occurrence suffit, les deux ont les mêmes classes.
    const tuile = container.querySelector('.border-ol-red')!;
    expect(tuile).not.toBeNull();
    expect(tuile.className).toMatch(/\bbg-ol-red\/10\b/);
    const mesures = contrastesDeLaTuile(tuile, true);
    expect(mesures.length).toBeGreaterThan(0);
    if (attendu === 'A') expect(mesures.map((x) => x.texte)).toEqual(expect.arrayContaining(['A', 'R']));
    for (const x of mesures) expect(x.ratio, `« ${x.texte} » en ${x.nom}`).toBeGreaterThanOrEqual(4.5);
  });

  it('t2 — match de l’OL joué : lignes gagnante et perdante', () => {
    const { container } = render(<Bracket bracket={tableau([jouee])} />);
    for (const x of contrastesDeLaTuile(container.querySelector('.border-ol-red')!, true)) {
      expect(x.ratio, `« ${x.texte} » en ${x.nom}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('t2 — tuile d’un autre club (bg-surface) : même exigence', () => {
    const autre = m(5, { homeTeam: 'Nice', homeTeamId: 9, awayTeam: 'Brest', awayTeamId: 8, hasOL: false });
    const autreRetour = m(6, { homeTeam: 'Brest', homeTeamId: 8, awayTeam: 'Nice', awayTeamId: 9, hasOL: false, date: '2026-03-08T20:00:00Z', homeScore: null, awayScore: null, status: 'SCHEDULED' });
    const { container } = render(<Bracket bracket={tableau([autre, autreRetour])} />);
    const tuile = container.querySelector('.rounded-md.border.border-border.bg-surface')!;
    for (const x of contrastesDeLaTuile(tuile, false)) expect(x.ratio, `« ${x.texte} » en ${x.nom}`).toBeGreaterThanOrEqual(4.5);
  });

  it('t2 — le calcul voit bien le défaut : fg-dim sur le fond rouge teinté de l’OL (surface-2) fait 4,35:1', () => {
    expect(contrast(token('fg-dim'), blend(token('ol-red'), token('surface-2'), 0.1))).toBeLessThan(4.5);
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
