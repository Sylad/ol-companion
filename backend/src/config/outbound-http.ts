import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * L267 — l'app se présente sous son vrai nom à chaque appel sortant
 * (365scores, football-data, Wikipédia, flux RSS) : un `User-Agent` qui la
 * nomme et donne son adresse, jamais celui d'un navigateur, et aucun en-tête
 * qui se ferait passer pour le site d'une source (`Referer`, `Origin`,
 * `X-Domain`). Règle de Sylvain : aucun contournement anti-robot. Si une
 * source se met à refuser ce client honnête, l'app affiche son erreur et
 * l'on change de source ; on ne remet pas d'en-tête imité.
 * Étude : docs/etudes/365scores-conditions.md § 2.4.
 */

const PACKAGE_NAME = 'ol-companion-backend';

/**
 * Version du backend, lue dans son package.json (copié dans l'image Docker).
 * On remonte depuis ce fichier : `src/config/` en dev et sous Jest,
 * `dist/src/config/` une fois compilé.
 */
function readBackendVersion(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const file = path.join(dir, 'package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf-8')) as { name?: string; version?: string };
      if (pkg.name === PACKAGE_NAME && pkg.version) return pkg.version;
    } catch {
      // pas de package.json ici : on remonte
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.0.0';
}

export const APP_VERSION = readBackendVersion();

/** « ol-companion/<version> (+https://ol.sladoire.dev) ». */
export const APP_USER_AGENT = `ol-companion/${APP_VERSION} (+https://ol.sladoire.dev)`;

/** En-têtes communs à tout appel sortant, complétés au besoin (clé d'API…). */
export function outboundHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { 'User-Agent': APP_USER_AGENT, ...extra };
}
