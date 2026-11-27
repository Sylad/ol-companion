import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LocateFixed } from 'lucide-react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useSeasonMatches } from '@/hooks/use-season-matches';
import { useStandings } from '@/hooks/use-standings';
import {
  LIGUE1_CLUBS_COORDS,
  OL_ID_365,
  clubLogoUrl,
  type Ligue1Club,
} from '@/lib/ligue1-clubs-coords';
import {
  computeClubH2HSeason,
  computeH2H,
  filterLigue1,
  olCupMatchesVsClub,
  olMatchesVsClub,
  type OLMatchResult,
} from '@/lib/ligue1-club-match';
import { RESULT_CHIP_TEXT, RESULT_DARK, type MapResult } from '@/lib/ligue1-map-colors';
import { clubMarkerSvg, colorForResult, olMarkerHtml } from '@/lib/ligue1-map-marker';
import { RetryMessage } from '@/components/retry-message';
import { formatKickoffDayShort } from '@/lib/kickoff';
import { HIT_SIZE_PX, hitSizesAtZoom, markerNudge } from '@/lib/ligue1-map-hit';
import { MAX_ZOOM, ZOOM_SNAP, clubsBounds, followResize, frameFrance, liftMaxBounds, restoreMaxBounds } from '@/lib/ligue1-map-view';
import { OL_TEAM_ID, type SeasonMatch, type StandingEntry } from '@/types/api';

/**
 * Ligue 1 club map.
 * - Tiles: OpenStreetMap (free, attribution required by ODbL).
 * - Markers: OL in red (HSL 0 73% 50%), others split in two halves by result.
 * - Taille (L272) : cercle dessiné de 22 px (OL 26 px), zone cliquable de 24 à 44 px selon la place laissée par les
 *   voisins au zoom courant (`hitSizesAtZoom`) ; les clubs trop proches à l'ouverture (Paris, Nice/Monaco,
 *   Lens/Lille…) sont écartés de quelques pixels, voir ligue1-map-hit. La légende dessine avec les mêmes fonctions.
 */

/** Gabarit commun des marqueurs : zone cliquable de `hit` px, cercle dessiné centré, décalé de `nudge` pixels. */
function hitIcon(html: string, nudge: readonly [number, number], hit: number): L.DivIcon {
  const [dx, dy] = nudge;
  const demi = hit / 2;
  return L.divIcon({
    className: 'ligue1-map-marker',
    iconSize: [hit, hit],
    iconAnchor: [demi - dx, demi - dy],
    // Le popup s'ouvre au-dessus du cercle décalé, pas au-dessus de l'emplacement du stade.
    popupAnchor: [dx, dy - demi],
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${hit}px;height:${hit}px;">${html}</span>`,
  });
}

// La fiche se recale hors des boutons de zoom (coin haut-gauche : 10 px de marge + 30 de large + 4 d'air) et du bord droit.
const POPUP_PAN_TOP_LEFT = L.point(44, 10);
const POPUP_PAN_BOTTOM_RIGHT = L.point(6, 10);

// Vue de départ du conteneur, aussitôt remplacée par FrameFrance une fois la carte mesurée.
const FRANCE_CENTER = clubsBounds().getCenter();

