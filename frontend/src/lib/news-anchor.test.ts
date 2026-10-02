// L22 — lien permanent /nouveautes#<slug> d'une entrée des Nouveautés
// (repris d'AetherWX news-anchor et de claude-code-codex L13).
import { describe, expect, it } from 'vitest';
import { entryForFragment, permalink } from './news-anchor';

const entries = [{ slug: '2026-10-01-une-page' }, { slug: 'é accent' }];

describe('entryForFragment', () => {
  it('reconnaît le slug, avec ou sans « # », encodé ou non', () => {
    expect(entryForFragment('#2026-10-01-une-page', entries)).toBe('2026-10-01-une-page');
    expect(entryForFragment('2026-10-01-une-page', entries)).toBe('2026-10-01-une-page');
    expect(entryForFragment('#%C3%A9%20accent', entries)).toBe('é accent');
  });

  it('fragment vide, inconnu ou mal encodé → null', () => {
    expect(entryForFragment('', entries)).toBeNull();
    expect(entryForFragment('#', entries)).toBeNull();
    expect(entryForFragment(null, entries)).toBeNull();
    expect(entryForFragment('#inconnu', entries)).toBeNull();
    expect(entryForFragment('#%E0%A4%A', entries)).toBeNull();
  });
});

describe('permalink', () => {
  it('URL absolue de l’entrée, slug encodé', () => {
    expect(permalink('https://ol.sladoire.dev', '2026-10-01-une-page')).toBe(
      'https://ol.sladoire.dev/nouveautes#2026-10-01-une-page',
    );
    expect(permalink('http://localhost:4332', 'é accent')).toBe('http://localhost:4332/nouveautes#%C3%A9%20accent');
  });
});
