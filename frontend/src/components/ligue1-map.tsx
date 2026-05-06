import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useFixtures } from '@/hooks/use-fixtures';
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
  olMatchesVsClub,
  type OLMatchResult,
} from '@/lib/ligue1-club-match';
import { OL_TEAM_ID, type StandingEntry } from '@/types/api';

/**
 * Ligue 1 club map.
 * - Tiles: OpenStreetMap (free, attribution required by ODbL).
 * - Markers: OL in red (HSL 0 73% 50%), others in OL blue (224 64% 33%).
 * - Paris cluster: PSG and Paris FC are too close (~3 km) to render readable
 *   pins side-by-side at the default zoom. We nudge Paris FC a hair south so
 *   both icons stay clickable; the nudge collapses to zero once the user zooms
 *   in far enough.
 */

const OL_RED = 'hsl(0, 73%, 50%)';
const OL_BLUE = 'hsl(224, 64%, 33%)';
const RESULT_GRAY = 'hsl(0, 0%, 55%)';
const RESULT_DARK = 'hsl(0, 0%, 18%)';
const FRANCE_CENTER: [number, number] = [46.6, 2.4];

function buildOlIcon(): L.DivIcon {
  const size = 18;
  const halo = '0 0 0 3px hsla(0, 90%, 60%, 0.35), 0 0 12px hsla(0, 90%, 55%, 0.55)';
  return L.divIcon({
    className: 'ligue1-map-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `
      <span style="
        display:inline-block;
        width:${size}px;height:${size}px;
        border-radius:9999px;
        background:${OL_RED};
        border:2px solid #fff;
        box-shadow:${halo};
      "></span>
    `,
  });
}

function colorForResult(result: OLMatchResult | null): string {
  if (result === 'W') return OL_BLUE;
  if (result === 'L') return OL_RED;
  if (result === 'D') return RESULT_GRAY;
  // 'FUTURE' or null (no match recorded)
  return RESULT_DARK;
}

/**
 * Bicolor SVG marker for non-OL clubs.
 * Left half  = leg A (first chronological OL vs club fixture this season)
 * Right half = leg B (second fixture)
 * Color encodes result vs OL: blue=W, red=L, gray=D, dark=FUTURE/missing.
 */
function buildClubIcon(legA: OLMatchResult | null, legB: OLMatchResult | null): L.DivIcon {
  const size = 14;
  const stroke = 'hsl(0, 0%, 92%)';
  const cA = colorForResult(legA);
  const cB = colorForResult(legB);
  // viewBox 28x28, radius 13, center (14,14) — sweep flag 0 (left arc) / 1 (right arc).
  const html = `
    <svg viewBox="0 0 28 28" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 0 2px rgba(0,0,0,0.45));">
      <path d="M 14 1 A 13 13 0 0 0 14 27 Z" fill="${cA}" />
      <path d="M 14 1 A 13 13 0 0 1 14 27 Z" fill="${cB}" />
      <line x1="14" y1="1" x2="14" y2="27" stroke="${stroke}" stroke-width="0.8" />
      <circle cx="14" cy="14" r="13" fill="none" stroke="${stroke}" stroke-width="1.4" />
    </svg>
  `;
  return L.divIcon({
    className: 'ligue1-map-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html,
  });
}

const OL_ICON = buildOlIcon();

/** Cache club icons per (legA, legB) combo — only 25 possible combinations. */
const clubIconCache = new Map<string, L.DivIcon>();
function getClubIcon(legA: OLMatchResult | null, legB: OLMatchResult | null): L.DivIcon {
  const key = `${legA ?? 'none'}|${legB ?? 'none'}`;
  let icon = clubIconCache.get(key);
  if (!icon) {
    icon = buildClubIcon(legA, legB);
    clubIconCache.set(key, icon);
  }
  return icon;
}

function FitBoundsToClubs() {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(LIGUE1_CLUBS_COORDS.map((c) => [c.lat, c.lng]));
    map.fitBounds(bounds.pad(0.18), { animate: false });
  }, [map]);
  return null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface ClubPopupProps {
  club: Ligue1Club;
  standingEntry: StandingEntry | undefined;
  fixturesData: ReturnType<typeof useFixtures>['data'];
}

function ClubPopup({ club, standingEntry, fixturesData }: ClubPopupProps) {
  const matches = useMemo(
    () => olMatchesVsClub(fixturesData, club),
    [fixturesData, club],
  );
  const h2h = useMemo(() => computeH2H(matches), [matches]);
  const played = matches.filter((m) => m.isPast);
  const upcoming = matches.filter((m) => !m.isPast);
  const isOL = club.id365 === OL_ID_365;

  // imageVersion comes from standings response when available — falls back to
  // a low integer (the CDN tolerates stale versions, it just serves an older
  // logo until it 404s).
  const logo = clubLogoUrl(club.id365, club.imageVersion ?? 1);

  return (
    <div className="min-w-[240px] max-w-[280px] text-fg">
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
              <span className="num"><span className="font-bold" style={{ color: OL_BLUE }}>{h2h.W}</span> V</span>
              <span className="num"><span className="text-fg-muted font-bold">{h2h.D}</span> N</span>
              <span className="num"><span className="font-bold" style={{ color: OL_RED }}>{h2h.L}</span> D</span>
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
                      <span className="text-fg-muted">{m.isHome ? 'D' : 'E'}</span>
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
                    <span className="text-fg-dim w-[68px] num">{formatDate(m.fixture.date)}</span>
                    <span className="text-fg-muted">
                      {m.isHome ? 'à domicile' : "à l'extérieur"}
                    </span>
                  </li>
                ))}
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
  positionOffsetMeters?: { dx: number; dy: number };
  standingEntry?: StandingEntry;
  fixturesData: ReturnType<typeof useFixtures>['data'];
}

/** Convert a small metres offset to lat/lng — fine for sub-km nudges. */
function offsetLatLng(
  lat: number,
  lng: number,
  dxMeters: number,
  dyMeters: number,
): [number, number] {
  const dLat = dyMeters / 111_320;
  const dLng = dxMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}

function ClubMarker({ club, positionOffsetMeters, standingEntry, fixturesData }: ClubMarkerProps) {
  const isOL = club.id365 === OL_ID_365;
  const [lat, lng] = positionOffsetMeters
    ? offsetLatLng(club.lat, club.lng, positionOffsetMeters.dx, positionOffsetMeters.dy)
    : [club.lat, club.lng];

  const icon = useMemo(() => {
    if (isOL) return OL_ICON;
    const season = computeClubH2HSeason(fixturesData, club);
    return getClubIcon(season.legA?.result ?? null, season.legB?.result ?? null);
  }, [isOL, fixturesData, club]);

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      title={club.name}
      zIndexOffset={isOL ? 1000 : 0}
    >
      <Popup>
        <ClubPopup club={club} standingEntry={standingEntry} fixturesData={fixturesData} />
      </Popup>
    </Marker>
  );
}

/**
 * Legend overlay explaining the bicolor markers.
 * Positioned in the top-right corner with high z-index above Leaflet panes.
 * Compact (~170 px wide) so it never crushes the map area.
 */
function MapLegend() {
  const swatch = (color: string, label: string) => (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded-sm border border-white/20 shrink-0"
        style={{ background: color }}
      />
      <span className="text-[10px] text-fg leading-tight">{label}</span>
    </div>
  );
  return (
    <div
      className="absolute top-2 right-2 z-[500] rounded-md border border-border bg-surface/90 backdrop-blur px-2.5 py-2 shadow-md pointer-events-none"
      style={{ width: 170 }}
      aria-label="Légende des marqueurs"
    >
      <div className="text-[10px] uppercase tracking-wider text-fg-dim font-semibold mb-1.5 leading-none">
        Aller / Retour
      </div>
      <div className="grid grid-cols-1 gap-1">
        {swatch(OL_BLUE, 'Victoire OL')}
        {swatch(RESULT_GRAY, 'Match nul')}
        {swatch(OL_RED, 'Défaite OL')}
        {swatch(RESULT_DARK, 'Pas encore joué')}
      </div>
    </div>
  );
}

export function Ligue1Map() {
  const standingsQ = useStandings();
  const fixturesQ = useFixtures();
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={containerRef}
      className="relative rounded-md border border-border overflow-hidden bg-surface"
      style={{ height: 'min(72vh, 720px)', minHeight: 460 }}
    >
      <MapLegend />
      <MapContainer
        center={FRANCE_CENTER}
        zoom={6}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: '#0e1420' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright' target='_blank' rel='noopener'>OpenStreetMap</a> contributors"
          maxZoom={18}
        />
        <FitBoundsToClubs />
        {LIGUE1_CLUBS_COORDS.map((club) => {
          // Paris collision — Paris FC sits ~3 km south of PSG. We push Paris
          // FC ~600 m further south so both pins are clickable at zoom <= 8.
          const offset =
            club.id365 === 6075 ? { dx: 0, dy: -600 } : undefined;
          return (
            <ClubMarker
              key={club.id365}
              club={club}
              positionOffsetMeters={offset}
              standingEntry={findStandingForClub(club)}
              fixturesData={fixturesQ.data}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
