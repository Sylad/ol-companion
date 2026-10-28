import { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { useDemoStatus } from '@/hooks/use-demo-status';

/**
 * Slim banner shown at the top of every page when the backend reports the
 * current host as a forced-demo host (Cloudflare quick tunnel, public
 * showcase domain, …).
 *
 * Palette stricte OL : rouge + bleu seulement. Le badge utilise le rouge OL
 * (accent "vous êtes ici / important") et le surface-2 sombre comme fond.
 * Pas d'option "Quitter démo" — le mode est verrouillé côté backend.
 */
export function DemoBanner() {
  const { data } = useDemoStatus();
  const ref = useRef<HTMLDivElement>(null);
  const forced = Boolean(data?.forced);

  // L64 : le bandeau colle en haut ; les lignes collantes sous lui (pastille du direct, filtres du Calendrier) partent de sa hauteur.
  useEffect(() => {
    const bandeau = ref.current;
    if (!bandeau || typeof ResizeObserver === 'undefined') return;
    const racine = document.documentElement;
    const appliquer = () => racine.style.setProperty('--bandeau-demo-h', `${Math.ceil(bandeau.getBoundingClientRect().height)}px`);
    appliquer();
    const observateur = new ResizeObserver(appliquer);
    observateur.observe(bandeau);
    return () => {
      observateur.disconnect();
      racine.style.removeProperty('--bandeau-demo-h');
    };
  }, [forced]);

  if (!forced) return null;

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-ol-red/40 bg-surface-2/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-bright backdrop-blur-md"
      style={{
        boxShadow: '0 0 24px hsl(var(--ol-red) / 0.18)',
      }}
    >
      <Lock className="h-3 w-3 text-ol-red-bright" strokeWidth={2.5} aria-hidden />
      <span className="text-ol-red-bright">Mode démo verrouillée</span>
      <span className="hidden sm:inline text-fg-muted normal-case tracking-normal font-medium">
        — données publiques OL Companion, écritures désactivées
      </span>
    </div>
  );
}