/** Cache des icônes par (aller, retour, décalage, zone) : 25 combinaisons de résultats × quelques décalages × 11 zones. */
const iconCache = new Map<string, L.DivIcon>();
function getMarkerIcon(isOL: boolean, legA: OLMatchResult | null, legB: OLMatchResult | null, nudge: readonly [number, number], hit: number): L.DivIcon {
  const key = isOL ? `OL|${nudge.join(',')}|${hit}` : `${legA ?? 'none'}|${legB ?? 'none'}|${nudge.join(',')}|${hit}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = hitIcon(isOL ? olMarkerHtml() : clubMarkerSvg(legA, legB), nudge, hit);
    iconCache.set(key, icon);
  }
  return icon;
}

/** Ouvre la carte sur la France ; un changement de format (rotation, fenêtre) la recadre. */
function FrameFrance() {
  const map = useMap();
  useEffect(() => {
    frameFrance(map);
    // Au zoom minimal le cadrage suit ; plus près, le zoom et le déplacement de l'utilisateur restent.
    const onResize = () => {
      followResize(map);
      // Le recadrage a déplacé la carte sous la fiche ouverte (L198) : elle se recale, comme à l'ouverture.
      ficheOuverte.get(map)?.getPopup()?.update();
    };
    map.on('resize', onResize);
    return () => {
      map.off('resize', onResize);
    };
  }, [map]);
  return null;
}

/**
 * Bouton « Recentrer » (L192) : revient à la vue d'ouverture, quel que soit le zoom ou le décalage. Contrôle Leaflet en
 * bas à gauche (L193 : en haut il recouvrait Brest à 390 px) : il suit les boutons de zoom dans l'ordre de tabulation, et
 * les liens d'attribution du bas à droite viennent après lui.
 */
function RecenterControl() {
  const map = useMap();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const control = new L.Control({ position: 'bottomleft' });
    control.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-control');
      // Aligné sur le bord bas des anciennes valeurs (26 px) ; un clic ne doit ni glisser ni zoomer la carte dessous.
      div.style.marginBottom = '26px';
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    control.addTo(map);
    setContainer(control.getContainer() ?? null);
    return () => {
      control.remove();
      setContainer(null);
    };
  }, [map]);
  if (!container) return null;
  return createPortal(
    <button
      type="button"
      onClick={() => frameFrance(map, true)}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-semibold text-fg shadow-md hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ol-blue-fg"
    >
      <LocateFixed className="h-4 w-4" aria-hidden />
      Recentrer
    </button>,
    container,
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface ClubPopupProps {
  club: Ligue1Club;
  standingEntry: StandingEntry | undefined;
  /** L1-only slice — used for the season W/N/L bilan + per-leg list. */
  ligue1Matches: SeasonMatch[];
  /** Full season — used to surface Coupe de France encounter(s) below. */
  allMatches: SeasonMatch[] | undefined;
}

function ClubPopup({ club, standingEntry, ligue1Matches, allMatches }: ClubPopupProps) {
  const matches = useMemo(
    () => olMatchesVsClub(ligue1Matches, club),
    [ligue1Matches, club],
  );
  const h2h = useMemo(() => computeH2H(matches), [matches]);
  const cupMatches = useMemo(
    () => olCupMatchesVsClub(allMatches, club, 'CDF'),
    [allMatches, club],
  );
  const played = matches.filter((m) => m.isPast);
  const live = matches.filter((m) => m.isLive);
  const upcoming = matches.filter((m) => !m.isPast && !m.isLive);
  const isOL = club.id365 === OL_ID_365;

  // imageVersion comes from standings response when available — falls back to
  // a low integer (the CDN tolerates stale versions, it just serves an older
  // logo until it 404s).
  const logo = clubLogoUrl(club.id365, club.imageVersion ?? 1);

  return (
    <div className="ligue1-popup-content text-fg">
      <header className="flex items-center gap-3 mb-2">
        <img
          src={logo}
          alt=""
          className="w-10 h-10 rounded-sm bg-white/5 p-0.5 shrink-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
          }}
        />
        <div className="min-w-0">
          <div className="font-display text-sm font-bold leading-tight truncate">
            {club.name}
          </div>
          <div className="text-petite text-fg-dim leading-tight truncate">{club.stadium}</div>
        </div>
      </header>

      <div className="flex items-baseline gap-3 text-xs mb-3">
        {standingEntry ? (
          <>
            <span className="text-fg-dim">Position</span>
            <span className="num font-bold text-fg-bright text-base">
              {standingEntry.position}
              <span className="text-petite text-fg-dim font-normal ml-0.5">/ 18</span>
            </span>
            <span className="text-fg-dim">·</span>
            <span className="num text-fg-muted">{standingEntry.points} pts</span>
          </>
        ) : (
          <span className="text-fg-dim">Position indisponible</span>
        )}
      </div>

      {!isOL && (
        <>
          <div className="text-petite uppercase tracking-wider text-fg-dim mb-1.5 font-semibold">
            Bilan OL — saison
          </div>
          {matches.length === 0 ? (
            <div className="text-xs text-fg-dim italic mb-2">Pas de match OL recensé.</div>
          ) : (
            <div className="flex items-center gap-3 text-xs mb-3">
              <span className="num"><span className="font-bold text-ol-blue-fg">{h2h.W}</span> V</span>
              <span className="num"><span className="text-fg-muted font-bold">{h2h.D}</span> N</span>
              <span className="num"><span className="font-bold text-loss-fg">{h2h.L}</span> D</span>
            </div>
          )}

          {played.length > 0 && (
            <div className="mb-2">
              <div className="text-petite uppercase tracking-wider text-fg-dim mb-1 font-semibold">
                Joués
              </div>
              <ul className="space-y-1">
                {played.map((m) => {
                  const olScore = m.isHome ? m.fixture.homeScore : m.fixture.awayScore;
                  const oppScore = m.isHome ? m.fixture.awayScore : m.fixture.homeScore;
                  const chipColor = colorForResult(m.outcome ?? 'FUTURE');
                  const chipText = RESULT_CHIP_TEXT[m.outcome ?? 'FUTURE'];
                  const chipLetter = m.outcome === 'W' ? 'V' : m.outcome === 'L' ? 'D' : m.outcome === 'D' ? 'N' : '·';
                  return (
                    <li key={m.fixture.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-petite">
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-sm text-petite font-bold shrink-0"
                        style={{ background: chipColor, color: chipText }}
                        aria-label={chipLetter}
                      >
                        {chipLetter}
                      </span>
                      <span className="text-fg-dim w-[68px] num">{formatDate(m.fixture.date)}</span>
                      <span className="text-fg-muted">{m.isHome ? 'Domicile' : 'Extérieur'}</span>
                      <span className="num font-bold">
                        {olScore}–{oppScore}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {live.length > 0 && (
            <div className="mb-2">
              <div className="text-petite uppercase tracking-wider text-fg-dim mb-1 font-semibold">
                En direct
              </div>
              <ul className="space-y-1">
                {live.map((m) => {
                  const olScore = m.isHome ? m.fixture.homeScore : m.fixture.awayScore;
                  const oppScore = m.isHome ? m.fixture.awayScore : m.fixture.homeScore;
                  return (
                    <li
                      key={m.fixture.id}
                      data-testid="match-en-direct"
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-petite"
                    >
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-sm text-petite font-bold text-white shrink-0 bg-ol-red"
                        aria-label="en direct"
                      >
                        ●
                      </span>
                      <span className="text-fg-dim min-w-[68px] num">{formatDate(m.fixture.date)}</span>
                      <span className="text-fg-muted">{m.isHome ? 'Domicile' : 'Extérieur'}</span>
                      {olScore !== null && oppScore !== null ? (
                        <span className="num font-bold">
                          {olScore}–{oppScore}
                        </span>
                      ) : (
                        <span className="text-fg-dim italic">en direct</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <div className="text-petite uppercase tracking-wider text-fg-dim mb-1 font-semibold">
                À venir
              </div>
              <ul className="space-y-1">
                {upcoming.map((m) => (
                  <li key={m.fixture.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-petite">
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-sm text-petite font-bold text-white shrink-0"
                      style={{ background: RESULT_DARK }}
                      aria-label="à venir"
                    >
                      ·
                    </span>
                    <span className="text-fg-dim min-w-[68px] num">{formatKickoffDayShort(m.fixture)}</span>
                    <span className="text-fg-muted">
                      {m.isHome ? 'Domicile' : 'Extérieur'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cupMatches.length > 0 && (
            <div className="mt-3 pt-2 border-t border-border">
              <div className="text-petite uppercase tracking-wider text-fg-dim mb-1.5 font-semibold flex items-center gap-1">
                <span aria-hidden>🏆</span>
                <span>Coupe de France</span>
              </div>
              <ul className="space-y-1">
                {cupMatches.map((m) => {
                  const isHome = m.isHome;
                  const olScore = isHome ? m.match.homeScore : m.match.awayScore;
                  const oppScore = isHome ? m.match.awayScore : m.match.homeScore;
                  const chipColor = m.isPast ? colorForResult(m.outcome ?? 'FUTURE') : RESULT_DARK;
                  const chipText = RESULT_CHIP_TEXT[m.isPast ? (m.outcome ?? 'FUTURE') : 'FUTURE'];
                  const chipLetter = m.isPast
                    ? m.outcome === 'W' ? 'V' : m.outcome === 'L' ? 'D' : m.outcome === 'D' ? 'N' : '·'
                    : '·';
                  return (
                    <li key={m.match.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-petite">
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-sm text-petite font-bold shrink-0"
                        style={{ background: chipColor, color: chipText }}
                        aria-label={chipLetter}
                      >
                        {chipLetter}
                      </span>
                      <span className="text-fg-dim min-w-[68px] num">{m.isPast ? formatDate(m.match.date) : formatKickoffDayShort(m.match)}</span>
                      <span className="text-fg-muted">{isHome ? 'Domicile' : 'Extérieur'}</span>
                      {m.isPast && olScore !== null && oppScore !== null ? (
                        <span className="num font-bold">
                          {olScore}–{oppScore}
                        </span>
                      ) : (
                        <span className="text-fg-dim italic">à venir</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {isOL && (
        <div className="text-xs text-fg-muted">
          C'est ici qu'on joue. <span className="text-ol-red-bright font-semibold">Allez l'OL !</span>
        </div>
      )}
    </div>
  );
}

interface ClubMarkerProps {
  club: Ligue1Club;
  standingEntry?: StandingEntry;
  /** L1-only matches — drives the bicolor marker (legA / legB). */
  ligue1Matches: SeasonMatch[];
  /** Full season — passed through to the popup for the CdF block. */
  allMatches: SeasonMatch[] | undefined;
  /** Côté de la zone cliquable au zoom courant, en px (L272). */
  hitSize: number;
}

/**
 * Fiche ouverte de chaque carte : le marqueur dont elle vient. Le clavier (Échap, ×) la lit pour rendre le focus à ce
 * marqueur, où que soit le focus dans la carte.
 */
const ficheOuverte = new WeakMap<L.Map, L.Marker>();

/** Ferme la fiche ouverte de la carte et rend le focus à son marqueur ; faux s'il n'y en a pas. */
function fermerFicheOuverte(map: L.Map): boolean {
  const marker = ficheOuverte.get(map);
  if (!marker) return false;
  marker.closePopup();
  marker.getElement()?.focus();
  return true;
}

/**
 * Clavier de la fiche (L195) : le focus y entre à l'ouverture ; Échap ou × la ferme et le rend au marqueur,
 * sans quoi il retombe sur <body> et l'ordre de tabulation repart du haut de la page. Échap vaut pour la fiche
 * ouverte où que soit le focus dans la carte (sur un autre marqueur, sur un bouton de zoom…), pas seulement dans la
 * fiche : Leaflet, lui, n'écoute Échap qu'une fois le conteneur de la carte focalisé et ne rend le focus à personne.
 */
function FicheClavier() {
  const map = useMap();
  useEffect(() => {
    const conteneur = map.getContainer();
    // Phase de capture : on passe avant les écouteurs de Leaflet (qui fermeraient la fiche sans rendre le focus).
    // Un seul écouteur par carte, posé ici : rien ne s'accumule d'une ouverture à l'autre.
    const onKeyDown = (ev: KeyboardEvent) => {
      const surCroix = (ev.target as Element | null)?.closest('.leaflet-popup-close-button');
      if (ev.key !== 'Escape' && !(surCroix && ev.key === ' ')) return;
      if (!fermerFicheOuverte(map)) return;
      ev.stopPropagation();
      ev.preventDefault();
    };
    const onClick = (ev: MouseEvent) => {
      if (!(ev.target as Element | null)?.closest('.leaflet-popup-close-button')) return;
      if (!fermerFicheOuverte(map)) return;
      ev.stopPropagation();
      ev.preventDefault();
    };
    conteneur.addEventListener('keydown', onKeyDown, true);
    conteneur.addEventListener('click', onClick, true);
    return () => {
      conteneur.removeEventListener('keydown', onKeyDown, true);
      conteneur.removeEventListener('click', onClick, true);
    };
  }, [map]);
  return null;
}

function ouvrirFiche(e: L.PopupEvent, marker: L.Marker, club: string, map: L.Map) {
  const fiche = e.popup.getElement();
  if (!fiche) return;
  ficheOuverte.set(map, marker);
  fiche.setAttribute('role', 'dialog');
  fiche.setAttribute('aria-label', club);
  fiche.tabIndex = -1;
  // Leaflet nomme le × « Close popup » : la page est en français (WCAG 3.1.2).
  fiche.querySelector<HTMLElement>('.leaflet-popup-close-button')?.setAttribute('aria-label', 'Fermer la fiche');
  fiche.focus({ preventScroll: true });
  // Les clubs du nord n'ont pas la place d'une fiche au-dessus d'eux dans les limites de glisser (L192) : on les
  // lève le temps de la fiche et on la recale (`popup.update`), `fermerFiche` les remet.
  liftMaxBounds(map);
  e.popup.update();
}

function fermerFiche(map: L.Map, marker: L.Marker) {
  if (ficheOuverte.get(map) === marker) ficheOuverte.delete(map);
  restoreMaxBounds(map);
}

function ClubMarker({ club, standingEntry, ligue1Matches, allMatches, hitSize }: ClubMarkerProps) {
  const map = useMap();
  const isOL = club.id365 === OL_ID_365;
  const icon = useMemo(() => {
    if (isOL) return getMarkerIcon(true, null, null, markerNudge(club.id365), hitSize);
    // Markers strictly reflect Ligue 1 — never CdF/UEL.
    const season = computeClubH2HSeason(ligue1Matches, club);
    return getMarkerIcon(false, season.legA?.result ?? null, season.legB?.result ?? null, markerNudge(club.id365), hitSize);
  }, [isOL, ligue1Matches, club, hitSize]);

  return (
    <Marker
      position={[club.lat, club.lng]}
      icon={icon}
      title={club.name}
      zIndexOffset={isOL ? 1000 : 0}
      eventHandlers={{
        popupopen: (e) => ouvrirFiche(e, e.target as L.Marker, club.name, map),
        popupclose: (e) => fermerFiche(map, e.target as L.Marker),
      }}
    >
      <Popup autoPanPaddingTopLeft={POPUP_PAN_TOP_LEFT} autoPanPaddingBottomRight={POPUP_PAN_BOTTOM_RIGHT}>
        <ClubPopup
          club={club}
          standingEntry={standingEntry}
          ligue1Matches={ligue1Matches}
          allMatches={allMatches}
        />
      </Popup>
    </Marker>
  );
}

/**
 * Les 18 marqueurs, taillés au zoom courant (L272). Au début d'un zoom animé, la zone suit le plus bas des deux
 * zooms (départ, arrivée) : les marqueurs ne s'écartent qu'à la fin d'un zoom avant, les zones ne grandissent qu'alors.
 */
function ClubMarkers({ findStanding, ...matchs }: Omit<ClubMarkerProps, 'club' | 'standingEntry' | 'hitSize'> & { findStanding: (club: Ligue1Club) => StandingEntry | undefined }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    const auDebut = (e: L.ZoomAnimEvent) => setZoom(Math.min(map.getZoom(), e.zoom));
    const aLaFin = () => setZoom(map.getZoom());
    aLaFin();
    map.on('zoomanim', auDebut);
    map.on('zoomend', aLaFin);
    return () => {
      map.off('zoomanim', auDebut);
      map.off('zoomend', aLaFin);
    };
  }, [map]);
  const hitSizes = useMemo(() => hitSizesAtZoom(zoom), [zoom]);
  return LIGUE1_CLUBS_COORDS.map((club) => (
    <ClubMarker key={club.id365} club={club} standingEntry={findStanding(club)} {...matchs} hitSize={hitSizes.get(club.id365) ?? HIT_SIZE_PX} />
  ));
}

/**
 * Légende des marqueurs bicolores : sous la carte, dans le flux, à toute largeur. Posée sur la carte (coin haut
 * droit, L81 puis à partir de sm) elle masquait le × et l'en-tête de la fiche d'un club : le recalage de la fiche
 * connaît les boutons de zoom, pas une légende (L195, WCAG 2.4.11). À partir de sm les rubriques se mettent en ligne.
 * Chaque pastille est dessinée par la fonction du marqueur, à sa taille (L272) : un club dont les deux matchs ont le
 * même résultat, puis l'OL.
 */
export function MapLegend() {
  const pastille = (html: string, label: string) => (
    <div className="flex items-center gap-1.5">
      <span className="flex shrink-0 items-center" aria-hidden dangerouslySetInnerHTML={{ __html: html }} />
      <span className="text-petite text-fg leading-tight">{label}</span>
    </div>
  );
  const resultat = (result: MapResult, label: string) => pastille(clubMarkerSvg(result, result), label);
  return (
    <div
      className="border-t border-border bg-surface px-2.5 py-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-1.5"
      aria-label="Légende des marqueurs"
    >
      <div className="text-petite uppercase tracking-wider text-fg-muted font-semibold mb-1.5 sm:mb-0 leading-none">
        Aller / Retour
      </div>
      <div className="grid grid-cols-1 gap-1 sm:flex sm:flex-wrap sm:gap-x-4">
        {resultat('W', 'Victoire OL')}
        {resultat('D', 'Match nul')}
        {resultat('L', 'Défaite OL')}
        {resultat('FUTURE', 'Pas encore joué')}
        {pastille(olMarkerHtml(), 'Lyon (OL)')}
      </div>
    </div>
  );
}

export function Ligue1Map() {
  const standingsQ = useStandings();
  const seasonMatchesQ = useSeasonMatches();
  const containerRef = useRef<HTMLDivElement>(null);

  const ligue1Matches = useMemo(
    () => filterLigue1(seasonMatchesQ.data),
    [seasonMatchesQ.data],
  );

  const standingsByTeamId = useMemo(() => {
    const map = new Map<number, StandingEntry>();
    for (const r of standingsQ.data?.table ?? []) map.set(r.teamId, r);
    return map;
  }, [standingsQ.data]);

  // Lookup: try football-data id first (used by standings via OL_TEAM_ID
  // remap), then fall back to id365 stored directly.
  function findStandingForClub(club: Ligue1Club): StandingEntry | undefined {
    if (club.id365 === OL_ID_365) {
      return standingsByTeamId.get(OL_TEAM_ID);
    }
    return standingsByTeamId.get(club.id365);
  }

  // Sans liste de matchs, la carte mentirait : tous les marqueurs diraient « Pas encore joué ».
  // Une liste vide chargée est une vraie saison vide (carte affichée) ; l'attente et l'erreur
  // sont des états à part (L194).
  if (seasonMatchesQ.data === undefined) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-border bg-surface p-6"
        style={{ minHeight: 460 }}
      >
        {seasonMatchesQ.isError ? (
          <RetryMessage
            message="Impossible de charger les résultats de la saison."
            onRetry={() => void seasonMatchesQ.refetch()}
            messageTestId="carte-erreur"
            buttonTestId="carte-reessayer"
          />
        ) : (
          <p role="status" className="text-sm text-fg-muted">
            Chargement de la carte…
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative rounded-md border border-border overflow-hidden bg-surface">
      <div
        ref={containerRef}
        className="relative"
        style={{ height: 'min(72vh, 720px)', minHeight: 460 }}
      >
        <MapContainer
          center={FRANCE_CENTER}
          zoom={5}
          zoomSnap={ZOOM_SNAP}
          maxZoom={MAX_ZOOM}
          maxBoundsViscosity={1}
          scrollWheelZoom={false}
          className="ligue1-map h-full w-full"
          style={{ background: '#0e1420' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; les contributeurs d’<a href='https://www.openstreetmap.org/copyright' target='_blank' rel='noopener'>OpenStreetMap</a>"
            maxZoom={18}
          />
          <FrameFrance />
          <FicheClavier />
          <RecenterControl />
          <ClubMarkers findStanding={findStandingForClub} ligue1Matches={ligue1Matches} allMatches={seasonMatchesQ.data} />
        </MapContainer>
      </div>
      <MapLegend />
    </div>
  );
}
