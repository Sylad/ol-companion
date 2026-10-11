import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { RetryMessage } from './retry-message';

// L85 (revue, WCAG 2.4.3) : « Réessayer » disparaît pendant le nouvel appel, le focus ne retombe pas sur <body>.
function Bloc({ revient }: { revient: boolean }) {
  const [enCours, setEnCours] = useState(false);
  if (enCours) return <p role="status">Chargement…</p>;
  return (
    <RetryMessage
        message="Impossible de charger."
        messageTestId="m"
        buttonTestId="b"
        onRetry={() => {
          setEnCours(true);
          if (revient) setTimeout(() => setEnCours(false), 20);
        }}
    />
  );
}

describe('RetryMessage — focus clavier', () => {
  afterEach(() => vi.useRealTimers());

  it('un « Réessayer » affiché sans clic préalable ne prend pas le focus', () => {
    render(<Bloc revient={false} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('pendant le nouvel appel le focus reste dans la page, et revient sur « Réessayer » si l’erreur revient', async () => {
    render(<main><Bloc revient /></main>);
    screen.getByTestId('b').focus();
    fireEvent.click(screen.getByTestId('b'));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
    expect(screen.getByTestId('b')).toBe(document.activeElement);
  });
});
