// Map: 365scores teamId OR football-data teamId → wiki page name (clubs Ligue 1 2025-26)
// IDs football-data audités contre /api/fixtures live (2026-05-06).
// Avant : la table avait des IDs football-data inventés (511 → Le Havre alors que
// 511 = Toulouse côté football-data) → mauvaises résolutions wiki sur tout
// le composant TeamLogo (dashboard hero, match-card, last-result, cup-match-row).
const TEAM_WIKI_BY_ID: Record<number, string> = {
  // === 365scores IDs (utilisés par /api/standings, /api/cups, /api/season-matches) ===
  480: 'Paris Saint-Germain Football Club',
  481: 'Racing Club de Lens',
  478: 'Lille Olympique Sporting Club',
  477: 'Stade rennais Football Club',
  469: 'Olympique de Marseille',
  471: 'Association sportive de Monaco Football Club',
  479: 'Racing Club de Strasbourg Alsace',
  472: 'Football Club de Lorient',
  482: 'Toulouse Football Club',
  534: 'Stade brestois 29',
  6075: 'Paris Football Club',
  493: "Angers Sporting Club de l'Ouest",
  485: 'Havre Athletic Club',
  470: 'Olympique gymnaste club Nice',
  476: 'Association de la jeunesse auxerroise',
  486: 'Football Club de Nantes',
  484: 'Football Club de Metz',

  // === football-data IDs (utilisés par /api/fixtures) — OL=523 est partagé via remap ===
  // Source : curl http://nas:3002/api/fixtures (audit 2026-05-06).
  511: 'Toulouse Football Club',
  512: 'Stade brestois 29',
  516: 'Olympique de Marseille',
  519: 'Association de la jeunesse auxerroise',
  521: 'Lille Olympique Sporting Club',
  522: 'Olympique gymnaste club Nice',
  523: 'Olympique lyonnais',
  524: 'Paris Saint-Germain Football Club',
  525: 'Football Club de Lorient',
  529: 'Stade rennais Football Club',
  532: "Angers Sporting Club de l'Ouest",
  533: 'Havre Athletic Club',
  543: 'Football Club de Nantes',
  545: 'Football Club de Metz',
  546: 'Racing Club de Lens',
  548: 'Association sportive de Monaco Football Club',
  576: 'Racing Club de Strasbourg Alsace',
  1045: 'Paris Football Club',
};

export function teamWikiQuery(teamId: number, fallbackName: string): string {
  return TEAM_WIKI_BY_ID[teamId] ?? fallbackName;
}

export function teamShortName(name: string): string {
  return name
    .replace(/^(AS|RC|FC|SCO|OGC|OL|OM|PSG|AJ)\s+/i, '')
    .replace(/\s+(FC|SCO|OGC|OL|OM|AC)$/i, '')
    .trim();
}
