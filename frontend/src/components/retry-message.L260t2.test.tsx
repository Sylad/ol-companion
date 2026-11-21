import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { PannesProvider, RetryMessage } from './retry-message';

// L260/t2 — revue de code de L260 : focus après « Réessayer » quand les pannes reviennent dans un autre ordre (M1),
// réannonce d'une panne revenue (M5), région vidée après l'annonce (m1), pannes espacées sans relecture (m2).

afterEach(cleanup);

const attendre = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const region = () => screen.getByTestId('annonce-pannes');

const A = 'Impossible de charger le prochain match.';
const B = 'Impossible de charger le classement.';

type Etat = 'panne' | 'chargement' | 'ok';

/** Deux blocs (A au-dessus de B) dont l'état est piloté de l'extérieur ; « Réessayer » les passe en chargement. */
function Page({ a, b, relancer }: { a: Etat; b: Etat; relancer: (bloc: 'a' | 'b') => void }) {
  const bloc = (etat: Etat, cle: 'a' | 'b', message: string) =>
    etat === 'panne' ? (
      <RetryMessage message={message} onRetry={() => relancer(cle)} messageTestId={`m-${cle}`} buttonTestId={`b-${cle}`} />
    ) : (
      <p role="status">{etat === 'chargement' ? 'Chargement…' : 'Chargé'}</p>
    );
  return (
    <main>
      <PannesProvider>
        <section>{bloc(a, 'a', A)}</section>
        <section>{bloc(b, 'b', B)}</section>
      </PannesProvider>
    </main>
  );
}

function Banc() {
  const [etats, setEtats] = useState<{ a: Etat; b: Etat }>({ a: 'panne', b: 'panne' });
  (Banc as unknown as { poser: typeof setEtats }).poser = setEtats;
  return <Page {...etats} relancer={(cle) => setEtats((e) => ({ ...e, [cle]: 'chargement' }))} />;
}
const poser = (e: { a: Etat; b: Etat }) => act(() => (Banc as unknown as { poser: (v: typeof e) => void }).poser(e));

describe('L260/t2 M1 — le focus ne retombe jamais sur body après « Réessayer »', () => {
  it('B (plus bas) retombe en panne avant A : focus sur b-b, puis sur b-a quand A devient le premier', async () => {
    render(<Banc />);
    await attendre(20);
    expect(screen.queryByTestId('b-b')).toBeNull(); // un seul « Réessayer », celui de A
    screen.getByTestId('b-a').focus();
    fireEvent.click(screen.getByTestId('b-a'));
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
    expect(document.activeElement).not.toBe(document.body);

    poser({ a: 'chargement', b: 'panne' });
    await attendre(40);
    expect(document.activeElement).toBe(screen.getByTestId('b-b'));

    poser({ a: 'panne', b: 'panne' });
    await attendre(40);
    expect(screen.queryByTestId('b-b')).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('b-a'));
  });

  it('A retombe en panne avant B : le focus reste sur b-a', async () => {
    render(<Banc />);
    await attendre(20);
    screen.getByTestId('b-a').focus();
    fireEvent.click(screen.getByTestId('b-a'));
    poser({ a: 'panne', b: 'chargement' });
    await attendre(40);
    expect(document.activeElement).toBe(screen.getByTestId('b-a'));
    poser({ a: 'panne', b: 'panne' });
    await attendre(40);
    expect(document.activeElement).toBe(screen.getByTestId('b-a'));
  });

  it('sans clic préalable, une panne qui change le bloc en tête ne prend pas le focus', async () => {
    render(<Banc />);
    poser({ a: 'chargement', b: 'panne' });
    await attendre(40);
    poser({ a: 'panne', b: 'panne' });
    await attendre(40);
    expect(document.activeElement).toBe(document.body);
  });
});

describe('L260/t2 — région annoncée', () => {
  it('M5 : une panne revenue après « Réessayer » est réannoncée (région vidée puis remplie)', async () => {
    const vus: string[] = [];
    const obs = new MutationObserver(() => {
      const t = document.querySelector('[data-testid="annonce-pannes"]')?.textContent ?? '';
      if (vus[vus.length - 1] !== t) vus.push(t);
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    render(<Banc />);
    poser({ a: 'panne', b: 'ok' });
    await attendre(300);
    expect(region().textContent).toBe(A);
    fireEvent.click(screen.getByTestId('b-a'));
    expect(region().textContent).toBe('');
    poser({ a: 'panne', b: 'ok' });
    await attendre(300);
    obs.disconnect();
    expect(region().textContent).toBe(A);
    expect(vus.filter((t) => t === A)).toHaveLength(2);
    expect(vus[vus.indexOf(A) + 1]).toBe('');
  });

  it('m1 : la région se vide quelques secondes après l’annonce (pas de seconde lecture au parcours)', async () => {
    render(<Banc />);
    poser({ a: 'panne', b: 'ok' });
    await attendre(300);
    expect(region().textContent).toBe(A);
    await attendre(7_100);
    expect(region().textContent).toBe('');
    expect(screen.getByTestId('m-a')).toHaveTextContent(A); // le message visible reste
  }, 10_000);

  it('m2 : une panne arrivée plus de 250 ms après la première n’annonce que la nouveauté', async () => {
    const vus: string[] = [];
    const obs = new MutationObserver(() => {
      const t = document.querySelector('[data-testid="annonce-pannes"]')?.textContent ?? '';
      if (t && vus[vus.length - 1] !== t) vus.push(t);
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    render(<Banc />);
    poser({ a: 'panne', b: 'ok' });
    await attendre(300);
    poser({ a: 'panne', b: 'panne' });
    await attendre(300);
    obs.disconnect();
    expect(vus).toEqual([A, 'Impossible aussi de charger le classement. « Réessayer » relance tout.']);
  });

  it('m2 : si le nouveau bloc en panne est plus haut, l’annonce complète porte son message', async () => {
    render(<Banc />);
    poser({ a: 'ok', b: 'panne' });
    await attendre(300);
    expect(region().textContent).toBe(B);
    poser({ a: 'panne', b: 'panne' });
    await attendre(300);
    expect(region().textContent).toBe(`${A} Impossible aussi de charger le classement. « Réessayer » relance tout.`);
  });
});
