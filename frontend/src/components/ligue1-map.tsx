import { useEffect, useMemo, useRef } from 'react';
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
import {
  OL_RED,
  RESULT_COLORS,
  RESULT_DARK,
  RESULT_OUTLINE,
  resultGlyph,
  type MapResult,
} from '@/lib/ligue1-map-colors';
import { RetryMessage } from '@/components/retry-message';
import { formatKickoffDayShort } from '@/lib/kickoff';
import { HIT_SIZE_PX, markerNudge } from '@/lib/ligue1-map-hit';
import { MAX_ZOOM, ZOOM_SNAP, clubsBounds, frameFrance, maxBounds } from '@/lib/ligue1-map-view';
import { OL_TEAM_ID, type SeasonMatch, type StandingEntry } from '@/types/api';

/**
 * Ligue 1 club map.
 * - Tiles: OpenStreetMap (free, attribution required by ODbL).
 * - Markers: OL in red (HSL 0 73% 50%), others in OL blue (224 64% 33%).
 * - Zone cliquable (L193) : chaque marqueur occupe 24 px, le cercle dessiné en
 *   occupe 14 ou 18 au centre ; les clubs trop proches à l'ouverture (Paris, Nice/Monaco,
 *   Lens/Lille…) sont écartés de quelques pixels, voir ligue1-map-hit.
 */

/** Gabarit commun des marqueurs : zone cliquable de 24 px, cercle dessiné centré, décalé de `nudge` pixels. */
function hitIcon(html: string, nudge: readonly [number, number]): L.DivIcon {
  const [dx, dy] = nudge;
  const demi = HIT_SIZE_PX / 2;
  return L.divIcon({
    className: 'ligue1-map-marker',
    iconSize: [HIT_SIZE_PX, HIT_SIZE_PX],
    iconAnchor: [demi - dx, demi - dy],
    // Le popup s'ouvre au-dessus du cercle décalé, pas au-dessus de l'emplacement du stade.
    popupAnchor: [dx, dy - demi],
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${HIT_SIZE_PX}px;height:${HIT_SIZE_PX}px;">${html}</span>`,
  });
}

function buildOlIcon(): L.DivIcon {
  const size = 18;
  const halo = '0 0 0 3px hsla(0, 90%, 60%, 0.35), 0 0 12px hsla(0, 90%, 55%, 0.55)';
  return hitIcon(`
      <span style="
        display:inline-block;
        width:${size}px;height:${size}px;
        border-radius:9999px;
        background:${OL_RED};
        border:2px solid #fff;
        box-shadow:${halo};
      "></span>
    `, markerNudge(OL_ID_365));
}

function colorForResult(result: OLMatchResult | null): string {
  // 'FUTURE' or null (no match recorded) → dark
  return RESULT_COLORS[(result ?? 'FUTURE') as MapResult];
}

/**
 * Bicolor SVG marker for non-OL clubs.
 * Left half  = leg A (first chronological OL vs club fixture this season)
 * Right half = leg B (second fixture)
 * Color encodes result vs OL (blue=W, red=L, gray=D, dark=FUTURE/missing) and so does a
 * white pattern per half (none=W, bar=D, slash=L, dot=FUTURE) — see ligue1-map-colors.
 */
function buildClubIcon(legA: OLMatchResult | null, legB: OLMatchResult | null, nudge: readonly [number, number]): L.DivIcon {
  const size = 14;
  const stroke = RESULT_OUTLINE;
  const cA = colorForResult(legA);
  const cB = colorForResult(legB);
  // viewBox 28x28, radius 13, center (14,14) — sweep flag 0 (left arc) / 1 (right arc).
  const html = `
    <svg viewBox="0 0 28 28" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 0 2px rgba(0,0,0,0.45));">
      <path d="M 14 1 A 13 13 0 0 0 14 27 Z" fill="${cA}" />
      <path d="M 14 1 A 13 13 0 0 1 14 27 Z" fill="${cB}" />
      ${resultGlyph(legA ?? 'FUTURE', 7.5)}
      ${resultGlyph(legB ?? 'FUTURE', 20.5)}
      <line x1="14" y1="1" x2="14" y2="27" stroke="${stroke}" stroke-width="0.8" />
      <circle cx="14" cy="14" r="13" fill="none" stroke="${stroke}" stroke-width="1.4" />
    </svg>
  `;
  return hitIcon(html, nudge);
}

const OL_ICON = buildOlIcon();

// La fiche se recale hors des boutons de zoom (coin haut-gauche : 10 px de marge + 30 de large) et du bord droit.
const POPUP_PAN_TOP_LEFT = L.point(48, 10);
const POPUP_PAN_BOTTOM_RIGHT = L.point(10, 10);

