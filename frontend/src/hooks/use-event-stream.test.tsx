import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEventStream } from './use-event-stream';

// L39 — l'heure fixée ou non d'un match de /api/season-matches est dérivée du
// calendrier football-data : quand celui-ci change, le calendrier de la saison
// doit être relu lui aussi.

class FakeEventSource {
  static last: FakeEventSource | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.last = this;
  }
  close() {}
}

function Probe() {
  useEventStream();
  return null;
}

describe('useEventStream', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('« fixtures-changed » invalide aussi le calendrier de la saison', () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );

    FakeEventSource.last!.onmessage!({ data: JSON.stringify({ type: 'fixtures-changed' }) });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(['fixtures']);
    expect(keys).toContainEqual(['season-matches']);
  });
});
