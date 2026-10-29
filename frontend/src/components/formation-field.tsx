import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { LineupPlayer } from '@/types/api';
import type { PlayersSearch } from '@/lib/players-search';
import { noteFr } from '@/lib/note-fr';
import { hasJersey } from '@/lib/jersey';

/** L76 : marge gardée entre le nom d'un joueur excentré et le bord du terrain. */
const MARGE_BORD_PX = 2;

const LINE_TO_Y: Record<number, number> = {
  1: 88,
  2: 70,
  3: 52,
  4: 36,
  5: 22,
  6: 10,
};

interface FormationFieldProps {
  starters: LineupPlayer[];
  formation: string;
  /** Onglet et tri à rouvrir au retour de la fiche d'un joueur. */
  retour: PlayersSearch;
}

export function FormationField({ starters, formation, retour }: FormationFieldProps) {
  return (
    <div data-testid="terrain" className="relative aspect-[3/4] sm:aspect-[4/5] rounded-md overflow-hidden border border-border-strong shadow-2xl">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, hsl(155 28% 12%) 0%, hsl(155 22% 7%) 50%, hsl(155 28% 12%) 100%)',
        }}
      />
      <PitchLines />

      {starters.map((p) => (
        <PlayerOnField key={p.id} player={p} retour={retour} />
      ))}

      <div className="absolute top-3 right-3 z-10 bg-ol-red-deep px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm border border-ol-red-bright/60 shadow-lg">
        {formation}
      </div>
    </div>
  );
}

function PitchLines() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g stroke="rgba(255,255,255,0.12)" strokeWidth="0.3" fill="none" vectorEffect="non-scaling-stroke">
        <rect x="2" y="2" width="96" height="96" />
        <line x1="2" y1="50" x2="98" y2="50" />
        <circle cx="50" cy="50" r="9" />
        <circle cx="50" cy="50" r="0.5" fill="rgba(255,255,255,0.3)" />
        <rect x="20" y="2" width="60" height="14" />
        <rect x="35" y="2" width="30" height="6" />
        <rect x="20" y="84" width="60" height="14" />
        <rect x="35" y="92" width="30" height="6" />
        <path d="M 50 16 A 9 9 0 0 0 41 7" />
        <path d="M 50 16 A 9 9 0 0 1 59 7" />
        <path d="M 50 84 A 9 9 0 0 1 41 93" />
        <path d="M 50 84 A 9 9 0 0 0 59 93" />
      </g>
    </svg>
  );
}

function PlayerOnField({ player, retour }: { player: LineupPlayer; retour: PlayersSearch }) {
  const x = clamp(player.yardSide, 4, 96);
  const y = LINE_TO_Y[player.yardLine] ?? 50;
  const ref = useRef<HTMLDivElement>(null);
  const [decalage, setDecalage] = useState(0);
  // L76 : le nom (nowrap) est plus large que le rond ; centré sur un joueur excentré il dépassait du terrain (overflow-hidden
  // le coupait). On le recale de ce qui dépasse, en pixels : la largeur du nom ne se connaît qu'une fois mesuré.
  useLayoutEffect(() => {
    const el = ref.current;
    const terrain = el?.offsetParent;
    if (!el || !terrain) return;
    // La pastille de note (absolute, hors de offsetWidth) dépasse à droite du bloc : on la compte.
    const mesurer = () => {
      const pastille = el.querySelector<HTMLElement>('[data-testid="pastille-note"]');
      const debord = pastille ? Math.max(0, pastille.offsetLeft + pastille.offsetWidth - el.offsetWidth) : 0;
      setDecalage(decalageDansTerrain(x, el.offsetWidth, terrain.clientWidth, debord));
    };
    mesurer();
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(mesurer);
    obs.observe(terrain);
    return () => obs.disconnect();
  }, [x, player.shortName, player.ranking]);
  return (
    <div
      ref={ref}
      className="absolute z-10"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(calc(-50% + ${decalage}px), -50%)`,
      }}
    >
      <Link
        to="/player/$athleteId"
        params={{ athleteId: String(player.athleteId) }}
        search={retour}
        aria-label={`Fiche de ${player.name}`}
        className="flex flex-col items-center gap-1.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-ol-red/60 rounded-md"
      >
        <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-ol-blue-bright to-ol-blue border-2 border-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.3)] flex items-center justify-center transition-transform group-hover:scale-110">
          <span className="font-mono tabular-nums text-white font-bold text-xs sm:text-sm">
            {hasJersey(player.jerseyNumber) ? player.jerseyNumber : ''}
          </span>
        </div>
        <span
          data-testid="nom-joueur"
          className="px-1.5 py-0.5 rounded-sm text-[10px] sm:text-[11px] font-semibold text-white whitespace-nowrap leading-none"
          style={{
            backgroundColor: 'rgba(8, 9, 13, 0.78)',
            backdropFilter: 'blur(2px)',
            textShadow: '0 1px 2px rgba(0,0,0,0.9)',
          }}
        >
          {player.shortName}
        </span>
        {player.ranking !== null && player.ranking > 0 && (
          <span
            data-testid="pastille-note"
            className="absolute -top-1.5 -right-1.5 z-20 inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[9px] font-bold leading-none border-2 border-bg"
            style={{
              backgroundColor: ratingColor(player.ranking),
              color: ratingTextColor(player.ranking),
            }}
            title={`Note ${noteFr(player.ranking)}`}
          >
            {noteFr(player.ranking)}
          </span>
        )}
      </Link>
    </div>
  );
}

/**
 * Décalage (px) qui ramène dans le terrain un bloc de `largeur` px centré à `x` % d'un terrain de `largeurTerrain` px.
 * `debordDroit` : ce qui dépasse en plus du bloc à sa droite (pastille de note).
 */
export function decalageDansTerrain(x: number, largeur: number, largeurTerrain: number, debordDroit = 0): number {
  const gauche = (x / 100) * largeurTerrain - largeur / 2;
  const droite = gauche + largeur + debordDroit;
  if (largeur + debordDroit + 2 * MARGE_BORD_PX > largeurTerrain) return 0;
  if (gauche < MARGE_BORD_PX) return MARGE_BORD_PX - gauche;
  if (droite > largeurTerrain - MARGE_BORD_PX) return largeurTerrain - MARGE_BORD_PX - droite;
  return 0;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** L7 : l'échelle de couleurs est celle de Sofascore/Google (cf. CLAUDE.md) ; le chiffre prend le noir ou le blanc, au meilleur contraste. */
export function ratingTextColor(rating: number): string {
  const bg = ratingColor(rating);
  return contrastOf('#ffffff', bg) >= contrastOf('#08090d', bg) ? '#ffffff' : '#08090d';
}

function contrastOf(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => {
      const x = parseInt(h.slice(i, i + 2), 16) / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function ratingColor(rating: number): string {
  if (rating >= 8) return '#16a34a';
  if (rating >= 7) return '#65a30d';
  if (rating >= 6) return '#ca8a04';
  if (rating >= 5) return '#ea580c';
  return '#dc2626';
}
