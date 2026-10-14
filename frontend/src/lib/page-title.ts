const APP_NAME = 'OL Companion';

/** Titre court de chaque page, dans l'ordre : le premier préfixe qui correspond l'emporte. */
const PAGE_TITLES: readonly (readonly [prefix: string, title: string])[] = [
  ['/fixtures', 'Calendrier'],
  ['/standings', 'Classement'],
  ['/players', 'Joueurs'],
  ['/player/', 'Joueur'],
  ['/match/', 'Match'],
  ['/news', 'Actu'],
  ['/cups', 'Coupes'],
  ['/map', 'Carte L1'],
  ['/equipe-de-france', 'Équipe de France'],
  ['/fcnoobz/jeux-video', 'Jeux vidéo'],
  ['/fcnoobz', 'FC Noobz'],
  ['/nouveautes', 'Nouveautés'],
  ['/plan', 'Plan de travail'],
  ['/about', 'À propos'],
];

/** Titre du document pour un chemin (WCAG 2.4.2) : « Classement · OL Companion ». */
export function pageTitle(path: string): string {
  if (path === '/' || path === '') return `Dashboard · ${APP_NAME}`;
  const p = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const hit = PAGE_TITLES.find(([prefix]) =>
    prefix.endsWith('/') ? p.startsWith(prefix) : p === prefix || p.startsWith(`${prefix}/`),
  );
  return hit ? `${hit[1]} · ${APP_NAME}` : APP_NAME;
}
