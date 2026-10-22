/** 365scores envoie -1 ou 0 pour un numéro inconnu : seul un numéro > 0 s'affiche. */
export const hasJersey = (n: number | null | undefined): n is number => typeof n === 'number' && n > 0;
