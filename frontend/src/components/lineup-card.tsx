import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { LiveMatchLineup, LiveMatchLineupPlayer } from '@/types/api';
import { hasJersey } from '@/lib/jersey';
import { positionShortFr } from '@/lib/position-fr';
import { cn } from '@/lib/utils';
import { TAILLE, TAILLES_NOM_PASTILLE } from '@/theme/typographie';

interface Props {
  lineup: LiveMatchLineup;
  teamName: string;
  /** Rouge = OL, bleu = adversaire (même convention que les stats et la carte des tirs) ; `france` bleu et `adverse` blanc sur un match des Bleus (L167 R4). */
  accent: 'red' | 'blue' | 'france' | 'adverse';
  /** Une composition voisine est probable : réserve la bande de l'étiquette pour que les terrains restent alignés (L160 R14). */
  reserveBand?: boolean;
}

const ACCENTS = {
  red: { chipClass: 'border-ol-red/50 text-fg', chipBorder: 'hsl(var(--ol-red) / 0.5)', numClass: 'text-ol-red-bright' },
  blue: { chipClass: 'border-ol-blue/60 text-fg', chipBorder: 'hsl(var(--ol-blue) / 0.6)', numClass: 'text-[hsl(226_70%_70%)]' },
  france: { chipClass: 'border-[hsl(224_80%_58%/0.6)] text-fg', chipBorder: 'hsl(224 80% 58% / 0.6)', numClass: 'text-[hsl(224_90%_75%)]' },
  adverse: { chipClass: 'border-[hsl(0_0%_96%/0.5)] text-fg', chipBorder: 'hsl(0 0% 96% / 0.5)', numClass: 'text-[hsl(0_0%_96%)]' },
} as const;

/** Hauteur du terrain : la même quelle que soit la formation, les rangées s'y répartissent (L160 R6, R7). */
const PITCH_HEIGHT = 'h-[360px]';

/**
 * Composition compacte : une rangée par nombre de la formation annoncée
 * (attaque en haut, gardien en bas), rangées centrées, pastilles de même
 * largeur, banc sur une ligne. Le terrain a une hauteur fixe pour que les
 * deux compositions de la page /match s'alignent.
 */
