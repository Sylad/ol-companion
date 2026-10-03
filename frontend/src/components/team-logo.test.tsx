import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamLogo } from './team-logo';

// L39 — un écusson dont l'adresse est connue (CDN 365scores) s'affiche sans
// passer par /api/wiki-image ; s'il ne charge pas, les initiales le remplacent.

function renderLogo(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('<TeamLogo />', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('avec une adresse fournie : affiche l’image, aucun appel à /api/wiki-image', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderLogo(<TeamLogo teamId={10} name="Crystal Palace" src="https://cdn.example/Competitors/10" />);

    expect(screen.getByRole('img', { name: 'Crystal Palace' })).toHaveAttribute(
      'src',
      'https://cdn.example/Competitors/10',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('image fournie en échec : repli sur les initiales', () => {
    vi.stubGlobal('fetch', vi.fn());
    renderLogo(<TeamLogo teamId={10} name="Crystal Palace" src="https://cdn.example/Competitors/10" />);

    fireEvent.error(screen.getByRole('img', { name: 'Crystal Palace' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Cr')).toBeInTheDocument();
  });

  it('sans adresse fournie : interroge /api/wiki-image comme avant', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => ({ imageUrl: 'https://wiki.example/lens.png' }) }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderLogo(<TeamLogo teamId={481} name="Lens" />);

    expect(await screen.findByRole('img', { name: 'Lens' })).toHaveAttribute('src', 'https://wiki.example/lens.png');
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/wiki-image?q=${encodeURIComponent('Racing Club de Lens')}`,
      expect.anything(),
    );
  });
});
