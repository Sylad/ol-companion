/**
 * Hardcoded coordinates of the 18 Ligue 1 clubs for the 2025-2026 season.
 *
 * Why hardcoded: only 18 entries, set once a year, the alternative (geocoding
 * service) adds runtime cost + an external dep for ~zero benefit. Coords point
 * to the home stadium (more accurate than the city centre for clubs whose
 * stadium is in a suburb — Décines for OL, Villeneuve d'Ascq for Lille, etc.).
 *
 * Sources: Wikipedia FR (each stadium page) cross-checked with OpenStreetMap.
 * IDs come from the 365scores standings snapshot (audited 2026-05-06).
 */
export interface Ligue1Club {
  /** 365scores `competitor.id` — used to match standings/fixtures payloads. */
  id365: number;
  /** football-data.org team id when known (legacy compat for fixtures cache). */
  idFootballData?: number;
  /** Canonical display name (matches what 365scores returns). */
  name: string;
  /** City of the stadium (sometimes != city of the club, e.g. OL→Décines). */
  city: string;
  /** Stadium name. */
  stadium: string;
  /** Latitude (WGS84). */
  lat: number;
  /** Longitude (WGS84). */
  lng: number;
  /** 365scores image version for the logo CDN — kept here as a stable fallback
   *  (the live value comes from the standings response). */
  imageVersion?: number;
}

export const OL_ID_365 = 465;

/** Coords saison 2025-2026 — 18 clubs, ordre alphabétique pour la maintenance.
 * IDs football-data audités contre /api/fixtures live (2026-05-06) — auparavant
 * plusieurs IDs étaient inventés (Lille=521 OK mais Marseille=516 partagé avec
 * Metz=516, Nantes=522 partagé avec Nice=522, Toulouse=511 mais 511 mappait
 * Le Havre dans team-queries → mauvaises résolutions wiki).
 */
export const LIGUE1_CLUBS_COORDS: Ligue1Club[] = [
  { id365: 493, idFootballData: 532, name: 'Angers', city: 'Angers', stadium: 'Stade Raymond-Kopa', lat: 47.4607, lng: -0.5306 },
  { id365: 476, idFootballData: 519, name: 'Auxerre', city: 'Auxerre', stadium: "Stade Abbé-Deschamps", lat: 47.7872, lng: 3.5889 },
  { id365: 534, idFootballData: 512, name: 'Brest', city: 'Brest', stadium: 'Stade Francis-Le Blé', lat: 48.4029, lng: -4.4612 },
  { id365: 485, idFootballData: 533, name: 'Le Havre', city: 'Le Havre', stadium: 'Stade Océane', lat: 49.4988, lng: 0.1697 },
  { id365: 481, idFootballData: 546, name: 'Lens', city: 'Lens', stadium: 'Stade Bollaert-Delelis', lat: 50.4326, lng: 2.8154 },
  { id365: 478, idFootballData: 521, name: 'Lille', city: "Villeneuve-d'Ascq", stadium: 'Stade Pierre-Mauroy', lat: 50.6119, lng: 3.1306 },
  { id365: 472, idFootballData: 525, name: 'Lorient', city: 'Lorient', stadium: 'Stade du Moustoir', lat: 47.7491, lng: -3.3672 },
  { id365: 465, idFootballData: 523, name: 'Lyon', city: 'Décines-Charpieu', stadium: 'Groupama Stadium', lat: 45.7651, lng: 4.9822 },
  { id365: 484, idFootballData: 545, name: 'Metz', city: 'Metz', stadium: 'Stade Saint-Symphorien', lat: 49.1106, lng: 6.1602 },
  { id365: 471, idFootballData: 548, name: 'Monaco', city: 'Monaco', stadium: 'Stade Louis-II', lat: 43.7273, lng: 7.4154 },
  { id365: 486, idFootballData: 543, name: 'Nantes', city: 'Nantes', stadium: 'Stade de la Beaujoire', lat: 47.2562, lng: -1.5253 },
  { id365: 470, idFootballData: 522, name: 'OGC Nice', city: 'Nice', stadium: 'Allianz Riviera', lat: 43.7050, lng: 7.1925 },
  { id365: 469, idFootballData: 516, name: 'Olympique de Marseille', city: 'Marseille', stadium: 'Stade Vélodrome', lat: 43.2698, lng: 5.3958 },
  { id365: 6075, idFootballData: 1045, name: 'Paris FC', city: 'Paris (13e)', stadium: 'Stade Charléty', lat: 48.8197, lng: 2.3464 },
  { id365: 480, idFootballData: 524, name: 'PSG', city: 'Paris (16e)', stadium: 'Parc des Princes', lat: 48.8414, lng: 2.2530 },
  { id365: 477, idFootballData: 529, name: 'Rennes', city: 'Rennes', stadium: 'Roazhon Park', lat: 48.1075, lng: -1.7128 },
  { id365: 479, idFootballData: 576, name: 'Strasbourg', city: 'Strasbourg', stadium: 'Stade de la Meinau', lat: 48.5601, lng: 7.7547 },
  { id365: 482, idFootballData: 511, name: 'Toulouse', city: 'Toulouse', stadium: 'Stadium de Toulouse', lat: 43.5828, lng: 1.4341 },
];

export function findClubById365(id: number): Ligue1Club | undefined {
  return LIGUE1_CLUBS_COORDS.find((c) => c.id365 === id);
}

/** 365scores logo CDN — keeps file co-located with the IDs that feed it. */
export function clubLogoUrl(id365: number, imageVersion = 1): string {
  return `https://imagecache.365scores.com/image/upload/f_png,w_64,h_64,c_limit,q_auto:eco,dpr_2/v${imageVersion}/Competitors/${id365}`;
}