export function LineupCard({ lineup, teamName, accent, reserveBand = false }: Props) {
  const { rows, known } = buildRows(lineup);
  const widest = Math.max(1, ...rows.map((r) => r.length));
  const pitchRef = useRef<HTMLDivElement>(null);
  const quinconce = useQuinconce(pitchRef, lineup.starters, widest);
  const chipWidth = quinconce ? `${quinconce.largeur}px` : `calc((100% - ${(widest - 1) * 4}px) / ${widest})`;
  const { chipClass, chipBorder, numClass } = ACCENTS[accent];

  return (
    <section data-testid="bloc-composition" className="h-full rounded-md bg-surface border border-border overflow-hidden">
      {/* Le titre passe à la ligne plutôt que d'être tronqué (L160) : à 1440 la colonne fait 280 px, le nom d'un club
          dépasse vite la place laissée par la pastille. En-tête de deux lignes réservé pour que les deux terrains
          restent à la même ordonnée même si un seul titre se coupe. */}
      <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-2 min-[1440px]:min-h-[60px]">
        <h2 data-testid="titre-composition" className="eyebrow min-w-0">Composition · {teamName}</h2>
        {known && lineup.formation && (
          <span
            data-testid="formation-composition"
            className={cn('shrink-0 whitespace-nowrap text-petite font-bold tabular-nums num px-2 py-0.5 rounded-sm border', chipClass)}
          >
            {lineup.formation}
          </span>
        )}
      </header>
      {lineup.probable ? (
        <p data-testid="etiquette-probable" className="h-6 px-5 flex items-center text-petite text-fg-dim">
          Composition probable
        </p>
      ) : (
        reserveBand && <div data-testid="bande-reservee" aria-hidden="true" className="h-6" />
      )}
      <div className="px-3 py-3 space-y-2">
        <div
          ref={pitchRef}
          data-testid="terrain-composition"
          data-quinconce={quinconce ? true : undefined}
          className={cn(PITCH_HEIGHT, 'flex flex-col justify-around rounded-sm border border-border bg-surface-2/50 px-1 py-1.5')}
        >
          {rows.map((row, i) => {
            // L261 : en quinconce, une rangée qui ne tient plus sur une ligne avec les pastilles élargies alterne haut et bas.
            const decalee = !!quinconce && rangeeDecalee(row.length, quinconce);
            return (
              <div
                key={i}
                data-testid="rangee-composition"
                data-decalee={decalee || undefined}
                className={decalee ? 'grid justify-center gap-1' : 'flex justify-center gap-1'}
                style={decalee ? { gridTemplateColumns: `repeat(${row.length + 1}, ${(quinconce.largeur - 4) / 2}px)` } : undefined}
              >
                {row.map((p, k) => (
                  <PlayerChip
                    key={p.id}
                    player={p}
                    width={chipWidth}
                    borderColor={chipBorder}
                    numClass={numClass}
                    place={decalee ? { gridColumn: `${k + 1} / span 2`, gridRow: (k % 2) + 1 } : undefined}
                  />
                ))}
              </div>
            );
          })}
        </div>
        {lineup.bench.length > 0 && (
          <p data-testid="banc-composition" className="pt-2 border-t border-border text-petite text-fg-muted leading-relaxed">
            <span className="uppercase tracking-wider text-petite text-fg-dim mr-1.5">Banc</span>
            {lineup.bench.map((p, i) => (
              <Fragment key={p.id}>
                {i > 0 && ', '}
                {/* Numéro et nom insécables (L136) : la ligne ne se coupe qu'après la virgule. */}
                <span data-testid="joueur-banc" className="whitespace-nowrap">
                  {hasJersey(p.jerseyNumber) && <span className="num tabular-nums text-fg-dim">{p.jerseyNumber} </span>}
                  {p.shortName}
                </span>
              </Fragment>
            ))}
          </p>
        )}
      </div>
      {!known && (
        <p data-testid="note-repli" className="px-3 pb-3 text-petite text-fg-dim">
          Formation inconnue : rangées lues d’après les positions annoncées.
        </p>
      )}
    </section>
  );
}

function PlayerChip({
  player,
  width,
  borderColor,
  numClass,
  place,
}: {
  player: LiveMatchLineupPlayer;
  width: string;
  borderColor: string;
  numClass: string;
  /** Case de la grille d'une rangée en quinconce (L261). */
  place?: CSSProperties;
}) {
  // Un nom ne se coupe qu'au tiret ou à l'espace : départ à 12 px (`text-petite`), la mesure ci-dessous
  // descend par pas du thème (jusqu'à 8 px, exception documentée dans le thème) si un mot dépasse la pastille (L258, ex-11/10 px).
  const nameRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const chip = el.parentElement;
    const fit = () => fitNameFont(el);
    fit();
    if (typeof ResizeObserver === 'undefined' || !chip) return;
    // La pastille, pas le span : celui-ci est dimensionné par son contenu et ne bouge pas quand l'écran s'élargit.
    const ro = new ResizeObserver(fit);
    ro.observe(chip);
    return () => ro.disconnect();
  }, [player.shortName, width]);
  return (
    <span
      title={`${player.name}${player.positionShort ? ` · ${positionShortFr(player.positionShort)}` : ''}`}
      style={{ flex: `0 0 ${width}`, borderColor, ...place }}
      className={cn(
        'flex flex-col items-center justify-center text-center gap-0.5 min-w-0 rounded-sm border bg-surface-2/60 px-0.5 py-1 leading-tight text-fg',
      )}
    >
      {hasJersey(player.jerseyNumber) && (
        <span className={cn('num tabular-nums font-bold text-petite', numClass)}>{player.jerseyNumber}</span>
      )}
      <span
        ref={nameRef}
        className={cn(
          'font-medium min-w-0 max-w-full [overflow-wrap:normal] [word-break:normal] [hyphens:manual] text-petite',
        )}
      >
        {player.shortName}
      </span>
    </span>
  );
}

