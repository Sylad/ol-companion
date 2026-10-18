import { useEffect } from 'react';
import { estErreurDeModule, rechargerUneFois } from '../lib/rechargement-module';

interface Props {
  error: unknown;
  reset?: () => void;
  /** Rechargement de la page ; injectable pour les tests. */
  recharger?: () => void;
}

const BOUTON = 'inline-flex min-h-[44px] items-center rounded border border-border px-4 py-2 text-sm text-fg hover:text-fg-bright';

/**
 * Écran d'erreur des routes (defaultErrorComponent) : en français, jamais « Something went wrong! ».
 * Un module introuvable (nouvelle livraison pendant que l'onglet était ouvert) recharge la page une fois,
 * la garde de `rechargerUneFois` évitant la boucle ; ensuite, ou pour toute autre erreur, bouton « Recharger ».
 */
export function ErreurPage({ error, recharger = () => window.location.reload() }: Props) {
  const module = estErreurDeModule(error);
  useEffect(() => {
    if (module) rechargerUneFois();
  }, [module]);

  return (
    <div role="alert" className="mx-auto max-w-md space-y-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold text-fg-bright">
        {module ? 'Une nouvelle version est disponible' : 'Un problème est survenu'}
      </h1>
      <p className="text-fg-muted">
        {module
          ? "L'application a été mise à jour pendant que cette page était ouverte. Rechargez-la pour continuer."
          : "Cette page n'a pas pu s'afficher. Rechargez-la ; si le problème revient, réessayez dans quelques minutes."}
      </p>
      <button type="button" className={BOUTON} onClick={recharger}>Recharger</button>
    </div>
  );
}
