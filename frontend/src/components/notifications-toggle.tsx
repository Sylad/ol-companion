import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import {
  notificationPermission,
  postNotification,
  registerServiceWorker,
  requestNotificationPermission,
} from '@/lib/pwa';
import {
  notificationsEnabled,
  setNotificationsEnabled,
} from '@/hooks/use-match-notifications';
import { cn } from '@/lib/utils';

type Status = 'on' | 'off' | 'denied' | 'unsupported';

function deriveStatus(): Status {
  const perm = notificationPermission();
  if (perm === 'unsupported') return 'unsupported';
  if (perm === 'denied') return 'denied';
  return notificationsEnabled() ? 'on' : 'off';
}

/**
 * Compact toggle that flips notifications opt-in on/off.
 *
 * - First click: requests system permission (if not already granted) AND
 *   sets the localStorage flag. We trigger a tiny test notification
 *   immediately so the user can confirm Android / Chrome popped it.
 * - Subsequent clicks toggle the localStorage flag (system permission
 *   stays granted but we just stop sending payloads).
 */
export function NotificationsToggle({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status>(() => 'off');

  // Initial status read happens in an effect to avoid SSR / hydration drift.
  useEffect(() => {
    setStatus(deriveStatus());
  }, []);

  const onClick = async () => {
    if (status === 'unsupported' || status === 'denied') return;

    if (status === 'off') {
      // Make sure the SW is alive — needed so the first showNotification
      // call resolves on iOS PWA / Android Chrome.
      await registerServiceWorker();
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'off');
        return;
      }
      setNotificationsEnabled(true);
      setStatus('on');
      // Friendly confirmation so the user knows the wiring works.
      await postNotification({
        title: 'OL Companion',
        body: 'Notifications activées — tu seras prévenu sur chaque but, carton rouge et coup d\'envoi.',
        tag: 'olc-test',
      });
      return;
    }

    // status === 'on' → just flip the flag off, keep the system permission.
    setNotificationsEnabled(false);
    setStatus('off');
  };

  const labels: Record<Status, { title: string; sub: string; icon: typeof Bell }> = {
    on: {
      title: 'Notifications match activées',
      sub: 'But, carton rouge, coup d\'envoi, fin de match',
      icon: BellRing,
    },
    off: {
      title: 'Activer les notifications',
      sub: 'Reçois une notif quand Lyon marque, prend un rouge ou démarre un match',
      icon: Bell,
    },
    denied: {
      title: 'Notifications bloquées',
      sub: 'Réactive-les depuis les réglages du navigateur (icône cadenas).',
      icon: BellOff,
    },
    unsupported: {
      title: 'Notifications non supportées',
      sub: 'Ton navigateur ne supporte pas les notifications web.',
      icon: BellOff,
    },
  };

  const { title, sub, icon: Icon } = labels[status];
  const interactive = status === 'on' || status === 'off';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        'w-full flex items-start gap-3 rounded-md border p-4 text-left transition-colors',
        status === 'on'
          ? 'border-ol-blue/40 bg-ol-blue/5 hover:bg-ol-blue/10'
          : status === 'off'
          ? 'border-border bg-surface hover:border-border-strong hover:bg-surface-2/40'
          : 'border-border bg-surface opacity-70 cursor-not-allowed',
        className,
      )}
      aria-pressed={status === 'on'}
    >
      <Icon
        className={cn(
          'h-5 w-5 mt-0.5 flex-shrink-0',
          status === 'on' ? 'text-ol-blue-bright' : 'text-fg-dim',
        )}
        strokeWidth={1.75}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-fg-bright leading-tight">{title}</div>
        <div className="text-xs text-fg-dim mt-0.5 leading-snug">{sub}</div>
      </div>
      {interactive && (
        <div
          className={cn(
            'mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
            status === 'on' ? 'bg-ol-blue text-white' : 'bg-surface-2 text-fg-muted border border-border',
          )}
        >
          {status === 'on' ? 'On' : 'Off'}
        </div>
      )}
    </button>
  );
}