/**
 * L261 — quinconce. À 1440 px la colonne de la composition fait 280 px : cinq pastilles y laissent ~40 px au nom, et
 * « Çalhanoğlu » descendait à 8 px, « Nakamura » à 10 (QA du 18-11). Plutôt que de rétrécir le nom, dès qu'un morceau
 * de nom ne tient pas à 12 px, toutes les pastilles du bloc s'élargissent à la largeur de ce morceau (même largeur pour
 * toutes, règle L43 R7) et une rangée qui ne tient plus sur une ligne pose ses pastilles une sur deux en bas : grille
 * de c + 1 colonnes, chaque pastille sur deux colonnes, décalée d'une colonne sur sa voisine. Deux voisines ne sont
 * jamais à la même hauteur, l'ordre de gauche à droite est gardé. Largeur bornée à celle qui fait tenir la rangée la
 * plus fournie (n pastilles) en quinconce : 2 (W − 4n) / (n + 1) + 4 px ; un nom plus large encore rétrécit à la
 * mesure (`fitNameFont`, dernier recours, plancher 8 px).
 */
export interface Quinconce {
  /** Largeur commune des pastilles, en px. */
  largeur: number;
  /** Largeur utile d'une rangée (terrain moins son padding), en px. */
  rangee: number;
}

/** Une rangée de c pastilles tient sur une ligne si c × largeur + (c − 1) × 4 px ≤ largeur de la rangée. */
export const rangeeDecalee = (count: number, q: Quinconce) => count * q.largeur + (count - 1) * 4 > q.rangee + 0.5;

/** Morceaux d'un nom tels qu'il se coupe : à l'espace, ou après un tiret (le tiret reste au bout du morceau). */
export const morceaux = (nom: string) => nom.split(/\s+/).flatMap((m) => m.split(/(?<=-)/)).filter(Boolean);

/** Largeur des pastilles en quinconce, ou null si chaque morceau de nom tient à 12 px dans une pastille ordinaire. */
export function largeurQuinconce(rangee: number, widest: number, bords: number, morceauLePlusLarge: number): number | null {
  const ordinaire = (rangee - (widest - 1) * 4) / widest;
  if (morceauLePlusLarge <= ordinaire - bords + 0.5) return null;
  const plafond = (2 * (rangee - 4 * widest)) / (widest + 1) + 4;
  return Math.max(ordinaire, Math.min(plafond, Math.ceil(morceauLePlusLarge + bords + 1)));
}

/**
 * Mesure réelle (police chargée, largeur du terrain), refaite quand le terrain change de largeur. Sans mise en page
 * (jsdom), largeur nulle : pas de quinconce.
 */
function useQuinconce(pitchRef: RefObject<HTMLDivElement | null>, starters: LiveMatchLineupPlayer[], widest: number): Quinconce | null {
  const [quinconce, setQuinconce] = useState<Quinconce | null>(null);
  const noms = starters.map((p) => p.shortName).join(' ');
  useLayoutEffect(() => {
    const pitch = pitchRef.current;
    if (!pitch) return;
    const decide = () => {
      const row = pitch.querySelector<HTMLElement>('[data-testid="rangee-composition"]');
      const chip = row?.firstElementChild as HTMLElement | null;
      const nom = chip?.lastElementChild as HTMLElement | null;
      if (!row || !chip || !nom || row.clientWidth === 0) return;
      const cs = getComputedStyle(chip);
      const bords = (['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'] as const).reduce((t, k) => t + (parseFloat(cs[k]) || 0), 0);
      const ns = getComputedStyle(nom);
      const mesure = document.createElement('span');
      Object.assign(mesure.style, {
        position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', fontFamily: ns.fontFamily, fontWeight: ns.fontWeight,
        letterSpacing: ns.letterSpacing, fontFeatureSettings: ns.fontFeatureSettings, fontSize: TAILLE.petite,
      });
      pitch.appendChild(mesure);
      let large = 0;
      for (const m of morceaux(noms)) {
        mesure.textContent = m;
        large = Math.max(large, mesure.getBoundingClientRect().width);
      }
      mesure.remove();
      const largeur = largeurQuinconce(row.clientWidth, widest, bords, large);
      setQuinconce((avant) =>
        largeur === null ? null : avant && avant.largeur === largeur && avant.rangee === row.clientWidth ? avant : { largeur, rangee: row.clientWidth },
      );
    };
    decide();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(decide);
    ro.observe(pitch);
    return () => ro.disconnect();
  }, [pitchRef, noms, widest]);
  return quinconce;
}

