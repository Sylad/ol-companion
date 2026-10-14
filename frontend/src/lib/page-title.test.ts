import { describe, expect, it } from 'vitest';
import { router } from '@/router';
import { pageTitle } from './page-title';

// L154 — WCAG 2.4.2 : chaque route a son titre de page, « <Page> · OL Companion ».
describe('pageTitle', () => {
  it('donne un titre propre à chaque page', () => {
    expect(pageTitle('/')).toBe('Dashboard · OL Companion');
    expect(pageTitle('/standings')).toBe('Classement · OL Companion');
    expect(pageTitle('/fixtures')).toBe('Calendrier · OL Companion');
    expect(pageTitle('/equipe-de-france')).toBe('Équipe de France · OL Companion');
    expect(pageTitle('/fcnoobz/jeux-video')).toBe('Jeux vidéo · OL Companion');
  });

  it('rattache les sous-pages paramétrées à leur page', () => {
    expect(pageTitle('/player/123')).toBe('Joueur · OL Companion');
    expect(pageTitle('/match/42')).toBe('Match · OL Companion');
  });

  it('ignore le slash final et se replie sur le nom de l’application', () => {
    expect(pageTitle('/standings/')).toBe('Classement · OL Companion');
    expect(pageTitle('/inconnue')).toBe('OL Companion');
  });

  it('couvre toutes les routes de l’application', () => {
    for (const p of Object.keys(router.routesByPath)) {
      const url = p.replace(/\$[A-Za-z]+/g, '1');
      expect(pageTitle(url), url).not.toBe('OL Companion');
    }
  });
});
