import { afterEach, describe, expect, it, vi } from 'vitest';
import L from 'leaflet';
import { LIGUE1_CLUBS_COORDS } from '@/lib/ligue1-clubs-coords';
import { markerNudge } from '@/lib/ligue1-map-hit';
import {
  MAX_ZOOM,
  ZOOM_SNAP,
  clubsBounds,
  followResize,
  frameFrance,
} from '@/lib/ligue1-map-view';

// L192 — jsdom ne mesure rien : la taille de la carte est posée sur l'élément, Leaflet fait le reste
// (projection, zoom d'ajustement) comme dans le navigateur.

let host: HTMLDivElement | null = null;

function makeMap(width: number, height: number): L.Map {
  host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(host, 'clientHeight', { value: height, configurable: true });
  document.body.appendChild(host);
  const map = L.map(host, {
    zoomSnap: ZOOM_SNAP,
    maxZoom: MAX_ZOOM,
    maxBoundsViscosity: 1,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
  });
  frameFrance(map);
  return map;
}

afterEach(() => {
  host?.remove();
  host = null;
});

// Chaque marqueur (18 px avec son halo) est entier dans la carte, pas seulement son centre.
function expectEveryClubInside(map: L.Map) {
  const { x: width, y: height } = map.getSize();
  const half = 9;
  for (const club of LIGUE1_CLUBS_COORDS) {
    const pt = map.latLngToContainerPoint([club.lat, club.lng]);
    expect(pt.x, club.name).toBeGreaterThanOrEqual(half);
    expect(pt.x, club.name).toBeLessThanOrEqual(width - half);
    expect(pt.y, club.name).toBeGreaterThanOrEqual(half);
    expect(pt.y, club.name).toBeLessThanOrEqual(height - half);
  }
}

// Conteneur de la carte à 1440 × 900 : enveloppe de l'app (barre de 240 px, marges de 32 px,
// padding de 20 px) pour la largeur, min(72vh, 720px) pour la hauteur — mesuré dans Chromium.
const DESKTOP = { width: 1092, height: 648 };
const PHONE = { width: 330, height: 608 };

