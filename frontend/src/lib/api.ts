const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal });
  if (!res.ok) {
    throw new ApiError(res.status, `GET ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** 404 : la ressource n'existe pas (pour une fiche joueur : pas encore de minute cette saison). Une réponse, pas une panne : on ne la rejoue pas. */
export const estIntrouvable = (error: unknown): boolean => error instanceof ApiError && error.status === 404;
