import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { LastResult } from './last-result';

// L138 — badge du dernier résultat : jamais coupé en deux lignes à 390 px, contraste ≥ 4,5:1 (WCAG 1.4.3).

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
const token = (n: string): [number, number, number] => {
  const m = css.match(new RegExp(`--${n}:\\s*(\\d+)\\s+(\\d+)%\\s+(\\d+)%`));
  if (!m) throw new Error(`jeton --${n} introuvable`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const rgb = ([h, s, l]: [number, number, number]) => {
  const S = s / 100, L = l / 100, a = S * Math.min(L, 1 - L);
  const f = (n: number) => { const k = (n + h / 30) % 12; return 255 * (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return [f(0), f(8), f(4)];
};
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('L138 — contraste du badge', () => {
  it.each(['loss', 'win', 'draw'])('texte du badge %s ≥ 4,5:1 sur sa teinte à 10 %% posée sur la carte', (t) => {
    const surface = rgb(token('surface'));
    const bg = rgb(token(t)).map((v, i) => 0.9 * surface[i] + 0.1 * v);
    const fg = rgb(token(`${t}-fg`));
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('L138 — disposition du badge', () => {
  it('« Défaite aux tirs au but » ne passe jamais à la ligne et « Dernier résultat » non plus', async () => {
    const m = {
      id: 3, date: new Date(Date.now() - 86_400_000).toISOString(), homeTeam: 'Olympique Lyonnais', homeTeamId: 523,
      awayTeam: 'Rennes', awayTeamId: 800, homeScore: 1, awayScore: 1, competition: 'Coupe de France', competitionCode: 'CDF',
      competitionId: 37, status: 'FINISHED', matchday: null, round: null, timeConfirmed: true, shootoutWinnerId: 800,
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [m] })));
    render(<QueryClientProvider client={new QueryClient()}><LastResult /></QueryClientProvider>);
    const badge = await screen.findByTestId('badge-dernier-resultat');
    expect(badge).toHaveTextContent('Défaite aux tirs au but');
    expect(badge.className).toContain('whitespace-nowrap');
    expect(badge.className).toContain('text-loss-fg');
    expect(screen.getByText('Dernier résultat').className).toContain('whitespace-nowrap');
    vi.unstubAllGlobals();
  });
});
