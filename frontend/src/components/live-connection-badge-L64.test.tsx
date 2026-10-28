import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LiveConnectionBadge } from './live-connection-badge';

const courant = vi.hoisted(() => ({ data: null as Record<string, unknown> | null | undefined }));
vi.mock('@/hooks/use-live-match', () => ({ useCurrentLiveMatch: () => courant }));

const match = (status: string) => ({
  status,
  gameTimeDisplay: "63'",
  home: { id: 465, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 2 },
  away: { id: 1, name: 'Nice', symbolicName: 'NIC', imageVersion: 1, score: 1 },
});

afterEach(() => {
  cleanup();
  courant.data = null;
});

describe('Pastille du direct : score et minute (L64)', () => {
  it('R1 — pendant un match en cours, connecté, la pastille porte le score et la minute', () => {
    courant.data = match('live');
    render(<LiveConnectionBadge status="connected" />);
    const texte = screen.getByRole('status').textContent ?? '';
    expect(texte).toContain("OL 2 · 1 NIC · 63'");
    expect(texte).toContain('Temps réel · connecté');
  });

  it('R2 — hors match en cours, ni score ni minute', () => {
    courant.data = match('upcoming');
    render(<LiveConnectionBadge status="connected" />);
    expect(screen.getByRole('status').textContent).not.toContain("63'");
    cleanup();
    courant.data = match('live');
    render(<LiveConnectionBadge status="reconnecting" />);
    expect(screen.getByRole('status').textContent).not.toContain("63'");
  });
});
