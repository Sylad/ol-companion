import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const perm = vi.hoisted(() => ({ value: 'default' as string }));
vi.mock('@/lib/pwa', () => ({
  notificationPermission: () => perm.value,
  postNotification: vi.fn(),
  registerServiceWorker: vi.fn(),
  requestNotificationPermission: vi.fn(),
}));

import { NotificationsToggle } from './notifications-toggle';

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

describe('NotificationsToggle (L201)', () => {
  for (const [etat, titre] of [
    ['denied', 'Notifications bloquées'],
    ['unsupported', 'Notifications non supportées'],
  ] as const) {
    describe(etat, () => {
      beforeEach(() => {
        perm.value = etat;
      });

      it('R1 — la consigne est annoncée dans un bloc role=status, pas dans un bouton désactivé', async () => {
        render(<NotificationsToggle />);
        const bloc = await screen.findByRole('status');
        expect(bloc.textContent).toContain(titre);
        expect(screen.queryByRole('button')).toBeNull();
      });

      it('R2 — la consigne n’est pas estompée (ni opacity-70, ni text-fg-dim : 3,0:1 mesuré)', async () => {
        const { container } = render(<NotificationsToggle />);
        await screen.findByRole('status');
        expect(container.innerHTML).not.toMatch(/opacity-70/);
        expect(container.innerHTML).not.toMatch(/text-fg-dim/);
        expect(container.innerHTML).toMatch(/text-fg-muted/);
      });
    });
  }

  it('R3 — activable ou désactivable : reste un bouton à bascule, sans role=status', async () => {
    perm.value = 'default';
    render(<NotificationsToggle />);
    const bouton = await screen.findByRole('button', { name: /Activer les notifications/ });
    expect(bouton.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
