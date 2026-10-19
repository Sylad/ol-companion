import { afterEach, describe, expect, it } from 'vitest';
import L from 'leaflet';
import { LIGUE1_CLUBS_COORDS } from '@/lib/ligue1-clubs-coords';
import {
  MAX_ZOOM,
  ZOOM_SNAP,
  clubsBounds,
  frameFrance,
  maxBounds,
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
    maxBounds: maxBounds(),
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

  it('R1b — la France est centrée dans la carte : même marge en haut (Lille) et en bas (Marseille)', () => {
    const map = makeMap(DESKTOP.width, DESKTOP.height);
    const lille = map.latLngToContainerPoint([50.6119, 3.1306]);
    const marseille = map.latLngToContainerPoint([43.2698, 5.3958]);
    expect(lille.y).toBeCloseTo(DESKTOP.height - marseille.y, 0);
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

  it('R5 — le glisser ne sort pas de la France', () => {
    const map = makeMap(DESKTOP.width, DESKTOP.height);
    map.setZoom(map.getZoom() + 3, { animate: false });
    map.panBy([-50_000, 50_000], { animate: false });
    const limit = maxBounds();
    expect(limit.contains(map.getCenter())).toBe(true);
    map.panBy([100_000, -100_000], { animate: false });
    expect(limit.contains(map.getCenter())).toBe(true);
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
});
