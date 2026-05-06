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
import { computeH2H, olMatchesVsClub } from '@/lib/ligue1-club-match';
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
const FRANCE_CENTER: [number, number] = [46.6, 2.4];

function buildIcon(color: string, size: number, isOL: boolean): L.DivIcon {
  const halo = isOL
    ? '0 0 0 3px hsla(0, 90%, 60%, 0.35), 0 0 12px hsla(0, 90%, 55%, 0.55)'
    : '0 0 0 2px hsla(224, 90%, 60%, 0.25)';
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
        background:${color};
        border:2px solid #fff;
        box-shadow:${halo};
      "></span>
    `,
  });
}

const OL_ICON = buildIcon(OL_RED, 18, true);
const OTHER_ICON = buildIcon(OL_BLUE, 14, false);

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
              <span className="num"><span className="text-win font-bold">{h2h.W}</span> V</span>
              <span className="num"><span className="text-fg-muted font-bold">{h2h.D}</span> N</span>
              <span className="num"><span className="text-loss font-bold">{h2h.L}</span> D</span>
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
                  const dot =
                    m.outcome === 'W'
                      ? 'bg-win'
                      : m.outcome === 'L'
                      ? 'bg-loss'
                      : 'bg-fg-dim';
                  return (
                    <li key={m.fixture.id} className="flex items-center gap-2 text-[11px]">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
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
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-ol-blue-bright" />
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

  return (
    <Marker
      position={[lat, lng]}
      icon={isOL ? OL_ICON : OTHER_ICON}
      title={club.name}
      zIndexOffset={isOL ? 1000 : 0}
    >
      <Popup>
        <ClubPopup club={club} standingEntry={standingEntry} fixturesData={fixturesData} />
      </Popup>
    </Marker>
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
      className="rounded-md border border-border overflow-hidden bg-surface"
      style={{ height: 'min(72vh, 720px)', minHeight: 460 }}
    >
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
