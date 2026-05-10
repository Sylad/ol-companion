/**
 * Tiny PWA helper. Two responsibilities:
 *  1. Register `/sw.js` once at app boot (only if the browser supports SW
 *     and we're served over HTTPS or localhost — Firefox / iOS WebView
 *     will silently ignore registration on http://nas:4202 anyway).
 *  2. Expose `postNotification(...)` which forwards a payload to the SW
 *     so it can call `showNotification`. Falls back to a direct
 *     Notification ctor when no SW is available (e.g. dev without a
 *     reachable HTTPS).
 */

export interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  data?: { url?: string; gameId?: number };
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registrationPromise) return registrationPromise;

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    registrationPromise = Promise.resolve(null);
    return registrationPromise;
  }

  registrationPromise = navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => reg)
    .catch((err) => {
      // Don't crash the app if the SW fails to register (private browsing,
      // unsupported scheme, etc.). We only lose offline-shell + notifications.
      // eslint-disable-next-line no-console
      console.warn('[OLC] SW registration failed:', err);
      return null;
    });

  return registrationPromise;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

/**
 * Send a notification through the service worker (preferred — supports
 * actions, persistence and works even when the tab is in background) or
 * fall back to the synchronous Notification ctor when no SW is alive.
 *
 * Returns `true` when a notification was actually shown.
 */
export async function postNotification(payload: NotificationPayload): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const reg = await registerServiceWorker();
  const message = {
    type: 'notify' as const,
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    data: payload.data ?? {},
  };

  if (reg?.active) {
    reg.active.postMessage(message);
    return true;
  }

  // Fallback for browsers without an active SW (or registration just failed).
  try {
    new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icon.png',
      badge: '/icon.png',
      data: payload.data ?? {},
    });
    return true;
  } catch {
    return false;
  }
}
