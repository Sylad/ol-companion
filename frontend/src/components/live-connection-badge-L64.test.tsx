import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LiveConnectionBadge } from './live-connection-badge';

const courant = vi.hoisted(() => ({ data: null as Record<string, unknown> | null | undefined }));
vi.mock('@/hooks/use-live-match', () => ({ useCurrentLiveMatch: () => courant }));

const match = (status: string, horloge: Partial<{ gameTimeDisplay: string; statusText: string; statusGroup: number }> = {}) => ({
  status,
  statusGroup: status === 'live' ? 3 : status === 'upcoming' ? 1 : 4,
  statusText: 'Deuxième mi-temps',
  gameTimeDisplay: "63'",
  ...horloge,
  home: { id: 465, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 2 },
  away: { id: 1, name: 'Nice', symbolicName: 'NIC', imageVersion: 1, score: 1 },
});

const TITRE = 'État du flux temps réel OL Companion';
const pastille = () => screen.getByTitle(TITRE).textContent ?? '';

afterEach(() => {
  cleanup();
  courant.data = null;
});

describe('Pastille du direct : score et minute (L64)', () => {
  it('R1 — pendant un match en cours, connecté, la pastille de la ligne collante porte le score et la minute', () => {
    courant.data = match('live');
    render(<LiveConnectionBadge status="connected" avecScore />);
    expect(pastille()).toContain("OL 2 · 1 NIC · 63'");
    expect(pastille()).toContain('Temps réel · connecté');
  });

  it('R2 — hors match en cours, ni score ni minute', () => {
    courant.data = match('upcoming');
    render(<LiveConnectionBadge status="connected" avecScore />);
    expect(pastille()).not.toContain("63'");
    cleanup();
    courant.data = match('live');
    render(<LiveConnectionBadge status="reconnecting" avecScore />);
    expect(pastille()).not.toContain("63'");
  });

  it('R3 — sans avecScore (barre latérale du bureau, 192 px), la pastille reste le seul état du flux, même en match', () => {
    courant.data = match('live');
    render(<LiveConnectionBadge status="connected" />);
    expect(pastille()).toBe('Temps réel · connecté');
  });

  it('R4 — la minute suit deriveClock : « MI-TEMPS » à la pause, « TAB » aux tirs au but, rien quand 365scores l’omet', () => {
    courant.data = match('live', { statusText: 'Halftime', gameTimeDisplay: "45'" });
    render(<LiveConnectionBadge status="connected" avecScore />);
    expect(pastille()).toContain('OL 2 · 1 NIC · MI-TEMPS');
    expect(pastille()).not.toContain("45'");
    cleanup();
    courant.data = match('live', { statusText: 'Tirs au but', gameTimeDisplay: "120'" });
    render(<LiveConnectionBadge status="connected" avecScore />);
    expect(pastille()).toContain('OL 2 · 1 NIC · TAB');
    cleanup();
    courant.data = match('live', { statusText: '', gameTimeDisplay: '' });
    render(<LiveConnectionBadge status="connected" avecScore />);
    expect(pastille()).toMatch(/OL 2 · 1 NIC$/);
  });

  it('R5 — la région role=status n’annonce que l’état du flux : score et minute sont hors de la région live', () => {
    courant.data = match('live');
    render(<LiveConnectionBadge status="connected" avecScore />);
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('Temps réel · connecté');
    expect(screen.getByTitle(TITRE).contains(region)).toBe(true);
    expect(screen.getByText(/63'/).closest('[role="status"]')).toBeNull();
  });
});
