import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LiveConnectionBadge } from './live-connection-badge';

const courant = vi.hoisted(() => ({ data: null as { status: string } | null | undefined }));
vi.mock('@/hooks/use-live-match', () => ({ useCurrentLiveMatch: () => courant }));

afterEach(() => {
  cleanup();
  courant.data = null;
});

function point(): HTMLElement {
  return screen.getByRole('status').querySelector('span') as HTMLElement;
}

describe('Pastille du flux temps réel (L208)', () => {
  it('R1 — hors match, le libellé dit l’état du flux : « Temps réel · connecté / reconnexion… / en attente »', () => {
    const attendus = {
      connected: 'Temps réel · connecté',
      reconnecting: 'Temps réel · reconnexion…',
      connecting: 'Temps réel · en attente',
    } as const;
    for (const [statut, libelle] of Object.entries(attendus)) {
      render(<LiveConnectionBadge status={statut as keyof typeof attendus} />);
      expect(screen.getByRole('status').textContent).toContain(libelle);
      cleanup();
    }
  });

  it('R2 — hors match, connecté : point neutre, sans animation ping, sans rouge', () => {
    render(<LiveConnectionBadge status="connected" />);
    const badge = screen.getByRole('status');
    expect(badge.querySelector('.animate-ping')).toBeNull();
    expect(point().className).not.toMatch(/ol-red/);
    expect(badge.className).not.toMatch(/ol-red/);
  });

  it('R3 — pendant un match en cours, connecté : point rouge et animation ping inchangés', () => {
    courant.data = { status: 'live' };
    render(<LiveConnectionBadge status="connected" />);
    const badge = screen.getByRole('status');
    expect(badge.querySelector('.animate-ping')).not.toBeNull();
    expect(point().className).toMatch(/bg-ol-red-bright/);
    expect(badge.textContent).toContain('Temps réel · connecté');
  });

  it('R4 — match à venir ou terminé : pas de rouge ; flux non connecté pendant un match : pas de ping', () => {
    courant.data = { status: 'upcoming' };
    render(<LiveConnectionBadge status="connected" />);
    expect(screen.getByRole('status').querySelector('.animate-ping')).toBeNull();
    cleanup();
    courant.data = { status: 'live' };
    render(<LiveConnectionBadge status="reconnecting" />);
    expect(screen.getByRole('status').querySelector('.animate-ping')).toBeNull();
    expect(point().className).not.toMatch(/ol-red/);
  });

  it('R5 — role=status annonce l’état (WCAG 4.1.3) ; title accentué', () => {
    render(<LiveConnectionBadge status="reconnecting" />);
    const badge = screen.getByRole('status');
    expect(badge.getAttribute('title')).toBe('État du flux temps réel OL Companion');
  });
});
