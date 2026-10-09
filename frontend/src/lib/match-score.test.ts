import { describe, expect, it } from 'vitest';
import { scoreText } from './match-score';

describe('scoreText (L77)', () => {
  it('masque le score d\'un match à venir, même si la source donne -1', () => {
    expect(scoreText({ score: -1 }, { score: -1 }, 'upcoming')).toBeNull();
    expect(scoreText({ score: 0 }, { score: 0 }, 'upcoming')).toBeNull();
  });
  it('masque un score négatif ou absent quel que soit le statut', () => {
    expect(scoreText({ score: -1 }, { score: -1 }, 'live')).toBeNull();
    expect(scoreText({ score: null }, { score: null }, 'ended')).toBeNull();
  });
  it('rend le score d\'un match commencé', () => {
    expect(scoreText({ score: 2 }, { score: 0 }, 'live')).toEqual(['2', '0']);
    expect(scoreText({ score: 0 }, { score: 0 }, 'ended')).toEqual(['0', '0']);
  });
});
