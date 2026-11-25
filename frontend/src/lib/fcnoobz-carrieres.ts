// L121 — « Mes carrières » (/fcnoobz/carrieres) : types, lecture du fichier statique et écritures.
// Source : /fcnoobz-data/carrieres.json, produit par l'import local (scripts/fcnoobz-import.mjs, liste blanche
// dans scripts/fcnoobz-carrieres-schema.mjs) puis commité. Fiche : docs/specs/fcnoobz-carrieres/fiche.yaml.

export type Provenance = 'sauvegarde' | 'saisie';

export interface CarriereSaison {
  /** « 2025-2026 » ou « 2026 » (championnats sur une année civile). */
  saison: string;
  division: string;
  place?: number | null;
  titres?: string[];
  enCours?: boolean;
  provenance: Provenance;
}

export interface CarriereClub {
  club: string;
  saisons: CarriereSaison[];
}

export interface CarriereEdition {
  /** Numéro de l'édition : 21 pour Football Manager 21. */
  edition: number;
  clubs: CarriereClub[];
}

export interface CarrieresData {
  releveLe: string | null;
  editions: CarriereEdition[];
}

export const CARRIERES_URL = '/fcnoobz-data/carrieres.json';
export const PLACE_NON_RELEVEE = 'Place non relevée';

/** Même écriture que la page Jeux vidéo (« Football Manager 26 »). */
export function editionName(edition: number): string {
  return `Football Manager ${edition}`;
}

/** « 1er », « 3e » (R5). */
export function ordinal(place: number): string {
  return place === 1 ? '1er' : `${place}e`;
}

/** Place d'une saison (R5) : « 3e », « 3e pour l'instant », « Place non relevée ». */
export function placeText(s: Pick<CarriereSaison, 'place' | 'enCours'>): string {
  if (s.place == null) return PLACE_NON_RELEVEE;
  return s.enCours ? `${ordinal(s.place)} pour l’instant` : ordinal(s.place);
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** « 4 saisons · 2 titres » ; sans titre : « 4 saisons · aucun titre ». */
export function clubSummary(club: CarriereClub): string {
  const titres = club.saisons.reduce((n, s) => n + (s.titres?.length ?? 0), 0);
  return `${pluriel(club.saisons.length, 'saison')} · ${titres === 0 ? 'aucun titre' : pluriel(titres, 'titre')}`;
}

const debut = (s: CarriereSaison) => Number.parseInt(s.saison, 10);

/** Éditions récentes en tête, saisons chronologiques ; un club ou une édition sans saison n'est pas montré. */
export function sortCarrieres(data: CarrieresData): CarriereEdition[] {
  return data.editions
    .map((e) => ({
      edition: e.edition,
      clubs: e.clubs
        .filter((c) => c.saisons.length > 0)
        .map((c) => ({ club: c.club, saisons: [...c.saisons].sort((a, b) => debut(a) - debut(b)) })),
    }))
    .filter((e) => e.clubs.length > 0)
    .sort((a, b) => b.edition - a.edition);
}

/** « 25/11/2026 » */
export function formatReleve(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Ligne de provenance (R6), d'après les seules saisons montrées. */
export function provenanceText(releveLe: string | null, editions: CarriereEdition[]): string {
  const vues = new Set(editions.flatMap((e) => e.clubs.flatMap((c) => c.saisons.map((s) => s.provenance))));
  const parts: string[] = [];
  if (vues.has('sauvegarde')) parts.push('importé en local depuis les sauvegardes de Football Manager');
  if (vues.has('saisie')) parts.push('saisi à la main');
  const debutLigne = releveLe ? `Relevé du ${formatReleve(releveLe)}` : 'Relevé';
  return `${debutLigne}, ${parts.join(' et ')}.`;
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Forme minimale que la page sait dessiner (R2) : chaque édition a un numéro et des `clubs`, chaque club des
 * `saisons`, chaque saison son `saison`. Un fichier d'une autre forme (édité à la main, tronqué) est illisible :
 * la page montre l'erreur et « Réessayer », jamais une page qui plante au rendu.
 */
export function carrieresLisibles(body: unknown): body is Partial<CarrieresData> {
  if (!estObjet(body)) return false;
  if (body.editions === undefined) return true;
  if (!Array.isArray(body.editions)) return false;
  return body.editions.every(
    (e) =>
      estObjet(e) &&
      typeof e.edition === 'number' &&
      Array.isArray(e.clubs) &&
      e.clubs.every(
        (c) =>
          estObjet(c) &&
          typeof c.club === 'string' &&
          Array.isArray(c.saisons) &&
          c.saisons.every((s) => estObjet(s) && typeof s.saison === 'string'),
      ),
  );
}

export async function fetchCarrieres(signal?: AbortSignal): Promise<CarrieresData> {
  const res = await fetch(CARRIERES_URL, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body: unknown = await res.json();
  if (!carrieresLisibles(body)) throw new Error('Données illisibles');
  return { releveLe: body.releveLe ?? null, editions: body.editions ?? [] };
}
