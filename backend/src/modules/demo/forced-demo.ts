import type { IncomingMessage } from 'http';

/**
 * Le mode démo FORCÉ (lecture seule verrouillée, PIN contourné) est-il actif
 * pour cette requête ?
 *
 * Décision (L14, 2026-09-28, même correctif que warhammer40k L22 et
 * finance-tracker L1) : on ne regarde QUE ce que le client ne peut pas choisir.
 *
 * - `X-Forwarded-Host` est IGNORÉ. Ni cloudflared ni le nginx du frontend
 *   (`frontend/nginx.conf`, qui ne pose que Host et X-Real-IP) ne le
 *   réécrivent : la valeur envoyée par le navigateur arrivait telle quelle au
 *   backend. La forger permettait de SORTIR de la démo forcée d'un tunnel
 *   (`X-Forwarded-Host: example.com`) ou d'y ENTRER depuis un hôte normal, ce
 *   qui contournait le PinGuard (les écritures restaient bloquées par
 *   DemoWriteGuard, mais uniquement parce que chaque route le couple au PIN).
 * - `Host` fait foi. Derrière le tunnel, c'est le nom routé par Cloudflare ; le
 *   nginx du frontend le recopie (`proxy_set_header Host $host`). Forger un
 *   Host démo en accès direct ne fait qu'ENTRER en démo : lecture seule.
 * - `forcedAll` (env `DEMO_FORCED=true`) force toute l'instance côté serveur,
 *   sans dépendre d'aucun en-tête. Désactivé par défaut.
 *
 * Fonction partagée par DemoModeMiddleware et PinGuard : une seule décision.
 */
export function isForcedDemoRequest(
  req: Pick<IncomingMessage, 'headers'>,
  forcedHosts: string[],
  forcedAll: boolean,
): boolean {
  if (forcedAll) return true;
  const host = normalizeHost(String(req.headers?.host ?? ''));
  if (!host) return false;
  return forcedHosts.some((p) => {
    const pattern = normalizeHost(p).replace(/^\.+/, ''); // `.trycloudflare.com` = même motif
    return pattern !== '' && (host === pattern || host.endsWith(`.${pattern}`));
  });
}

/**
 * Nom d'hôte comparable : casse ignorée, port retiré (`:443`, et `[::1]:3002`
 * pour une IPv6 littérale), point final (FQDN absolu) retiré. L'appariement se
 * fait ensuite en égalité exacte ou en suffixe précédé d'un point — jamais en
 * sous-chaîne, sinon `evil-trycloudflare.com` ou `trycloudflare.com.evil.net`
 * passeraient pour des hôtes de tunnel.
 */
function normalizeHost(raw: string): string {
  let h = raw.trim().toLowerCase();
  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    h = end === -1 ? h : h.slice(0, end + 1);
  } else {
    h = h.replace(/:\d*$/, '');
  }
  return h.replace(/\.+$/, '');
}
