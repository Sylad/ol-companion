// Journal des Nouveautés généré par `cadence news build` (cd frontend && npm run news) :
// les entrées vivent dans docs/nouveautes/, le résultat est versionné dans
// public/nouveautes-data/ (la CI n'a pas cadence) et servi en statique par nginx.
// L'ordre (la plus récente en haut, départage sur `created`) est celui du JSON.
// Partagé par la page /nouveautes et la pastille « nouveau » de la navigation (L22).
export const NEWS_BASE = '/nouveautes-data';
export const NEWS_QUERY_KEY = ['nouveautes'] as const;

export interface NewsEntry {
  slug: string;
  title: string;
  date: string;
  lots: string[];
  captures: string[];
  html: string;
}

export interface NewsData {
  project: string;
  generated: string;
  entries: NewsEntry[];
}

export type Sizes = Record<string, [number, number]>;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function fetchNews(): Promise<{ news: NewsData | null; sizes: Sizes }> {
  const [news, sizes] = await Promise.all([
    getJson<NewsData>(`${NEWS_BASE}/nouveautes.json`),
    getJson<Sizes>(`${NEWS_BASE}/tailles.json`),
  ]);
  return { news, sizes: sizes ?? {} };
}
