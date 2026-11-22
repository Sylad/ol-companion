import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { LiveMatchLineup, LiveMatchLineupPlayer } from '@/types/api';
import { LineupCard } from './lineup-card';

// L269 (revue de code, m1) — câblage du dernier recours `useNomsCoupes` (lineup-card.tsx) : mesure de la largeur de la
// rangée, de la place de la pastille, des noms avec la sonde, nouveau rendu avec les césures douces, `data-coupe` sur le
// terrain, et nouvelle mesure quand le terrain change de largeur. jsdom ne met rien en page : la mise en page est
// simulée (largeur de la rangée posée par le test, 7 px par caractère pour la sonde, padding et bordures nuls).
// Rendu réel du même cas dans Chromium : tests-navigateur/plancher-12px-L261.test.ts (« dernier recours »).

const CESURE = '­';
const PX_PAR_CARACTERE = 7;

const pl = (id: number, shortName: string, yardLine: number, yardSide: number, positionShort = 'CB'): LiveMatchLineupPlayer => ({
  id, name: shortName, shortName, jerseyNumber: id, positionShort, yardLine, yardSide, ranking: null,
});

// 5-3-2 : défense de cinq noms longs (sauf « Sy »), rangée de 200 px → place commune de (200 − 4 × 4) / 5 = 36,8 px.
const DEFENSE = ['Kristoffersen', 'Papastathopoulos', 'Sy', 'Omobamidele', 'Abdelhamid'];
const lineup: LiveMatchLineup = {
  formation: '5-3-2',
  starters: [
    pl(1, 'Gardien', 1, 50, 'GK'),
    ...DEFENSE.map((n, k) => pl(2 + k, n, 2, 10 + k * 20)),
    pl(7, 'Ma', 3, 25, 'CM'), pl(8, 'Mo', 3, 50, 'CM'), pl(9, 'Mi', 3, 75, 'CM'),
    pl(10, 'Ab', 4, 35, 'ST'), pl(11, 'Ba', 4, 65, 'ST'),
  ],
  bench: [],
};

let largeurRangee = 200;
let observe: (() => void) | null = null;

beforeEach(() => {
  largeurRangee = 200;
  observe = null;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.dataset.testid === 'rangee-composition' ? largeurRangee : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = (this.textContent ?? '').length * PX_PAR_CARACTERE;
    return { x: 0, y: 0, top: 0, left: 0, right: width, bottom: 16, width, height: 16, toJSON: () => ({}) } as DOMRect;
  });
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: () => void) { observe = cb; }
    observe() {}
    disconnect() {}
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const nomAffiche = (n: string) => screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent?.replaceAll(CESURE, '') === n && el.childElementCount === 0);

describe('L269 — dernier recours : une rangée trop large pour ses noms entiers les coupe en syllabes', () => {
  it('à 200 px, les noms les plus larges reçoivent des césures douces, « Sy » reste entier ; à 2000 px plus aucune coupure', () => {
    render(<LineupCard lineup={lineup} teamName="Test" accent="blue" />);
    const terrain = screen.getByTestId('terrain-composition');
    expect(terrain).toHaveAttribute('data-coupe', 'true');

    // Le nom le plus large est coupé, à 12 px (même classe), et garde ses lettres dans l'ordre.
    const papa = nomAffiche('Papastathopoulos');
    expect(papa.textContent).toContain(CESURE);
    expect(papa.className).toContain('text-petite');
    expect(papa.className).toContain('[hyphens:manual]');
    // Chaque syllabe, trait d'union compris, tient dans la place commune (36,8 px = 5 caractères à 7 px).
    for (const s of papa.textContent!.split(CESURE)) expect(s.length + 1).toBeLessThanOrEqual(5);
    // Un nom court n'est jamais touché ; les autres rangées (noms de 2 lettres) non plus.
    expect(nomAffiche('Sy').textContent).toBe('Sy');
    for (const n of ['Ma', 'Mo', 'Mi', 'Ab', 'Ba', 'Gardien']) expect(nomAffiche(n).textContent).toBe(n);
    // Seule la rangée de la défense a des noms coupés.
    const rangees = screen.getAllByTestId('rangee-composition');
    const coupees = rangees.filter((r) => r.textContent!.includes(CESURE));
    expect(coupees).toHaveLength(1);
    expect(coupees[0].textContent!.replaceAll(CESURE, '')).toContain('Papastathopoulos');

    // Le terrain s'élargit : nouvelle mesure, les noms redeviennent entiers.
    largeurRangee = 2000;
    act(() => observe?.());
    expect(terrain).not.toHaveAttribute('data-coupe');
    for (const n of DEFENSE) expect(nomAffiche(n).textContent).toBe(n);

    // Et se rétrécit de nouveau : les césures reviennent.
    largeurRangee = 200;
    act(() => observe?.());
    expect(terrain).toHaveAttribute('data-coupe', 'true');
    expect(nomAffiche('Papastathopoulos').textContent).toContain(CESURE);
  });

  it('une rangée qui tient avec ses noms entiers n\'est jamais coupée', () => {
    largeurRangee = 400; // 5 noms entiers = 91 + 112 + 14 + 77 + 70 + 4 × 4 = 380 px ≤ 400
    render(<LineupCard lineup={lineup} teamName="Test" accent="blue" />);
    expect(screen.getByTestId('terrain-composition')).not.toHaveAttribute('data-coupe');
    for (const n of DEFENSE) expect(nomAffiche(n).textContent).toBe(n);
  });
});
