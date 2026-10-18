import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useLiveMatchStats } from './use-live-match';

// L181 — un 404 (match inconnu) n'est pas rejoué ; une panne (5xx, réseau) l'est une fois.
// Le vrai client et un fetch simulé : c'est le statut HTTP qui décide.

const fetchMock = vi.fn();
const reponse = (status: number) => ({ ok: status >= 200 && status < 300, status, json: async () => ({}) });

function monter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 1, retryDelay: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useLiveMatchStats(10, '465-1-10'), { wrapper });
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
