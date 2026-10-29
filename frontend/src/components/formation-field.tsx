import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { LineupPlayer } from '@/types/api';
import type { PlayersSearch } from '@/lib/players-search';
import { noteFr } from '@/lib/note-fr';
import { hasJersey } from '@/lib/jersey';

/** L76 : marge gardée entre le nom d'un joueur excentré et le bord du terrain. */
const MARGE_BORD_PX = 2;
/** L76 : écart minimal gardé entre le nom d'un joueur de bord recalé et le nom de son voisin de ligne. */
const ECART_NOMS_PX = 4;
/** L76 : sous cette largeur (marges du nom et un caractère avec ses points de suspension) un nom tronqué ne se lit plus : il est masqué (nomMax 0). */
const NOM_LISIBLE_MIN_PX = 24;

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
  const [place, setPlace] = useState<PlaceBord>({ decalage: 0, nomMax: null });
  // L76 : le nom (nowrap) est plus large que le rond ; centré sur un joueur excentré il dépassait du terrain (overflow-hidden
  // le coupait). On le recale de ce qui dépasse, en pixels : la largeur du nom ne se connaît qu'une fois mesuré. Le recalage
  // garde ECART_NOMS_PX avec le nom voisin de la même ligne, sinon le nom du joueur de bord est tronqué.
  useLayoutEffect(() => {
    const el = ref.current;
    const terrain = el?.offsetParent;
    const nom = el?.querySelector<HTMLElement>('[data-testid="nom-joueur"]');
    const rond = el?.querySelector<HTMLElement>('[data-testid="rond-joueur"]');
    if (!el || !terrain || !nom || !rond) return;
    const mesurer = () => {
      // La pastille de note (absolute, hors de offsetWidth) dépasse à droite du bloc : on la compte.
      const pastille = el.querySelector<HTMLElement>('[data-testid="pastille-note"]');
      const debord = pastille ? Math.max(0, pastille.offsetLeft + pastille.offsetWidth - el.offsetWidth) : 0;
      const t = terrain.getBoundingClientRect();
      // Voisins de la même ligne : leur nom tel qu'il est posé (un joueur central n'est pas déplacé).
      const noms = [...terrain.querySelectorAll<HTMLElement>(`[data-testid="joueur"][data-ligne="${player.yardLine}"]`)]
        .filter((j) => j !== el)
        .map((j) => j.querySelector('[data-testid="nom-joueur"]')!.getBoundingClientRect());
      const centre = (x / 100) * terrain.clientWidth;
      const voisinGauche = Math.max(-Infinity, ...noms.filter((r) => r.left + r.width / 2 - t.left < centre).map((r) => r.right - t.left));
      const voisinDroite = Math.min(Infinity, ...noms.filter((r) => r.left + r.width / 2 - t.left >= centre).map((r) => r.left - t.left));
      // scrollWidth : largeur du nom entier, même tronqué par un précédent calcul.
      const suivant = placerJoueurDeBord({
        x, largeurTerrain: terrain.clientWidth, nom: nom.scrollWidth, rond: rond.offsetWidth, debord,
        voisinGauche: Number.isFinite(voisinGauche) ? voisinGauche : null,
        voisinDroite: Number.isFinite(voisinDroite) ? voisinDroite : null,
      });
      setPlace((p) => (p.decalage === suivant.decalage && p.nomMax === suivant.nomMax ? p : suivant));
    };
    mesurer();
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(mesurer);
    obs.observe(terrain);
    return () => obs.disconnect();
  }, [x, player.shortName, player.ranking, player.yardLine]);
  const tronque = place.nomMax !== null;
  return (
    <div
      ref={ref}
      data-testid="joueur"
      data-ligne={player.yardLine}
      className="absolute z-10"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(calc(-50% + ${place.decalage}px), -50%)`,
      }}
    >
      <Link
        to="/player/$athleteId"
        params={{ athleteId: String(player.athleteId) }}
        search={retour}
        aria-label={`Fiche de ${player.name}`}
        className="flex flex-col items-center gap-1.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-ol-red/60 rounded-md"
      >
        <div data-testid="rond-joueur" className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-ol-blue-bright to-ol-blue border-2 border-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.3)] flex items-center justify-center transition-transform group-hover:scale-110">
          <span className="font-mono tabular-nums text-white font-bold text-xs sm:text-sm">
            {hasJersey(player.jerseyNumber) ? player.jerseyNumber : ''}
          </span>
        </div>
        <span
          data-testid="nom-joueur"
          title={tronque ? player.name : undefined}
          className="px-1.5 py-0.5 rounded-sm text-[10px] sm:text-[11px] font-semibold text-white whitespace-nowrap leading-none overflow-hidden text-ellipsis max-w-full"
          style={{
            backgroundColor: 'rgba(8, 9, 13, 0.78)',
            backdropFilter: 'blur(2px)',
            textShadow: '0 1px 2px rgba(0,0,0,0.9)',
            maxWidth: place.nomMax ?? undefined,
            // Nom masqué : sans marges ni affichage, mais en place (display: none ferait mesurer un scrollWidth nul au recalage suivant).
            ...(place.nomMax === 0 ? { padding: 0, visibility: 'hidden' as const } : null),
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

interface PlaceBord {
  decalage: number;
  /** Largeur maximale du nom (px) quand il est tronqué avec des points de suspension, sinon null. */
  nomMax: number | null;
}

interface EntreePlaceBord {
  x: number;
  largeurTerrain: number;
  /** Largeur du nom entier. */
  nom: number;
  /** Largeur du rond du numéro. */
  rond: number;
  /** Ce qui dépasse à droite du bloc (pastille de note). */
  debord: number;
  /** Bord droit du nom voisin à gauche, bord gauche du nom voisin à droite, en px depuis le bord gauche du terrain. */
  voisinGauche: number | null;
  voisinDroite: number | null;
}

/** Largeur laissée au nom tronqué : 0 (masqué) quand elle est trop étroite pour se lire. */
function nomLisible(place: number): number {
  return place < NOM_LISIBLE_MIN_PX ? 0 : place;
}

/**
 * L76 : place un joueur dans le terrain. Le décalage ramène le bloc dans le terrain (decalageDansTerrain) ; s'il rapproche le nom
 * à moins de ECART_NOMS_PX du nom voisin, il ne le fait pas : le nom est alors tronqué à la place disponible entre le bord du
 * terrain et le voisin. Quand cette place est plus étroite que le rond, le rond est collé à la marge du terrain et le nom, centré
 * sous lui, est réduit de façon symétrique pour garder l'écart (sous NOM_LISIBLE_MIN_PX le nom est masqué : jamais de recouvrement du voisin).
 */
export function placerJoueurDeBord(e: EntreePlaceBord): PlaceBord {
  const { x, largeurTerrain: W, nom, rond, debord, voisinGauche, voisinDroite } = e;
  const centre = (x / 100) * W;
  const decalage = decalageDansTerrain(x, Math.max(rond, nom), W, debord);
  if (decalage > 0 && voisinDroite !== null && centre + decalage + nom / 2 > voisinDroite - ECART_NOMS_PX) {
    const place = voisinDroite - ECART_NOMS_PX - MARGE_BORD_PX;
    if (place >= rond) return { decalage: MARGE_BORD_PX + place / 2 - centre, nomMax: nomLisible(place) };
    const cible = MARGE_BORD_PX + rond / 2;
    return { decalage: cible - centre, nomMax: nomLisible(2 * (voisinDroite - ECART_NOMS_PX - cible)) };
  }
  if (decalage < 0 && voisinGauche !== null && centre + decalage - nom / 2 < voisinGauche + ECART_NOMS_PX) {
    const place = W - MARGE_BORD_PX - debord - voisinGauche - ECART_NOMS_PX;
    const droite = W - MARGE_BORD_PX - debord;
    if (place >= rond) return { decalage: droite - place / 2 - centre, nomMax: nomLisible(place) };
    const cible = droite - rond / 2;
    return { decalage: cible - centre, nomMax: nomLisible(2 * (cible - voisinGauche - ECART_NOMS_PX)) };
  }
  return { decalage, nomMax: null };
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
