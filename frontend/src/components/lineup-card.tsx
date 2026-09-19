import type { LiveMatchLineup, LiveMatchLineupPlayer } from '@/types/api';
import { cn } from '@/lib/utils';

interface Props {
  lineup: LiveMatchLineup;
  teamName: string;
  /** Rouge = OL, bleu = adversaire (même convention que les stats et la carte des tirs). */
  accent: 'red' | 'blue';
}

/**
 * Composition compacte : lignes de la formation empilées comme sur un terrain
 * (attaque en haut, gardien en bas), banc sur une ligne. Pensée pour tenir sous
 * « Joueurs en vue » / « Statistiques » sans faire scroller la page /match.
 */
export function LineupCard({ lineup, teamName, accent }: Props) {
  const lines = groupByLine(lineup.starters);
  const chipClass = accent === 'red' ? 'border-ol-red/50 text-fg' : 'border-ol-blue/60 text-fg';
  const numClass = accent === 'red' ? 'text-ol-red-bright' : 'text-ol-blue-bright';

  return (
    <section className="rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="eyebrow truncate">Composition · {teamName}</div>
        {lineup.formation && (
          <span className={cn('text-[10px] font-bold tabular-nums num px-2 py-0.5 rounded-sm border', chipClass)}>
            {lineup.formation}
          </span>
        )}
      </header>
      <div className="px-3 py-3 space-y-2">
        {lines.map((line) => (
          <div key={line.yardLine} className="flex flex-wrap justify-center gap-1.5">
            {line.players.map((p) => (
              <PlayerChip key={p.id} player={p} chipClass={chipClass} numClass={numClass} />
            ))}
          </div>
        ))}
        {lineup.bench.length > 0 && (
          <p className="pt-2 border-t border-border text-[11px] text-fg-muted leading-relaxed">
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
    </section>
  );
}

function PlayerChip({ player, chipClass, numClass }: { player: LiveMatchLineupPlayer; chipClass: string; numClass: string }) {
  return (
    <span
      title={`${player.name}${player.positionShort ? ` · ${player.positionShort}` : ''}`}
      className={cn('inline-flex items-center gap-1.5 rounded-sm border bg-surface-2/60 px-2 py-1 text-xs whitespace-nowrap', chipClass)}
    >
      {player.jerseyNumber !== null && (
        <span className={cn('num tabular-nums font-bold text-[11px]', numClass)}>{player.jerseyNumber}</span>
      )}
      <span className="font-medium">{player.shortName}</span>
    </span>
  );
}

/** Attaque en haut, gardien en bas ; dans une ligne, de gauche à droite (fieldSide). */
function groupByLine(starters: LiveMatchLineupPlayer[]): { yardLine: number; players: LiveMatchLineupPlayer[] }[] {
  const map = new Map<number, LiveMatchLineupPlayer[]>();
  for (const p of starters) {
    const arr = map.get(p.yardLine) ?? [];
    arr.push(p);
    map.set(p.yardLine, arr);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([yardLine, players]) => ({ yardLine, players: [...players].sort((a, b) => a.yardSide - b.yardSide) }));
}
