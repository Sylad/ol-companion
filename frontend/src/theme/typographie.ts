/**
 * L258 — échelle des tailles de texte, définie UNE fois, en rem (revue UX L255, M3).
 *
 * Toutes les tailles suivent la taille de police choisie dans le navigateur : la racine reste à 100 %
 * (`html { font-size: 100% }`, index.css), 1 rem = 16 px par défaut. Le plus petit pas de l'échelle,
 * `petite`, vaut 0,75 rem = 12 px : plus aucun texte à 8, 9, 10 ou 11 px.
 *
 * Branché sur Tailwind (`theme.extend.fontSize`, classes `text-petite`, `text-moyenne`, …) et sur
 * tailwind-merge (`cn`), et lu directement là où une taille passe par un style (Recharts, CSS).
 * Le test `typographie.test.ts` refuse toute taille de texte en px dans `src/` hors de ce fichier.
 * Les tailles par défaut de Tailwind (`text-xs` … `text-4xl`) sont déjà en rem et restent permises.
 */

/** Les trois pas du texte courant. */
export const TAILLE = {
  /** 12 px : plancher de toute donnée (pastilles, notes, libellés, axes). */
  petite: '0.75rem',
  /** 14 px. */
  moyenne: '0.875rem',
  /** 16 px. */
  grande: '1rem',
} as const;

/** Pas d'appoint, nommés par leur usage (tous ≥ 12 px). */
export const TAILLE_APPOINT = {
  /** 13 px : noms d'équipes du calendrier dense (L50, `calendrier-densite`). */
  dense: '0.8125rem',
  /** 34 px : titre des en-têtes de page au bureau. */
  titre: '2.125rem',
  /** 44 / 36 / 32 px : score de la page de match des Bleus. */
  score: '2.75rem',
  'score-md': '2.25rem',
  'score-sm': '2rem',
} as const;

/** Une entrée `fontSize` de Tailwind : taille, ou taille et réglages de ligne. */
type TailleTailwind = string | [string, Record<string, string>];

/** Grands titres (ex-`display-*` en px). */
export const TAILLE_AFFICHE: Record<string, [string, Record<string, string>]> = {
  'display-xl': ['6rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
  'display-lg': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.015em' }],
  'display-md': ['2rem', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
};

/** Interlignes associés aux trois pas (ceux de text-xs / text-sm / text-base). */
const INTERLIGNE = { petite: '1rem', moyenne: '1.25rem', grande: '1.5rem' } as const;

/** `theme.extend.fontSize` de Tailwind. */
export const fontSizeTailwind: Record<string, TailleTailwind> = {
  ...Object.fromEntries(Object.entries(TAILLE).map(([k, v]): [string, TailleTailwind] => [k, [v, { lineHeight: INTERLIGNE[k as keyof typeof INTERLIGNE] }]])),
  ...TAILLE_APPOINT,
  ...TAILLE_AFFICHE,
};

/** Noms des classes de taille ajoutées, pour tailwind-merge (sinon `text-petite` passerait pour une couleur). */
export const NOMS_TAILLES = Object.keys(fontSizeTailwind);

/**
 * Noms de joueurs dans une pastille de largeur fixe (composition de /match, L43 R8) : de la plus grande à la plus petite.
 * Départ à 12 px comme tout texte. Seule exception de l'app au plancher de 12 px : un nom d'UN mot plus large que sa
 * pastille (à 320 px une pastille offre 52 px : « Kalimuendo » en mesure 59 à 10 px) descend, à la mesure, par pas de
 * 0,5 px jusqu'à 8 px, car la règle L43 interdit de le couper en milieu de mot ou de le tronquer. Un nom qui tient garde 12 px.
 */
export const TAILLES_NOM_PASTILLE = Array.from({ length: 9 }, (_, i) => `${(12 - i * 0.5) / 16}rem`);
