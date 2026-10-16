import { describe, expect, it } from 'vitest';
import { clubLegendLabel, clubSymbol } from './club-symbol';

describe('clubSymbol', () => {
  it('R5 — garde le sigle fourni par 365scores', () => {
    expect(clubSymbol('RCL', 'Lens')).toBe('RCL');
  });
  it('R5 — sigle vide : trois premières lettres du nom en capitales', () => {
    expect(clubSymbol('', 'Lens')).toBe('LEN');
    expect(clubSymbol('  ', 'Olympique Lyonnais')).toBe('OLY');
  });
  it('R5 — sigle absent et nom accentué : lettres seules, en capitales', () => {
    expect(clubSymbol(undefined, 'Saint-Étienne')).toBe('SAI');
    expect(clubSymbol('', 'Le Havre')).toBe('LEH');
  });
  it("R5 — le club suivi est toujours « OL », même sans sigle ou avec un autre sigle de 365scores", () => {
    expect(clubSymbol('', 'Lyon', true)).toBe('OL');
    expect(clubSymbol(undefined, 'Olympique Lyonnais', true)).toBe('OL');
    expect(clubSymbol('LYO', 'Lyon', true)).toBe('OL');
  });
  it("R5 — l'adversaire garde le repli sur le nom", () => {
    expect(clubSymbol('', 'Rennes', false)).toBe('REN');
  });
});

describe('clubLegendLabel', () => {
  it("R5 — OL : sigle fixe puis nom (« OL Lyon »), même sans sigle de 365scores", () => {
    expect(clubLegendLabel('', 'Lyon', true)).toBe('OL Lyon');
  });
  it("R5 — adversaire avec un vrai sigle : sigle puis nom (« RCL Lens »)", () => {
    expect(clubLegendLabel('RCL', 'Lens', false)).toBe('RCL Lens');
  });
  it("R5 — adversaire dont le sigle n'est qu'un repli : le nom seul, sans « REN RENNES »", () => {
    expect(clubLegendLabel('', 'Rennes', false)).toBe('Rennes');
    expect(clubLegendLabel('  ', 'Crystal Palace', false)).toBe('Crystal Palace');
  });
});
