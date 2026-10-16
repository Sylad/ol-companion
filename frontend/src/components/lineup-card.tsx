import { Fragment, useLayoutEffect, useRef } from 'react';
import type { LiveMatchLineup, LiveMatchLineupPlayer } from '@/types/api';
import { positionShortFr } from '@/lib/position-fr';
import { cn } from '@/lib/utils';

interface Props {
  lineup: LiveMatchLineup;
  teamName: string;
  /** Rouge = OL, bleu = adversaire (même convention que les stats et la carte des tirs). */
  accent: 'red' | 'blue';
  /** Une composition voisine est probable : réserve la bande de l'étiquette pour que les terrains restent alignés (L160 R14). */
  reserveBand?: boolean;
}

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
  const chipWidth = `calc((100% - ${(widest - 1) * 4}px) / ${widest})`;
  const chipClass = accent === 'red' ? 'border-ol-red/50 text-fg' : 'border-ol-blue/60 text-fg';
  // Bordure des pastilles en style en ligne : la classe reste identique d'un bloc à l'autre (R7).
  const chipBorder = accent === 'red' ? 'hsl(var(--ol-red) / 0.5)' : 'hsl(var(--ol-blue) / 0.6)';
  const numClass = accent === 'red' ? 'text-ol-red-bright' : 'text-[hsl(226_70%_70%)]';

  return (
    <section data-testid="bloc-composition" className="h-full rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-2">
        <h2 data-testid="titre-composition" className="eyebrow truncate min-w-0">Composition · {teamName}</h2>
        {known && lineup.formation && (
          <span
            data-testid="formation-composition"
            className={cn('shrink-0 whitespace-nowrap text-[10px] font-bold tabular-nums num px-2 py-0.5 rounded-sm border', chipClass)}
          >
            {lineup.formation}
          </span>
        )}
      </header>
      {lineup.probable ? (
        <p data-testid="etiquette-probable" className="h-6 px-5 flex items-center text-[11px] text-fg-dim">
          Composition probable
        </p>
      ) : (
        reserveBand && <div data-testid="bande-reservee" aria-hidden="true" className="h-6" />
      )}
      <div className="px-3 py-3 space-y-2">
        <div
          data-testid="terrain-composition"
          className={cn(PITCH_HEIGHT, 'flex flex-col justify-around rounded-sm border border-border bg-surface-2/50 px-1 py-1.5')}
        >
          {rows.map((row, i) => (
            <div key={i} data-testid="rangee-composition" className="flex justify-center gap-1">
              {row.map((p) => (
                <PlayerChip key={p.id} player={p} width={chipWidth} borderColor={chipBorder} numClass={numClass} />
              ))}
            </div>
          ))}
        </div>
        {lineup.bench.length > 0 && (
          <p data-testid="banc-composition" className="pt-2 border-t border-border text-[11px] text-fg-muted leading-relaxed">
            <span className="uppercase tracking-wider text-[10px] text-fg-dim mr-1.5">Banc</span>
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
        <p data-testid="note-repli" className="px-3 pb-3 text-[11px] text-fg-dim">
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
}: {
  player: LiveMatchLineupPlayer;
  width: string;
  borderColor: string;
  numClass: string;
}) {
  // Un nom ne se coupe qu'au tiret ou à l'espace : si un mot dépasse la pastille, 10 px au lieu de 11.
  // Valeur de départ (avant mesure, ou sans géométrie) ; la mesure ci-dessous a le dernier mot.
  const longWord = player.shortName.split(/[-\s]+/).some((w) => w.length > 10);
  const nameRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const fit = () => fitNameFont(el);
    fit();
    // La largeur de la pastille ne change qu'avec la fenêtre (colonnes de 280 px à 1440, pleine largeur dessous) :
    // on réécoute `resize` plutôt qu'un observateur par pastille (22 par page).
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [player.shortName, width]);
  return (
    <span
      title={`${player.name}${player.positionShort ? ` · ${positionShortFr(player.positionShort)}` : ''}`}
      style={{ flex: `0 0 ${width}`, borderColor }}
      className={cn(
        'flex flex-col items-center justify-center text-center gap-0.5 min-w-0 rounded-sm border bg-surface-2/60 px-0.5 py-1 leading-tight text-fg',
      )}
    >
      {hasJersey(player.jerseyNumber) && (
        <span className={cn('num tabular-nums font-bold text-[11px]', numClass)}>{player.jerseyNumber}</span>
      )}
      <span
        ref={nameRef}
        className={cn(
          'font-medium min-w-0 max-w-full [overflow-wrap:normal] [word-break:normal] [hyphens:manual]',
          longWord ? 'text-[10px]' : 'text-[11px]',
        )}
      >
        {player.shortName}
      </span>
    </span>
  );
}

/** Tailles essayées, de la plus grande à la plus petite ; la dernière est le plancher. */
export const NAME_FONT_SIZES = [11, 10, 9, 8];

/**
 * Le nom ne se coupe pas en milieu de mot : on prend la plus grande taille dont le mot le plus
 * long tient dans la pastille (scrollWidth ≤ largeur utile de la pastille), plancher 8 px. Mesure réelle, car
 * la largeur dépend de l'écran et de la police (« Omobamidele » déborde de 10 px à 320 px).
 */
export function fitNameFont(el: HTMLElement): void {
  // Largeur de la pastille (moins son padding), pas celle du span, qui épouse son contenu.
  const box = el.parentElement ?? el;
  const cs = getComputedStyle(box);
  const room = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  for (const size of NAME_FONT_SIZES) {
    el.style.fontSize = `${size}px`;
    if (el.scrollWidth <= room) return;
  }
}

/** Un numéro 0 est un remplissage de la source : jamais affiché. */
const hasJersey = (n: number | null): n is number => n !== null && n > 0;

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
