/**
 * 365scores anti-scraping requires browser-like headers (otherwise 403).
 * The Referer is the only field that meaningfully changes per endpoint;
 * all others are constant. See CLAUDE.md "365scores".
 */

const BASE = 'https://www.365scores.com/fr/football';

/**
 * Base URL of the 365scores JSON API (`/web/games/`, `/web/standings/`,
 * `/web/game/`, …) — scheme + host, no trailing slash. Every service builds its
 * URLs from it, including the relative `paging.previousPage` / `nextPage`
 * links, which carry no host.
 *
 * The host is written here and nowhere else in `backend/src` (guarded by
 * `scores365-host.spec.ts`): the former `data.` host stopped answering on
 * 2026-10-01 (timeouts, then HTTP 503) and it was copied in six services.
 */
export const SCORES365_API_BASE = 'https://webws.365scores.com';

export const SCORES365_REFERER = {
  default: BASE,
  team: `${BASE}/team/lyon-465`,
  ligue1: `${BASE}/league/ligue-1-35`,
} as const;

export type Scores365Referer = (typeof SCORES365_REFERER)[keyof typeof SCORES365_REFERER];

/**
 * Build the headers required by the 365scores API (`SCORES365_API_BASE`).
 * @param referer one of `SCORES365_REFERER.*` — defaults to the generic football page.
 */
export function scores365Headers(referer: Scores365Referer = SCORES365_REFERER.default): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'fr-FR,fr;q=0.9',
    'X-Domain': 'fr',
    'Referer': referer,
    'Origin': 'https://www.365scores.com',
  };
}
