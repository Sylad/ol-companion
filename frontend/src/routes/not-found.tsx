import { Link } from '@tanstack/react-router';

const LIEN = 'inline-flex min-h-[44px] items-center rounded border border-border px-4 py-2 text-sm text-fg hover:text-fg-bright';

export function NotFoundPage() {
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
