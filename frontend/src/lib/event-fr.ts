/** Types d'événements de match → pictogramme + libellé français (page du match et carte du direct de l'accueil). */
// L260 : le pictogramme est décoratif, le texte porte le sens. Les deux sont séparés pour que l'écran masque l'émoji
// aux lecteurs d'écran (`aria-hidden`) : « ballon de football But » ou « carré jaune » ne se lisent plus.
const EVENT_LABEL: Record<string, { icone?: string; texte: string }> = {
  goal: { icone: '⚽', texte: 'But' },
  penalty_goal: { icone: '⚽', texte: 'But sur penalty' },
  own_goal: { icone: '⚽', texte: 'Csc' },
  yellow_card: { icone: '🟨', texte: 'Carton jaune' },
  red_card: { icone: '🟥', texte: 'Carton rouge' },
  second_yellow_red: { icone: '🟥', texte: '2e jaune' },
  card: { icone: '🟨', texte: 'Carton' },
  substitution: { icone: '↔', texte: 'Remplacement' },
  var: { texte: 'VAR' },
  goal_cancelled: { icone: '🚫', texte: 'But annulé (VAR)' },
  woodwork: { icone: '🥅', texte: 'Poteau' },
  penalty_missed: { icone: '❌', texte: 'Penalty raté' },
};

/** Pictogramme décoratif d'un événement (à masquer aux lecteurs d'écran), ou `undefined`. */
export function eventIconFr(type: string): string | undefined {
  return EVENT_LABEL[type]?.icone;
}

/** Libellé français d'un événement, sans pictogramme ; un type inconnu garde la description 365scores. */
export function eventTextFr(type: string, description: string): string {
  return EVENT_LABEL[type]?.texte ?? description;
}
