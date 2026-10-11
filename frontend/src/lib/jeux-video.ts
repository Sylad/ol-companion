// L25 — page « Jeux vidéo » : types, lecture du fichier statique et écriture des dates.
// Source : /jeux-video-data/football-manager.json (public/, relu sur footballmanager.com à la main).

export interface JeuxVideoEdition {
  nom: string;
  /** AAAA-MM-JJ, ou null tant que la date n'est pas annoncée. */
  date: string | null;
}

export interface JeuxVideoData {
  verifieLe: string;
  sources: string[];
  prochaineSortie: (JeuxVideoEdition & { plateformes?: string }) | null;
  editions: { nom: string; date: string }[];
  nouveautes: { titre: string; description: string }[];
}

export const JEUX_VIDEO_URL = '/jeux-video-data/football-manager.json';
export const DATE_A_CONFIRMER = 'Date à confirmer';

const WEEKDAY_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** « Mar. 03/11/2026 » : le jour de la semaine est calculé (UTC, sans fuseau), jamais saisi. */
export function formatSortie(iso: string | null | undefined): string {
  const m = iso ? ISO.exec(iso) : null;
  if (!m) return DATE_A_CONFIRMER;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${m[3]}/${m[2]}/${m[1]}`;
}

/** « 11/10/2026 » */
export function formatVerifie(iso: string): string {
  const m = ISO.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export async function fetchJeuxVideo(signal?: AbortSignal): Promise<JeuxVideoData> {
  const res = await fetch(JEUX_VIDEO_URL, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as Partial<JeuxVideoData> | null;
  if (!body || typeof body !== 'object') throw new Error('Données illisibles');
  return {
    verifieLe: body.verifieLe ?? '',
    sources: body.sources ?? [],
    prochaineSortie: body.prochaineSortie ?? null,
    editions: body.editions ?? [],
    nouveautes: body.nouveautes ?? [],
  };
}
