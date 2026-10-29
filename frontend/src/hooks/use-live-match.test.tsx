import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useLiveMatchStats } from './use-live-match';

// L181 — un 404 (match inconnu) n'est pas rejoué ; une panne (5xx, réseau) l'est une fois.
// Le vrai client et un fetch simulé : c'est le statut HTTP qui décide.

const fetchMock = vi.fn();
const reponse = (status: number) => ({ ok: status >= 200 && status < 300, status, json: async () => ({}) });

function monter(gameId: number | null = 10, matchupId: string | null = '465-1-10') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 1, retryDelay: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useLiveMatchStats(gameId, matchupId), { wrapper });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('useLiveMatchStats — nouvel essai (L181)', () => {
  it('un 404 n\'est pas rejoué : un seul appel', async () => {
    fetchMock.mockResolvedValue(reponse(404));
    const { result } = monter();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('une panne 503 est rejouée une fois : deux appels', async () => {
    fetchMock.mockResolvedValue(reponse(503));
    const { result } = monter();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// L80 — « Chargement du match… » sans requête : la requête part dès que le match ET le matchupId sont connus, et seulement alors.
describe('useLiveMatchStats — départ de la requête (L80)', () => {
  it('R1 — avec gameId et matchupId la requête stats part au premier rendu, sur la bonne URL', async () => {
    fetchMock.mockResolvedValue(reponse(200));
    const { result } = monter();
    expect(result.current.fetchStatus).toBe('fetching');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/live-match/10/stats?matchupId=465-1-10');
  });

  it.each([
    ['sans matchupId', 10, null],
    ['avec un gameId absent', null, '465-1-10'],
    ['avec un gameId à 0', 0, '465-1-10'],
  ])('R2 — %s : aucune requête, et pas de chargement annoncé', (_nom, gameId, matchupId) => {
    const { result } = monter(gameId, matchupId);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isLoading).toBe(false);
  });

  it('R3 — la clé de la requête change avec le matchupId : un autre match refait un appel', async () => {
    fetchMock.mockResolvedValue(reponse(200));
    const client = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(({ m }: { m: string }) => useLiveMatchStats(10, m), { wrapper, initialProps: { m: '465-1-10' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ m: '465-2-10' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toContain('matchupId=465-2-10');
  });
});
