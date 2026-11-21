import { act, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { PannesProvider } from '@/components/retry-message';

/**
 * L260/t2 (revue M2) — un message d'erreur `RetryMessage` n'est pas annoncé de la même façon selon qu'il est rendu seul
 * ou dans l'app : hors fournisseur, le message est en role=alert ; dans l'app (`AppShell` monte `PannesProvider`), il
 * n'a pas de rôle et c'est la région `annonce-pannes` (aria-live assertive) qui le dit, 250 ms après. Les tests d'état
 * d'erreur se jouent dans les deux modes : `wrapper` se passe à `render`, `erreurAnnoncee` vérifie l'annonce du mode.
 */
export const MODES_PANNES = [
  { mode: 'bloc seul (role=alert)', fournisseur: false, wrapper: undefined },
  { mode: 'dans l’app (PannesProvider, région annoncée)', fournisseur: true, wrapper: PannesProvider },
] as const;

const region = () => document.querySelector<HTMLElement>('[data-testid="annonce-pannes"]');

/** Le message d'erreur visible, après avoir vérifié qu'il est annoncé une fois, selon le mode. */
export async function erreurAnnoncee(fournisseur: boolean, texte: string | RegExp): Promise<HTMLElement> {
  if (!fournisseur) {
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent(texte);
    expect(region()).toBeNull();
    return alerte;
  }
  await waitFor(() => expect(region()).toHaveTextContent(texte));
  expect(screen.queryByRole('alert')).toBeNull(); // pas de double annonce
  const message = screen
    .getAllByText(texte)
    .find((e) => !region()!.contains(e));
  if (!message) throw new Error(`message visible « ${texte} » introuvable`);
  expect(message).not.toHaveAttribute('role');
  return message;
}

/** Aucun message d'erreur annoncé : ni role=alert, ni texte dans la région (attendue au-delà des 250 ms). */
export async function aucuneErreurAnnoncee(fournisseur: boolean): Promise<void> {
  expect(screen.queryByRole('alert')).toBeNull();
  if (!fournisseur) return;
  await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
  const r = region();
  expect(r).not.toBeNull();
  expect(r!.textContent).toBe('');
}
