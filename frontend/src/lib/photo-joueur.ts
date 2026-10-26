// URL de la photo 365scores d'un athlète, ou null quand il n'en a pas (le repli est alors les initiales).
// 365scores met `imageVersion` à 1 pour un athlète sans image et l'URL répond 404 (9 athlètes sur 9 le 26-10) :
// ne pas la demander évite l'erreur réseau et console.
export function photoJoueurUrl(athleteId: number | null | undefined, imageVersion: number | null | undefined, taille: number): string | null {
  if (!athleteId || !imageVersion || imageVersion <= 1) return null;
  return `https://imagecache.365scores.com/image/upload/f_png,w_${taille},h_${taille},c_limit,r_max,q_auto:eco/v${imageVersion}/Athletes/${athleteId}`;
}
