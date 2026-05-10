/* eslint-env serviceworker */
/**
 * OL Companion service worker.
 *
 * Scope: minimum PWA install + push-style notifications driven by the page
 * (postMessage), NOT by web-push. The frontend's `useMatchNotifications` hook
 * watches `live-match-changed` SSE events and posts `{type: 'notify', …}` to
 * this worker, which in turn calls `showNotification`. This works equally
 * well on Android, desktop Chrome, and (with limitations) iOS PWA.
 *
 * We don't aggressively pre-cache the app — the bundle changes on every
 * deploy and the live data must always hit the backend. We only cache the
 * shell (icon + manifest) so the install screen renders even offline.
 */

const SHELL_CACHE = 'olc-shell-v1';
const SHELL_FILES = ['/icon.png', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

/**
 * Network-first for navigations (always fresh app shell when online), with
 * a cache fallback for the icon/manifest. Anything else passes through to
 * the network — we never cache `/api/*`.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return; // never intercept API calls
  if (SHELL_FILES.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
  }
});

/**
 * Page-driven notifications. Payload shape:
 *   { type: 'notify', title: string, body: string, tag?: string,
 *     data?: { url?: string, gameId?: number } }
 */
self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data || data.type !== 'notify') return;

  const title = String(data.title ?? 'OL Companion');
  const options = {
    body: String(data.body ?? ''),
    tag: typeof data.tag === 'string' ? data.tag : 'olc-match',
    icon: '/icon.png',
    badge: '/icon.png',
    renotify: true,
    requireInteraction: false,
    data: data.data ?? {},
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.endsWith(target) && 'focus' in w) return w.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    }),
  );
});
