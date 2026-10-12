import type { LiveMatchLineup, LiveMatchLineupPlayer } from '@/types/api';
import { positionShortFr } from '@/lib/position-fr';
import { cn } from '@/lib/utils';

interface Props {
  lineup: LiveMatchLineup;
  teamName: string;
  /** Rouge = OL, bleu = adversaire (même convention que les stats et la carte des tirs). */
  accent: 'red' | 'blue';
}

/**
 * Composition compacte : une rangée par nombre de la formation annoncée
 * (attaque en haut, gardien en bas), rangées centrées, pastilles de même
 * largeur, banc sur une ligne. Pensée pour tenir sous « Joueurs en vue » /
 * « Statistiques » sans faire scroller la page /match.
 */
export function LineupCard({ lineup, teamName, accent }: Props) {
  const { rows, known } = buildRows(lineup);
  const widest = Math.max(1, ...rows.map((r) => r.length));
  const chipWidth = `calc((100% - ${(widest - 1) * 4}px) / ${widest})`;
  const chipClass = accent === 'red' ? 'border-ol-red/50 text-fg' : 'border-ol-blue/60 text-fg';
  // Bordure des pastilles en style en ligne : la classe reste identique d'un bloc à l'autre (R7).
  const chipBorder = accent === 'red' ? 'hsl(var(--ol-red) / 0.5)' : 'hsl(var(--ol-blue) / 0.6)';
  const numClass = accent === 'red' ? 'text-ol-red-bright' : 'text-[hsl(226_70%_70%)]';

  return (
    <section data-testid="bloc-composition" className="rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-2">
        <div data-testid="titre-composition" className="eyebrow truncate">Composition · {teamName}</div>
        {known && lineup.formation && (
          <span
            data-testid="formation-composition"
            className={cn('text-[10px] font-bold tabular-nums num px-2 py-0.5 rounded-sm border', chipClass)}
          >
            {lineup.formation}
          </span>
        )}
      </header>
      <div className="px-3 py-3 space-y-2">
        {rows.map((row, i) => (
          <div key={i} data-testid="rangee-composition" className="flex justify-center gap-1">
            {row.map((p) => (
              <PlayerChip key={p.id} player={p} width={chipWidth} borderColor={chipBorder} numClass={numClass} />
            ))}
          </div>
        ))}
        {lineup.bench.length > 0 && (
          <p data-testid="banc-composition" className="pt-2 border-t border-border text-[11px] text-fg-muted leading-relaxed">
            <span className="uppercase tracking-wider text-[10px] text-fg-dim mr-1.5">Banc</span>
            {lineup.bench.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                {p.jerseyNumber !== null && <span className="num tabular-nums text-fg-dim">{p.jerseyNumber} </span>}
                {p.shortName}
              </span>
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
  const longWord = player.shortName.split(/[-\s]+/).some((w) => w.length > 10);
  return (
    <span
      title={`${player.name}${player.positionShort ? ` · ${positionShortFr(player.positionShort)}` : ''}`}
      style={{ flex: `0 0 ${width}`, borderColor }}
      className={cn(
        'flex flex-col items-center text-center gap-0.5 min-w-0 rounded-sm border bg-surface-2/60 px-0.5 py-1 leading-tight text-fg',
      )}
    >
      {player.jerseyNumber !== null && (
        <span className={cn('num tabular-nums font-bold text-[11px]', numClass)}>{player.jerseyNumber}</span>
      )}
      <span
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
