import { useEffect } from 'react';
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { NOT_FOUND_TITLE, pageTitle } from '@/lib/page-title';

const LIEN = 'inline-flex min-h-[44px] items-center rounded border border-border px-4 py-2 text-sm text-fg hover:text-fg-bright';

export function NotFoundPage() {
  // L260 : titre explicite (WCAG 2.4.2) ; le titre par chemin d'AppShell ne sait pas qu'une adresse est inconnue
  // (`/match` sans identifiant y serait « OL Companion »). Reposé à chaque adresse inconnue ; en partant, la page rend le
  // titre de l'adresse suivante (l'adresse change avant que la 404 ne soit démontée, AppShell ne le reposerait pas).
  const router = useRouter();
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    document.title = NOT_FOUND_TITLE;
    return () => {
      document.title = pageTitle(router.state.location.pathname);
    };
  }, [chemin, router]);
  return (
    <div className="mx-auto max-w-md space-y-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold text-fg-bright">Page introuvable</h1>
      <p className="text-fg-muted">Cette adresse ne mène à aucune page de l'application.</p>
      <div className="flex justify-center gap-3">
        <Link to="/" className={LIEN}>Accueil</Link>
        <Link to="/fixtures" className={LIEN}>Calendrier</Link>
      </div>
    </div>
  );
}
