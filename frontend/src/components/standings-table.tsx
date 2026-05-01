import { TeamLogo } from './team-logo';
import { OL_TEAM_ID, type StandingEntry, type FormOutcome } from '@/types/api';
import { cn } from '@/lib/utils';

interface StandingsTableProps {
  rows: StandingEntry[];
}

const COLUMNS = [
  { key: 'position', label: '#', align: 'center' as const, w: 'w-10' },
  { key: 'team', label: 'Club', align: 'left' as const },
  { key: 'played', label: 'MJ', align: 'center' as const, w: 'w-12', mobile: false },
  { key: 'won', label: 'G', align: 'center' as const, w: 'w-10' },
  { key: 'draw', label: 'N', align: 'center' as const, w: 'w-10' },
  { key: 'lost', label: 'P', align: 'center' as const, w: 'w-10' },
  { key: 'goalsFor', label: 'BP', align: 'center' as const, w: 'w-12', mobile: false },
  { key: 'goalsAgainst', label: 'BC', align: 'center' as const, w: 'w-12', mobile: false },
  { key: 'goalDifference', label: 'DB', align: 'center' as const, w: 'w-12' },
  { key: 'points', label: 'Pts', align: 'center' as const, w: 'w-14' },
  { key: 'form', label: '5 derniers', align: 'left' as const, w: 'w-[120px]', mobile: false },
];

const FORM_LABEL: Record<FormOutcome, string> = { W: 'Victoire', D: 'Match nul', L: 'Défaite' };

function FormDot({ outcome }: { outcome: FormOutcome }) {
  const cls =
    outcome === 'W'
      ? 'bg-win text-bg'
      : outcome === 'L'
      ? 'bg-loss text-bg'
      : 'bg-transparent border border-fg-dim text-fg-dim';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[10px] font-bold leading-none',
        cls,
      )}
      title={FORM_LABEL[outcome]}
      aria-label={FORM_LABEL[outcome]}
    >
      {outcome}
    </span>
  );
}

function FormStrip({ form }: { form: FormOutcome[] | undefined }) {
  if (!form?.length) {
    return <span className="text-fg-dim text-xs">—</span>;
  }
  const ordered = [...form].reverse();
  return (
    <div className="flex items-center gap-1">
      {ordered.map((o, i) => (
        <FormDot key={i} outcome={o} />
      ))}
    </div>
  );
}

function PositionDot({ position }: { position: number }) {
  let bg = 'bg-transparent';
  if (position <= 3) bg = 'bg-win';
  else if (position <= 5) bg = 'bg-ol-blue-bright';
  else if (position === 6) bg = 'bg-cyan-500';
  else if (position === 16) bg = 'bg-draw';
  else if (position >= 17) bg = 'bg-loss';

  return <span className={cn('inline-block w-1 h-5 rounded-sm mr-2 align-middle', bg)} />;
}

export function StandingsTable({ rows }: StandingsTableProps) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="text-fg-dim">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'sticky top-0 z-10 bg-surface px-2 py-3 font-semibold uppercase tracking-wider text-[10px]',
                  col.w,
                  col.align === 'center' ? 'text-center' : 'text-left',
                  col.mobile === false && 'hidden md:table-cell',
                  'border-b border-border',
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOL = row.teamId === OL_TEAM_ID;
            const dgSign =
              row.goalDifference > 0 ? '+' : row.goalDifference < 0 ? '' : '';

            return (
              <tr
                key={row.teamId}
                className={cn(
                  'group transition-colors',
                  isOL
                    ? 'bg-ol-red/5 hover:bg-ol-red/10'
                    : 'hover:bg-surface-2/50',
                )}
              >
                <td
                  className={cn(
                    'px-2 py-3 text-center num text-fg-muted relative',
                    isOL && 'text-ol-red-bright font-semibold',
                  )}
                >
                  {isOL && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r-sm bg-ol-red" />
                  )}
                  <PositionDot position={row.position} />
                  <span className="align-middle">{row.position}</span>
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <TeamLogo teamId={row.teamId} name={row.team} size={22} />
                    <span
                      className={cn(
                        'truncate',
                        isOL ? 'text-fg-bright font-semibold' : 'text-fg',
                      )}
                    >
                      {row.team}
                    </span>
                  </div>
                </td>
                <td className="hidden md:table-cell px-2 py-3 text-center num text-fg-muted">
                  {row.played}
                </td>
                <td className="px-2 py-3 text-center num text-fg-muted">{row.won}</td>
                <td className="px-2 py-3 text-center num text-fg-muted">{row.draw}</td>
                <td className="px-2 py-3 text-center num text-fg-muted">{row.lost}</td>
                <td className="hidden md:table-cell px-2 py-3 text-center num text-fg-muted">
                  {row.goalsFor}
                </td>
                <td className="hidden md:table-cell px-2 py-3 text-center num text-fg-muted">
                  {row.goalsAgainst}
                </td>
                <td
                  className={cn(
                    'px-2 py-3 text-center num',
                    row.goalDifference > 0
                      ? 'text-win'
                      : row.goalDifference < 0
                      ? 'text-loss'
                      : 'text-fg-muted',
                  )}
                >
                  {dgSign}
                  {row.goalDifference}
                </td>
                <td
                  className={cn(
                    'px-2 py-3 text-center num font-bold',
                    isOL ? 'text-fg-bright' : 'text-fg',
                  )}
                >
                  {row.points}
                </td>
                <td className="hidden md:table-cell px-2 py-3">
                  <FormStrip form={row.recentForm} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Legend />
    </div>
  );
}

function Legend() {
  const items = [
    { color: 'bg-win', label: 'Ligue des Champions' },
    { color: 'bg-ol-blue-bright', label: 'Ligue Europa' },
    { color: 'bg-cyan-500', label: 'Ligue Conférence' },
    { color: 'bg-draw', label: 'Barrage de relégation' },
    { color: 'bg-loss', label: 'Relégation' },
  ];

  return (
    <div className="mt-5 px-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-fg-dim">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={cn('inline-block w-1 h-3 rounded-sm', item.color)} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