describe('Carte L1 — cadrage de la France (L192)', () => {
  it('R1 — à 1440×900 la carte s’ouvre à un zoom d’au moins 6, les 18 marqueurs dans la vue', () => {
    const map = makeMap(DESKTOP.width, DESKTOP.height);
    expect(LIGUE1_CLUBS_COORDS).toHaveLength(18);
    expect(map.getZoom()).toBeGreaterThanOrEqual(6);
    expectEveryClubInside(map);
  });

  it('R1b — la France est centrée dans la carte : même marge en haut et en bas, marqueurs écartés compris (L193, L197)', () => {
    const map = makeMap(DESKTOP.width, DESKTOP.height);
    const ys = LIGUE1_CLUBS_COORDS.map((c) => map.latLngToContainerPoint([c.lat, c.lng]).y + markerNudge(c.id365)[1]);
    expect(Math.min(...ys)).toBeCloseTo(DESKTOP.height - Math.max(...ys), 0);
  });

  it('R2 — à 390 px la France tient encore entière, à un zoom plus bas', () => {
    const map = makeMap(PHONE.width, PHONE.height);
    expect(map.getZoom()).toBeLessThan(6);
    expectEveryClubInside(map);
  });

  it('R3 — le zoom arrière s’arrête au cadrage de la France', () => {
    const map = makeMap(DESKTOP.width, DESKTOP.height);
    const framed = map.getZoom();
    map.setZoom(2, { animate: false });
    expect(map.getZoom()).toBe(framed);
    expect(map.getMinZoom()).toBe(framed);
  });

  it('R4 — le zoom avant est borné', () => {
    const map = makeMap(DESKTOP.width, DESKTOP.height);
    map.setZoom(18, { animate: false });
    expect(map.getZoom()).toBe(MAX_ZOOM);
  });

  it('R5 — le glisser reste sur la vue d’ouverture : à l’ouverture rien ne bouge, plus près la vue ne la quitte pas', () => {
    const map = makeMap(DESKTOP.width, DESKTOP.height);
    const centre = map.getCenter();
    map.panBy([-50_000, 50_000], { animate: false });
    // Au pixel près (jeu de 1 px de la limite) : le glisser de 50 000 px n'a rien déplacé.
    expect(map.getCenter().lat).toBeCloseTo(centre.lat, 1);
    expect(map.getCenter().lng).toBeCloseTo(centre.lng, 1);
    const ouverture = map.getBounds().pad(0.02);
    map.setZoom(map.getZoom() + 3, { animate: false });
    for (const [dx, dy] of [[-50_000, 0], [100_000, 0], [0, -50_000], [0, 100_000]]) {
      map.panBy([dx, dy], { animate: false });
      const vue = map.getBounds();
      expect(ouverture.contains(vue.getSouthWest()) && ouverture.contains(vue.getNorthEast())).toBe(true);
    }
  });

  it('R5b — téléphone en portrait, la vue d’ouverture garde les clubs : aucune borne ne la laisse partir en Pologne', () => {
    const map = makeMap(PHONE.width, PHONE.height);
    const ouverture = map.getBounds().pad(0.02);
    map.setZoom(map.getZoom() + 1, { animate: false });
    for (const [dx, dy] of [[-50_000, 0], [100_000, 0], [0, -50_000], [0, 100_000]]) {
      map.panBy([dx, dy], { animate: false });
      const vue = map.getBounds();
      expect(ouverture.contains(vue.getSouthWest()) && ouverture.contains(vue.getNorthEast())).toBe(true);
      // Au moins un club reste à l'écran, même contre la borne.
      expect(LIGUE1_CLUBS_COORDS.some((c) => vue.contains([c.lat, c.lng]))).toBe(true);
    }
  });

  it('R6 — Recentrer ramène la vue d’ouverture, d’un zoom avant comme d’un décalage', () => {
    const map = makeMap(DESKTOP.width, DESKTOP.height);
    const { lat, lng } = map.getCenter();
    const zoom = map.getZoom();
    map.setView([43.3, 5.4], 11, { animate: false });
    frameFrance(map);
    expect(map.getZoom()).toBe(zoom);
    expect(map.getCenter().lat).toBeCloseTo(lat, 6);
    expect(map.getCenter().lng).toBeCloseTo(lng, 6);
    expect(clubsBounds().contains(map.getCenter())).toBe(true);
  });

  it('R7 — la carte qui change de format reprend son cadrage et son zoom minimal', () => {
    const map = makeMap(DESKTOP.width, DESKTOP.height);
    const desktopZoom = map.getZoom();
    Object.defineProperty(host!, 'clientWidth', { value: PHONE.width, configurable: true });
    Object.defineProperty(host!, 'clientHeight', { value: PHONE.height, configurable: true });
    map.invalidateSize({ animate: false });
    frameFrance(map);
    expect(map.getZoom()).toBeLessThan(desktopZoom);
    expect(map.getMinZoom()).toBe(map.getZoom());
  });

  it('R8 — Recentrer animé pose le zoom minimal sur le cadrage, pas sur le zoom d’avant l’animation', () => {
    const map = makeMap(DESKTOP.width, DESKTOP.height);
    const framed = map.getZoom();
    map.setView([43.3, 5.4], 10, { animate: false });
    // Pendant une animation, getZoom() rend encore l'ancien zoom : fitBounds ne bouge pas la vue ici.
    vi.spyOn(map, 'fitBounds').mockImplementation(() => map);
    frameFrance(map, true);
    expect(map.getZoom()).toBe(10);
    expect(map.getMinZoom()).toBe(framed);
  });

  it('R9 — un redimensionnement garde le zoom et le déplacement de l’utilisateur ; au zoom minimal il recadre', () => {
    const map = makeMap(DESKTOP.width, DESKTOP.height);
    map.setView([43.3, 5.4], 9, { animate: false });
    const centre = map.getCenter();
    Object.defineProperty(host!, 'clientWidth', { value: DESKTOP.width - 20, configurable: true });
    map.invalidateSize({ animate: false });
    followResize(map);
    expect(map.getZoom()).toBe(9);
    expect(map.getCenter().lat).toBeCloseTo(centre.lat, 1);
    expect(map.getMinZoom()).toBeLessThan(9);

    frameFrance(map);
    const cadree = map.getZoom();
    Object.defineProperty(host!, 'clientWidth', { value: PHONE.width, configurable: true });
    Object.defineProperty(host!, 'clientHeight', { value: PHONE.height, configurable: true });
    map.invalidateSize({ animate: false });
    followResize(map);
    expect(map.getZoom()).toBeLessThan(cadree);
    expect(map.getMinZoom()).toBe(map.getZoom());
    expectEveryClubInside(map);
  });
});
