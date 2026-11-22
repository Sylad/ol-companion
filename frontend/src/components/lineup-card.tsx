import { Fragment, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { LiveMatchLineup, LiveMatchLineupPlayer } from '@/types/api';
import { hasJersey } from '@/lib/jersey';
import { positionShortFr } from '@/lib/position-fr';
import { cn } from '@/lib/utils';
import { TAILLE } from '@/theme/typographie';
import { nomsDeRangee } from '@/lib/coupure-nom';

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
  const nomsCoupes = useNomsCoupes(pitchRef, rows, widest);
  const chipWidth = `calc((100% - ${(widest - 1) * 4}px) / ${widest})`;
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
          data-coupe={nomsCoupes ? true : undefined}
          className={cn(PITCH_HEIGHT, 'flex flex-col justify-around rounded-sm border border-border bg-surface-2/50 px-1 py-1.5')}
        >
          {rows.map((row, i) => (
            // L269 : une rangée de la formation = une ligne à l'écran, toujours (plus de quinconce).
            <div key={i} data-testid="rangee-composition" className="flex justify-center gap-1">
              {row.map((p) => (
                <PlayerChip
                  key={p.id}
                  player={p}
                  nom={nomsCoupes?.get(p.id) ?? p.shortName}
                  width={chipWidth}
                  borderColor={chipBorder}
                  numClass={numClass}
                />
              ))}
            </div>
          ))}
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
  nom,
  width,
  borderColor,
  numClass,
}: {
  player: LiveMatchLineupPlayer;
  /** Nom affiché : `shortName`, avec des césures douces en dernier recours (L269). */
  nom: string;
  width: string;
  borderColor: string;
  numClass: string;
}) {
  // L269 — le nom reste à 12 px (`text-petite`) et ne se coupe qu'à l'espace ou après un tiret. La pastille part de la
  // largeur commune (L43 R7) mais ne descend jamais sous son mot le plus large (`min-width: auto` d'un élément flex =
  // largeur min-content) : un nom long élargit sa pastille, ses voisines cèdent la place (flex-shrink), la rangée reste
  // sur une ligne. `useNomsCoupes` ne coupe un mot (syllabes, trait d'union) que si la rangée ne tient pas autrement.
  return (
    <span
      data-testid="pastille-composition"
      title={`${player.name}${player.positionShort ? ` · ${positionShortFr(player.positionShort)}` : ''}`}
      style={{ flex: `0 1 ${width}`, borderColor }}
      className="flex flex-col items-center justify-center text-center gap-0.5 rounded-sm border bg-surface-2/60 px-0.5 py-1 leading-tight text-fg"
    >
      {hasJersey(player.jerseyNumber) && (
        <span className={cn('num tabular-nums font-bold text-petite', numClass)}>{player.jerseyNumber}</span>
      )}
      <span className="font-medium max-w-full [overflow-wrap:normal] [word-break:normal] [hyphens:manual] text-petite">{nom}</span>
    </span>
  );
}

/**
 * L269 — dernier recours. Rangée par rangée, la place minimale des pastilles (mot le plus large du nom à 12 px, plus
 * padding et bordures) est mesurée avec la vraie police et la vraie largeur du terrain. Si une rangée ne tient pas sur
 * une ligne même ainsi, ses noms les plus larges, un à un et seulement ceux qu'il faut (`nomsDeRangee`), reçoivent des
 * césures syllabiques : le nom passe sur deux lignes avec un trait d'union, toujours à 12 px. Rends les seuls noms
 * changés, ou null : aucun nom touché.
 * Mesure refaite quand le terrain change de largeur et quand la police est chargée. Sans mise en page (jsdom) : null.
 */
function useNomsCoupes(
  pitchRef: RefObject<HTMLDivElement | null>,
  rows: LiveMatchLineupPlayer[][],
  widest: number,
): Map<number, string> | null {
  const [coupes, setCoupes] = useState<Map<number, string> | null>(null);
  const cle = rows.map((r) => r.map((p) => `${p.id}:${p.shortName}`).join(',')).join('|');
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useLayoutEffect(() => {
    const pitch = pitchRef.current;
    if (!pitch) return;
    let vivant = true;
    const decide = () => {
      if (!vivant) return;
      const row = pitch.querySelector<HTMLElement>('[data-testid="rangee-composition"]');
      const chip = row?.firstElementChild as HTMLElement | null;
      const nom = chip?.lastElementChild as HTMLElement | null;
      if (!row || !chip || !nom || row.clientWidth === 0) return;
      const cs = getComputedStyle(chip);
      const bords = (['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'] as const).reduce((t, k) => t + (parseFloat(cs[k]) || 0), 0);
      const ns = getComputedStyle(nom);
      const sonde = document.createElement('span');
      Object.assign(sonde.style, {
        position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', fontFamily: ns.fontFamily, fontWeight: ns.fontWeight,
        letterSpacing: ns.letterSpacing, fontFeatureSettings: ns.fontFeatureSettings, fontSize: TAILLE.petite,
      });
      pitch.appendChild(sonde);
      const largeurs = new Map<string, number>();
      const mesure = (texte: string) => {
        let l = largeurs.get(texte);
        if (l === undefined) {
          sonde.textContent = texte;
          l = sonde.getBoundingClientRect().width;
          largeurs.set(texte, l);
        }
        return l;
      };
      const rangee = row.clientWidth;
      const place = (rangee - (widest - 1) * 4) / widest - bords;
      const changes = new Map<number, string>();
      for (const r of rowsRef.current) {
        const noms = nomsDeRangee(r.map((p) => p.shortName), mesure, bords, rangee, place);
        r.forEach((p, k) => {
          if (noms[k] !== p.shortName) changes.set(p.id, noms[k]);
        });
      }
      const suivant = changes.size ? changes : null;
      sonde.remove();
      setCoupes((avant) => {
        if (!avant || !suivant) return avant === suivant ? avant : suivant;
        return [...suivant].every(([id, n]) => avant.get(id) === n) && avant.size === suivant.size ? avant : suivant;
      });
    };
    decide();
    document.fonts?.ready.then(decide).catch(() => {});
    if (typeof ResizeObserver === 'undefined') return () => { vivant = false; };
    const ro = new ResizeObserver(decide);
    ro.observe(pitch);
    return () => {
      vivant = false;
      ro.disconnect();
    };
  }, [pitchRef, cle, widest]);
  return coupes;
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
