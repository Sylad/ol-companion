// Identification d'OL par NOM d'équipe (payloads coupes sans teamId).
// Durci contre le drift de libellés documenté dans ligue1-club-match.ts :
// « Lyon », « Olympique Lyonnais », « OL », espaces parasites.
export function isOlTeamName(name: string | null | undefined): boolean {
  const n = (name ?? '').toLowerCase().trim();
  return n === 'lyon' || n === 'ol' || n.includes('lyonnais') || n.startsWith('olympique lyon');
}
