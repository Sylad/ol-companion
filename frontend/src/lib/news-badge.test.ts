// L22 — pastille « nouveau » des Nouveautés (repris d'AetherWX news-badge et de
// claude-code-codex L13) : entrées non vues depuis la dernière visite de /nouveautes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NEWS_SEEN_KEY,
  badgeLabel,
  countUnseen,
  isUnseen,
  markAllSeen,
  readSeen,
  sinceLabel,
  unseenLabel,
  type StorageLike,
} from './news-badge';

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const entries = [
  { slug: 'c', date: '2026-09-10' },
  { slug: 'b', date: '2026-09-10' },
  { slug: 'a', date: '2026-09-09' },
];

describe('news-badge', () => {
  it('clé propre à l’application', () => {
    expect(NEWS_SEEN_KEY).toBe('ol.news.seen-v1');
  });

  it('premier visiteur (aucune visite mémorisée) : rien n’est marqué nouveau', () => {
    expect(countUnseen(entries, null)).toBe(0);
    expect(entries.some((e) => isUnseen(e, null))).toBe(false);
    expect(readSeen(null)).toBeNull();
    expect(readSeen(new MemoryStorage())).toBeNull();
  });

  it('visiter marque tout vu ; la pastille tombe à zéro', () => {
    const st = new MemoryStorage();
    const seen = markAllSeen(st, entries, new Date('2026-09-25T11:57:30Z'));
    expect(seen).toEqual({ date: '2026-09-10', slugs: ['b', 'c'], at: '2026-09-25T11:57:30.000Z' });
    expect(readSeen(st)).toEqual(seen);
    expect(countUnseen(entries, readSeen(st))).toBe(0);
  });

  it('une entrée du même jour non vue compte comme nouvelle ; une plus récente aussi', () => {
    const st = new MemoryStorage();
    markAllSeen(st, entries);
    const later = [{ slug: 'e', date: '2026-09-11' }, { slug: 'd', date: '2026-09-10' }, ...entries];
    expect(countUnseen(later, readSeen(st))).toBe(2);
    expect(later.map((e) => isUnseen(e, readSeen(st)))).toEqual([true, true, false, false, false]);
    markAllSeen(st, later);
    expect(readSeen(st)!.date).toBe('2026-09-11');
    expect(readSeen(st)!.slugs).toEqual(['e']);
    expect(countUnseen(later, readSeen(st))).toBe(0);
  });

  it('instants comparés en millisecondes : 13:15:00Z et 13:15Z sont le même instant', () => {
    const st = new MemoryStorage();
    st.setItem(NEWS_SEEN_KEY, JSON.stringify({ date: '2026-09-28T13:15:00Z', slugs: ['soir'] }));
    expect(
      countUnseen(
        [
          { slug: 'soir', date: '2026-09-28T13:15Z' },
          { slug: 'matin', date: '2026-09-28T07:20Z' },
        ],
        readSeen(st),
      ),
    ).toBe(0);
    expect(countUnseen([{ slug: 'nuit', date: '2026-09-28T21:05Z' }], readSeen(st))).toBe(1);
  });

  it('mémoire corrompue ou stockage en panne : pas d’exception', () => {
    const st = new MemoryStorage();
    st.setItem(NEWS_SEEN_KEY, '{pas du json');
    expect(readSeen(st)).toBeNull();
    st.setItem(NEWS_SEEN_KEY, JSON.stringify({ date: 'hier', slugs: [] }));
    expect(readSeen(st)).toBeNull();
    st.setItem(NEWS_SEEN_KEY, JSON.stringify({ date: '2026-09-10', slugs: ['b', 3], at: 42 }));
    expect(readSeen(st)).toEqual({ date: '2026-09-10', slugs: ['b'] });
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('quota');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    expect(readSeen(broken)).toBeNull();
    expect(markAllSeen(broken, entries)!.date).toBe('2026-09-10');
    expect(markAllSeen(st, [])).toBeNull();
  });

  it('journal réel (nouveautes.json) : visite puis relecture → pastille éteinte', () => {
    const data = JSON.parse(
      readFileSync(resolve(__dirname, '../../public/nouveautes-data/nouveautes.json'), 'utf8'),
    ) as { entries: { slug: string; date: string }[] };
    const st = new MemoryStorage();
    markAllSeen(st, data.entries);
    expect(badgeLabel(countUnseen(data.entries, readSeen(st)))).toBe('');
  });

  it('libellés : pastille vide à zéro, « 9+ » au-delà de neuf ; textes pour lecteur d’écran accordés', () => {
    expect(badgeLabel(0)).toBe('');
    expect(badgeLabel(3)).toBe('3');
    expect(badgeLabel(12)).toBe('9+');
    expect(unseenLabel(0)).toBe('');
    expect(unseenLabel(1)).toBe('1 nouveauté non vue');
    expect(unseenLabel(4)).toBe('4 nouveautés non vues');
    expect(sinceLabel(0)).toBe('');
    expect(sinceLabel(1)).toBe('1 nouveauté depuis votre dernière visite');
    expect(sinceLabel(3)).toBe('3 nouveautés depuis votre dernière visite');
  });
});
