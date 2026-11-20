import { outboundHeaders } from './outbound-http';

/**
 * En-têtes des appels à 365scores (L267) : l'app se nomme (`APP_USER_AGENT`),
 * demande du JSON en français, et rien d'autre. Ni User-Agent de navigateur,
 * ni `Referer` / `Origin` / `X-Domain` imitant le site de 365scores : mesuré
 * le 2026-11-20, chaque famille d'appels répond 200 sans eux
 * (docs/etudes/365scores-conditions.md § 2.3). Si 365scores refuse un jour ce
 * client honnête, on ne les remet pas (règle « aucun contournement anti-robot »).
 */

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

/** En-têtes de tout appel à `SCORES365_API_BASE` (et au flux play-by-play). */
export function scores365Headers(): Record<string, string> {
  return outboundHeaders({
    'Accept': 'application/json',
    'Accept-Language': 'fr-FR,fr;q=0.9',
  });
}