// Vue de départ du conteneur, aussitôt remplacée par FrameFrance une fois la carte mesurée.
const FRANCE_CENTER = clubsBounds().getCenter();
const FRANCE_MAX_BOUNDS = maxBounds();

/** Cache club icons per (legA, legB, nudge) combo — 25 result combinations × a handful of nudges. */
const clubIconCache = new Map<string, L.DivIcon>();
function getClubIcon(legA: OLMatchResult | null, legB: OLMatchResult | null, nudge: readonly [number, number]): L.DivIcon {
  const key = `${legA ?? 'none'}|${legB ?? 'none'}|${nudge.join(',')}`;
  let icon = clubIconCache.get(key);
  if (!icon) {
    icon = buildClubIcon(legA, legB, nudge);
    clubIconCache.set(key, icon);
  }
  return icon;
}

/** Ouvre la carte sur la France ; un changement de format (rotation, fenêtre) la recadre. */
function FrameFrance() {
  const map = useMap();
  useEffect(() => {
    frameFrance(map);
    const onResize = () => frameFrance(map);
    map.on('resize', onResize);
    return () => {
      map.off('resize', onResize);
    };
  }, [map]);
  return null;
}

/** Bouton « Recentrer » (L192) : revient à la vue d'ouverture, quel que soit le zoom ou le décalage. */
function RecenterButton() {
  const map = useMap();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Un clic sur le bouton ne doit ni glisser ni zoomer la carte dessous.
    if (ref.current) L.DomEvent.disableClickPropagation(ref.current);
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => frameFrance(map, true)}
      className="absolute bottom-[26px] left-[10px] z-[1000] inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-semibold text-fg shadow-md hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ol-blue-fg"
    >
      <LocateFixed className="h-4 w-4" aria-hidden />
      Recentrer
    </button>
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
  const upcoming = matches.filter((m) => !m.isPast);
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
          <div className="text-[11px] text-fg-dim leading-tight truncate">{club.stadium}</div>
        </div>
      </header>

      <div className="flex items-baseline gap-3 text-xs mb-3">
        {standingEntry ? (
          <>
            <span className="text-fg-dim">Position</span>
            <span className="num font-bold text-fg-bright text-base">
              {standingEntry.position}
              <span className="text-[10px] text-fg-dim font-normal ml-0.5">/ 18</span>
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
          <div className="text-[10px] uppercase tracking-wider text-fg-dim mb-1.5 font-semibold">
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
              <div className="text-[10px] uppercase tracking-wider text-fg-dim mb-1 font-semibold">
                Joués
              </div>
              <ul className="space-y-1">
                {played.map((m) => {
                  const olScore = m.isHome ? m.fixture.homeScore : m.fixture.awayScore;
                  const oppScore = m.isHome ? m.fixture.awayScore : m.fixture.homeScore;
                  const chipColor = colorForResult(m.outcome ?? 'FUTURE');
                  const chipLetter = m.outcome === 'W' ? 'V' : m.outcome === 'L' ? 'D' : m.outcome === 'D' ? 'N' : '·';
                  return (
                    <li key={m.fixture.id} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-[9px] font-bold text-white shrink-0"
                        style={{ background: chipColor }}
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

          {upcoming.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-fg-dim mb-1 font-semibold">
                À venir
              </div>
              <ul className="space-y-1">
                {upcoming.map((m) => (
                  <li key={m.fixture.id} className="flex items-center gap-2 text-[11px]">
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-[9px] font-bold text-white shrink-0"
                      style={{ background: RESULT_DARK }}
                      aria-label="à venir"
                    >
                      ·
                    </span>
                    <span className="text-fg-dim min-w-[68px] num">{formatKickoffDayShort(m.fixture)}</span>
                    <span className="text-fg-muted">
                      {m.isHome ? 'à domicile' : "à l'extérieur"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cupMatches.length > 0 && (
            <div className="mt-3 pt-2 border-t border-border">
              <div className="text-[10px] uppercase tracking-wider text-fg-dim mb-1.5 font-semibold flex items-center gap-1">
                <span aria-hidden>🏆</span>
                <span>Coupe de France</span>
              </div>
              <ul className="space-y-1">
                {cupMatches.map((m) => {
                  const isHome = m.isHome;
                  const olScore = isHome ? m.match.homeScore : m.match.awayScore;
                  const oppScore = isHome ? m.match.awayScore : m.match.homeScore;
                  const chipColor = m.isPast ? colorForResult(m.outcome ?? 'FUTURE') : RESULT_DARK;
                  const chipLetter = m.isPast
                    ? m.outcome === 'W' ? 'V' : m.outcome === 'L' ? 'D' : m.outcome === 'D' ? 'N' : '·'
                    : '·';
                  return (
                    <li key={m.match.id} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-[9px] font-bold text-white shrink-0"
                        style={{ background: chipColor }}
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
}

/**
 * Clavier de la fiche (L195) : le focus y entre à l'ouverture ; Échap ou × la ferme et le rend au marqueur,
 * sans quoi il retombe sur <body> et l'ordre de tabulation repart du haut de la page.
 * Leaflet n'écoute Échap qu'une fois le conteneur de la carte focalisé, pas le marqueur ni la fiche.
 */
function ouvrirFiche(e: L.PopupEvent, marker: L.Marker, club: string) {
  const fiche = e.popup.getElement();
  if (!fiche) return;
  fiche.setAttribute('role', 'dialog');
  fiche.setAttribute('aria-label', club);
  fiche.tabIndex = -1;
  const fermer = () => {
    marker.closePopup();
    marker.getElement()?.focus();
  };
  fiche.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    ev.stopPropagation();
    fermer();
  });
  fiche.querySelector<HTMLElement>('.leaflet-popup-close-button')?.addEventListener('click', (ev) => {
    ev.preventDefault();
    fermer();
  });
  fiche.focus({ preventScroll: true });
}

function ClubMarker({ club, standingEntry, ligue1Matches, allMatches }: ClubMarkerProps) {
  const isOL = club.id365 === OL_ID_365;
  const icon = useMemo(() => {
    if (isOL) return OL_ICON;
    // Markers strictly reflect Ligue 1 — never CdF/UEL.
    const season = computeClubH2HSeason(ligue1Matches, club);
    return getClubIcon(season.legA?.result ?? null, season.legB?.result ?? null, markerNudge(club.id365));
  }, [isOL, ligue1Matches, club]);

  return (
    <Marker
      position={[club.lat, club.lng]}
      icon={icon}
      title={club.name}
      zIndexOffset={isOL ? 1000 : 0}
      eventHandlers={{ popupopen: (e) => ouvrirFiche(e, e.target as L.Marker, club.name) }}
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
 * Legend overlay explaining the bicolor markers.
 * Au téléphone (< sm) : sous la carte, dans le flux, pour ne pas masquer l'en-tête
 * des bulles (L81). À partir de sm : coin haut-droit, au-dessus des panes Leaflet.
 * Compact (~170 px wide) so it never crushes the map area.
 */
export function MapLegend() {
  const swatch = (result: MapResult, label: string) => (
    <div className="flex items-center gap-1.5">
      <svg viewBox="0 0 28 28" width="14" height="14" className="shrink-0" aria-hidden>
        <rect x="1" y="1" width="26" height="26" rx="4" fill={RESULT_COLORS[result]} stroke={RESULT_OUTLINE} strokeWidth="1.6" />
        <g dangerouslySetInnerHTML={{ __html: resultGlyph(result, 14) }} />
      </svg>
      <span className="text-[10px] text-fg leading-tight">{label}</span>
    </div>
  );
  return (
    <div
      className="border-t border-border bg-surface px-2.5 py-2 sm:absolute sm:top-2 sm:right-2 sm:z-[500] sm:w-[170px] sm:rounded-md sm:border sm:bg-surface/90 sm:backdrop-blur sm:shadow-md sm:pointer-events-none"
      aria-label="Légende des marqueurs"
    >
      <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold mb-1.5 leading-none">
        Aller / Retour
      </div>
      <div className="grid grid-cols-1 gap-1">
        {swatch('W', 'Victoire OL')}
        {swatch('D', 'Match nul')}
        {swatch('L', 'Défaite OL')}
        {swatch('FUTURE', 'Pas encore joué')}
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
          maxBounds={FRANCE_MAX_BOUNDS}
          maxBoundsViscosity={1}
          scrollWheelZoom={false}
          className="h-full w-full"
          style={{ background: '#0e1420' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; <a href='https://www.openstreetmap.org/copyright' target='_blank' rel='noopener'>OpenStreetMap</a> contributors"
            maxZoom={18}
          />
          <FrameFrance />
          <RecenterButton />
          {LIGUE1_CLUBS_COORDS.map((club) => {
            return (
              <ClubMarker
                key={club.id365}
                club={club}
                standingEntry={findStandingForClub(club)}
                ligue1Matches={ligue1Matches}
                allMatches={seasonMatchesQ.data}
              />
            );
          })}
        </MapContainer>
      </div>
      <MapLegend />
    </div>
  );
}
