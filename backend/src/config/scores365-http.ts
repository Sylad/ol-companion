/**
 * 365scores anti-scraping requires browser-like headers (otherwise 403).
 * The Referer is the only field that meaningfully changes per endpoint;
 * all others are constant. See CLAUDE.md "365scores".
 */

const BASE = 'https://www.365scores.com/fr/football';

export const SCORES365_REFERER = {
  default: BASE,
  team: `${BASE}/team/lyon-465`,
  ligue1: `${BASE}/league/ligue-1-35`,
} as const;

export type Scores365Referer = (typeof SCORES365_REFERER)[keyof typeof SCORES365_REFERER];

/**
 * Build the headers required by data.365scores.com endpoints.
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
