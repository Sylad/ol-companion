import { describe, expect, it } from 'vitest';
import { displayNews } from './news-display';
import type { NewsItem } from '@/types/api';

const base: NewsItem = { title: '', link: 'https://x', pubDate: '2026-10-17T10:00:00Z', source: 'Google News', description: '' };

describe('L5/t7 — affichage d\'un article', () => {
  it('Google News : l\'éditeur en fin de titre devient la source de la carte', () => {
    const d = displayNews({ ...base, title: 'Mercato : une piste - Le Progrès' });
    expect(d.title).toBe('Mercato : une piste');
    expect(d.source).toBe('Le Progrès');
  });

  it('Google News : le dernier « - » seul sépare l\'éditeur (un tiret dans le titre reste)', () => {
    const d = displayNews({ ...base, title: 'OL - PSG : le résumé - L\'Équipe' });
    expect(d.title).toBe('OL - PSG : le résumé');
    expect(d.source).toBe("L'Équipe");
  });

  it('une autre source garde son titre et sa source', () => {
    const d = displayNews({ ...base, source: 'Olympique et Lyonnais', title: 'A - B' });
    expect(d.title).toBe('A - B');
    expect(d.source).toBe('Olympique et Lyonnais');
  });

  it('titre sans éditeur : inchangé, source « Google News »', () => {
    const d = displayNews({ ...base, title: 'Sans éditeur' });
    expect(d.title).toBe('Sans éditeur');
    expect(d.source).toBe('Google News');
  });

  it('description identique au titre (avec ou sans éditeur) : supprimée', () => {
    expect(displayNews({ ...base, title: 'Mercato - Le Progrès', description: 'Mercato - Le Progrès' }).description).toBe('');
    expect(displayNews({ ...base, title: 'Mercato - Le Progrès', description: 'Mercato  Le Progrès' }).description).toBe('');
    expect(displayNews({ ...base, title: 'Mercato - Le Progrès', description: 'mercato' }).description).toBe('');
    expect(displayNews({ ...base, source: 'Olympique et Lyonnais', title: 'Match', description: 'Match' }).description).toBe('');
  });

  it('description distincte : gardée', () => {
    expect(displayNews({ ...base, title: 'Mercato - Le Progrès', description: 'Un vrai résumé' }).description).toBe('Un vrai résumé');
  });
});
