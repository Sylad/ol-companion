import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import season from '@/test/fixtures/season-matches-2026-10-03.json';
import { FixturesPage } from './fixtures';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, search, ...rest }: any) => (
    <a {...rest} href={`${String(to).replace('$gameId', params?.gameId)}?matchupId=${search?.matchupId}`}>
      {children}
    </a>
  ),
}));

afterEach(() => vi.unstubAllGlobals());

// L64 — au téléphone la barre des filtres colle SOUS la ligne collante de la pastille du direct (36 px) et le bandeau démo,
// pas à top-0. La règle est un style en ligne (il l'emporte sur `max-lg:top-0` de L50) : sans ce test, retirer le style
// ramènerait la barre sous la pastille sans qu'aucun test ne rougisse.
describe('Barre des filtres du Calendrier sous la ligne du direct (L64)', () => {
  it('R4 — la barre collante a top = bandeau démo + ligne du direct', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      Promise.resolve(url === '/api/season-matches'
        ? { ok: true, status: 200, json: async () => season }
        : { ok: false, status: 404, json: async () => ({}) })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><FixturesPage /></QueryClientProvider>);
    const barre = await screen.findByTestId('barre-filtres');
    expect(barre).toHaveClass('max-lg:sticky');
    expect(barre.style.top.replace(/\s+/g, '')).toBe('calc(var(--bandeau-demo-h,0px)+var(--ligne-direct-h,0px))');
  });
});
