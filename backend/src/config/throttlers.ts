/**
 * Seaux de la limite de débit par visiteur (voir ClientIpThrottlerGuard).
 *
 * Défaut : 10/s pour absorber les rafales de l'interface, 60/min contre les
 * abus (365scores pourrait nous bannir si on relaie trop). Les endpoints
 * servis depuis un cache serveur et appelés une fois par logo (wiki-image,
 * L32) surchargent ces valeurs avec `WIKI_IMAGE_THROTTLE`.
 */
export const THROTTLERS = [
  { name: 'short', ttl: 1000, limit: 10 },
  { name: 'long', ttl: 60_000, limit: 60 },
];

/**
 * L32 : /standings = 26 appels /api en 250 ms dont ~20 logos ; la limite par
 * défaut en refusait 12. 40/s absorbe une page de logos, 300/min laisse une
 * dizaine de pages par minute ; au-delà c'est du martèlement (l'amont, la
 * Wikipédia FR, n'est interrogé qu'à chaque clé absente du cache serveur).
 */
export const WIKI_IMAGE_THROTTLE = {
  short: { ttl: 1000, limit: 40 },
  long: { ttl: 60_000, limit: 300 },
};
