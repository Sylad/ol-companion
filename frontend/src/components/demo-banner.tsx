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

  if (!data?.forced) return null;

  return (
    <div
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
