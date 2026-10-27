// L184 — après une livraison, un onglet resté ouvert réclame un module (assets/match-<ancien hash>.js)
// que le nouveau nginx ne sert plus. Recharger la page ramène l'index et les bons hash.

const CLE = 'olc-rechargement-module';
/** Délai pendant lequel un second rechargement est refusé : un module vraiment absent ne doit pas boucler. */
const FENETRE_MS = 60_000;

const MESSAGES_MODULE = [
  'Failed to fetch dynamically imported module', // Chrome, Edge
  'error loading dynamically imported module', // Firefox
  'Importing a module script failed', // Safari
  'Unable to preload CSS', // Vite, feuille de style d'un chunk
];

export function estErreurDeModule(erreur: unknown): boolean {
  return erreur instanceof Error && MESSAGES_MODULE.some((m) => erreur.message.includes(m));
}

interface Deps {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  recharger: () => void;
  maintenant: () => number;
}

function depsParDefaut(): Deps {
  return {
    storage: window.sessionStorage,
    recharger: () => window.location.reload(),
    maintenant: () => Date.now(),
  };
}

/**
 * Recharge la page, sauf si elle l'a déjà été pour la même raison il y a moins d'une minute.
 * Rend vrai si le rechargement est parti. Sans sessionStorage lisible la garde ne tiendrait pas : on ne recharge pas.
 */
export function rechargerUneFois(deps: Deps = depsParDefaut()): boolean {
  try {
    const dernier = Number(deps.storage.getItem(CLE));
    const t = deps.maintenant();
    if (dernier && t - dernier < FENETRE_MS) return false;
    deps.storage.setItem(CLE, String(t));
  } catch {
    return false;
  }
  deps.recharger();
  return true;
}

/**
 * Écoute `vite:preloadError` (préchargement d'un chunk échoué) : recharge une fois et neutralise l'erreur.
 * Hors ligne (L226) l'échec vient de la connexion, pas d'une livraison : rien n'est rechargé, l'erreur suit son cours.
 */
export function installerRechargementModule(cible: EventTarget = window, deps?: Deps): void {
  cible.addEventListener('vite:preloadError', (event) => {
    if (!navigator.onLine) return;
    if (rechargerUneFois(deps)) event.preventDefault();
  });
}