/** Tailles essayées, de la plus grande à la plus petite ; la dernière est le plancher (thème, L258 : 12 → 8 px, en rem). */
export const NAME_FONT_SIZES = TAILLES_NOM_PASTILLE;

/**
 * Le nom ne se coupe pas en milieu de mot : on prend la plus grande taille dont le mot le plus
 * long tient dans la pastille (scrollWidth ≤ largeur utile de la pastille), de 12 px (plancher 8 px, seule exception au plancher de 12 px). Mesure réelle, car
 * la largeur dépend de l'écran et de la police (« Omobamidele » déborde de 10 px à 320 px).
 */
export function fitNameFont(el: HTMLElement): void {
  // Largeur de la pastille (moins son padding), pas celle du span, qui épouse son contenu.
  const box = el.parentElement ?? el;
  const cs = getComputedStyle(box);
  const room = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  for (const size of NAME_FONT_SIZES) {
    el.style.fontSize = size;
    if (el.scrollWidth <= room) return;
  }
}

const byPitch = (a: LiveMatchLineupPlayer, b: LiveMatchLineupPlayer) => a.yardLine - b.yardLine || a.yardSide - b.yardSide;

/**
 * Rangées de haut en bas (attaque d'abord, gardien en dernier). Formation lisible et totalisant
 * les 10 joueurs de champ : le gardien seul, les autres triés (yardLine, yardSide) puis découpés
 * selon la formation. Sinon repli : une rangée par yardLine.
 */
function buildRows(lineup: LiveMatchLineup): { rows: LiveMatchLineupPlayer[][]; known: boolean } {
  const starters = [...lineup.starters].sort(byPitch);
  const counts = (lineup.formation ?? '').split('-').map(Number);
  const gkIndex = Math.max(0, starters.findIndex((p) => p.positionShort === 'GK'));
  const field = starters.filter((_, i) => i !== gkIndex);
  const valid =
    counts.length > 1 &&
    counts.every((n) => Number.isInteger(n) && n > 0) &&
    counts.reduce((a, b) => a + b, 0) === 10 &&
    field.length === 10;
  if (!valid) return { rows: groupByLine(lineup.starters), known: false };

  const bands: LiveMatchLineupPlayer[][] = [];
  let at = 0;
  for (const n of counts) {
    bands.push(field.slice(at, at + n).sort((a, b) => a.yardSide - b.yardSide));
    at += n;
  }
  return { rows: [...bands.reverse(), [starters[gkIndex]]], known: true };
}

/** Repli : attaque en haut, gardien en bas ; dans une ligne, de gauche à droite (yardSide). */
function groupByLine(starters: LiveMatchLineupPlayer[]): LiveMatchLineupPlayer[][] {
  const map = new Map<number, LiveMatchLineupPlayer[]>();
  for (const p of starters) {
    const arr = map.get(p.yardLine) ?? [];
    arr.push(p);
    map.set(p.yardLine, arr);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, players]) => [...players].sort((a, b) => a.yardSide - b.yardSide));
}
