/** Types d'événements de match → libellé français (page du match et carte du direct de l'accueil). */
const EVENT_LABEL: Record<string, string> = {
  goal: '⚽ But',
  penalty_goal: '⚽ But sur penalty',
  own_goal: '⚽ Csc',
  yellow_card: '🟨 Carton jaune',
  red_card: '🟥 Carton rouge',
  second_yellow_red: '🟥 2e jaune',
  card: '🟨 Carton',
  substitution: '↔ Remplacement',
  var: 'VAR',
  goal_cancelled: '🚫 But annulé (VAR)',
  woodwork: '🥅 Poteau',
  penalty_missed: '❌ Penalty raté',
};

/** Libellé français d'un événement ; un type inconnu garde la description 365scores. */
export function eventLabelFr(type: string, description: string): string {
  return EVENT_LABEL[type] ?? description;
}
