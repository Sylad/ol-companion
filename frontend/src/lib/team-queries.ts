// Map: 365scores teamId OR football-data teamId → wiki page name (clubs Ligue 1 2025-26)
// Les IDs ne se chevauchent pas (sauf OL=523 qui est intentionnellement partagé via remap backend).
const TEAM_WIKI_BY_ID: Record<number, string> = {
  // === 365scores IDs (utilisés par /api/standings) ===
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

  // === Adversaires fréquents en coupes européennes (365scores IDs) ===
  // À enrichir au fur et à mesure des tirages
  // Eredivisie / Bundesliga / Serie A / Liga / Premier League — clubs notables
  // (laisse vide pour l'instant, fallback wiki search via teamName)

  // === football-data IDs (utilisés par /api/fixtures) — OL=523 est partagé via remap ===
  523: 'Olympique lyonnais',
  524: 'Paris Saint-Germain Football Club',
  521: 'Olympique de Marseille',
  522: 'Association sportive de Monaco Football Club',
  511: 'Havre Athletic Club',
  519: 'Association de la jeunesse auxerroise',
  527: 'Lille Olympique Sporting Club',
  528: 'Football Club de Lorient',
  533: 'Racing Club de Lens',
  542: "Angers Sporting Club de l'Ouest",
  543: 'Football Club de Nantes',
  544: 'Toulouse Football Club',
  548: 'Stade rennais Football Club',
  549: 'Olympique gymnaste club Nice',
  559: 'Stade brestois 29',
  1062: 'Football Club de Metz',
  1063: 'Racing Club de Strasbourg Alsace',
  7793: 'Paris Football Club',
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
