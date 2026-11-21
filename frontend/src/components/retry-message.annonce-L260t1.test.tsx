import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PannesProvider, RetryMessage } from './retry-message';
import { NewsPage } from '@/routes/news';

// L260/t1 — revue UX de L260, M1 (WCAG 4.1.3, messages d'état) : en panne groupée, le récapitulatif
// « Impossible aussi de charger … « Réessayer » relance tout. » doit être annoncé aux lecteurs d'écran,
// dans la même annonce que le message du bloc qui porte « Réessayer », sans doubler les annonces.

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Régions annoncées (alert, status, aria-live actif) qui portent du texte. */
function annonces(racine: ParentNode = document.body): HTMLElement[] {
  return [...racine.querySelectorAll<HTMLElement>('[role="alert"], [role="status"], [aria-live]:not([aria-live="off"])')]
    .filter((e) => (e.textContent ?? '').trim() !== '');
}

const MATCH = 'Impossible de charger le prochain match.';
const RECAP = "Impossible aussi de charger le classement et l'évolution du classement. « Réessayer » relance tout.";

function Blocs({ n }: { n: number }) {
  const blocs = [
    <RetryMessage key="1" message={MATCH} onRetry={() => {}} messageTestId="m1" buttonTestId="b1" />,
    <RetryMessage key="2" message="Impossible de charger le classement." onRetry={() => {}} messageTestId="m2" buttonTestId="b2" />,
    <RetryMessage key="3" message="Impossible de charger l'évolution du classement." onRetry={() => {}} messageTestId="m3" buttonTestId="b3" />,
  ];
  return (
    <main>
      <PannesProvider>{blocs.slice(0, n)}</PannesProvider>
    </main>
  );
}

const attendre = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

describe('L260/t1 — le récapitulatif des pannes groupées est annoncé (WCAG 4.1.3)', () => {
  it('trois blocs en panne : UNE seule région annoncée, qui dit le message ET le récapitulatif', async () => {
    render(<Blocs n={3} />);
    await waitFor(() => {
      const regions = annonces();
      expect(regions).toHaveLength(1);
      expect(regions[0].textContent).toContain(MATCH);
      expect(regions[0].textContent).toContain(RECAP);
    });
    // Le récapitulatif reste visible sous le message, comme avant.
    expect(screen.getByTestId('pannes-groupees')).toHaveTextContent(RECAP);
  });

  it('des pannes qui arrivent l’une après l’autre ne font qu’une annonce, la complète', async () => {
    const vus: string[] = [];
    const noter = () => {
      for (const r of annonces()) if (vus[vus.length - 1] !== r.textContent) vus.push(r.textContent ?? '');
    };
    const obs = new MutationObserver(noter);
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    const { rerender } = render(<Blocs n={1} />);
    await attendre(30);
    rerender(<Blocs n={2} />);
    await attendre(30);
    rerender(<Blocs n={3} />);
    await waitFor(() => expect(annonces()[0]?.textContent).toContain(RECAP));
    await attendre(50);
    obs.disconnect();
    expect(vus).toEqual([`${MATCH} ${RECAP}`]);
  });

  it('un bloc seul : son message est annoncé une fois, sans récapitulatif', async () => {
    render(<Blocs n={1} />);
    await waitFor(() => expect(annonces().map((r) => r.textContent)).toEqual([MATCH]));
  });

  it('hors du fournisseur (bloc seul), le message garde role=alert', () => {
    render(<RetryMessage message={MATCH} onRetry={() => {}} messageTestId="m" buttonTestId="b" />);
    expect(screen.getByTestId('m')).toHaveAttribute('role', 'alert');
  });

  it('/news en panne (articles et chaînes) dans le fournisseur : une annonce avec le récapitulatif', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PannesProvider>
          <NewsPage />
        </PannesProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      const regions = annonces();
      expect(regions).toHaveLength(1);
      expect(regions[0].textContent).toMatch(/Impossible de charger .+\. Impossible aussi de charger .+\. « Réessayer » relance tout\./);
    });
  });
});
