import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { AppRouter } from './router';
import { registerServiceWorker } from './lib/pwa';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('root element not found');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  </StrictMode>,
);

// PWA: register the service worker once the app has mounted. Failure is
// non-fatal (cf. lib/pwa.ts) — the app still works without offline-shell
// or notifications.
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    void registerServiceWorker();
  });
}
