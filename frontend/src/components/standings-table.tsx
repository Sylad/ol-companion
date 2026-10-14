import { seasonTeamLogoUrl } from '@/lib/calendar';
import { TeamLogo } from './team-logo';
import { OL_TEAM_ID, type StandingEntry, type FormOutcome } from '@/types/api';
import { cn } from '@/lib/utils';

interface StandingsTableProps {
  rows: StandingEntry[];
}

const COLUMNS = [
  { key: 'position', label: '#', align: 'center' as const, w: 'w-7 md:w-10' },
  { key: 'team', label: 'Club', align: 'left' as const },
  { key: 'played', label: 'MJ', align: 'center' as const, w: 'w-12', mobile: false },
  { key: 'won', label: 'G', align: 'center' as const, w: 'w-7 md:w-10' },
  { key: 'draw', label: 'N', align: 'center' as const, w: 'w-7 md:w-10' },
  { key: 'lost', label: 'P', align: 'center' as const, w: 'w-7 md:w-10' },
  { key: 'goalsFor', label: 'BP', align: 'center' as const, w: 'w-12', mobile: false },
  { key: 'goalsAgainst', label: 'BC', align: 'center' as const, w: 'w-12', mobile: false },
  { key: 'goalDifference', label: 'DB', align: 'center' as const, w: 'w-9 md:w-12' },
  { key: 'points', label: 'Pts', align: 'center' as const, w: 'w-10 md:w-14' },
  { key: 'form', label: '5 derniers', align: 'left' as const, w: 'w-[120px]', mobile: false },
];

const FORM_LABEL: Record<FormOutcome, string> = { W: 'Victoire', D: 'Match nul', L: 'Défaite' };
// L147 — lettres françaises : le « D » anglais (draw) se lisait Défaite.
const FORM_LETTER: Record<FormOutcome, string> = { W: 'V', D: 'N', L: 'D' };

function FormDot({ outcome }: { outcome: FormOutcome }) {
  const cls =
    outcome === 'W'
      ? 'bg-win text-bg'
      : outcome === 'L'
      ? 'bg-loss text-white'
      : 'bg-transparent border border-fg-dim text-fg-dim';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[10px] font-bold leading-none',
        cls,
      )}
      role="img"
      title={FORM_LABEL[outcome]}
      aria-label={FORM_LABEL[outcome]}
    >
      {FORM_LETTER[outcome]}
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

// L144 — la zone est dite en texte (lecteurs d'écran) et séparée par un filet : la couleur
// de la barre ne la porte plus seule (WCAG 1.4.1). La légende reprend les mêmes libellés.
const ZONES = [
  { label: 'Ligue des champions', color: 'bg-win', test: (p: number) => p <= 3 },
  { label: 'Ligue Europa', color: 'bg-ol-blue-bright', test: (p: number) => p >= 4 && p <= 5 },
  { label: 'Ligue Conférence', color: 'bg-cyan-500', test: (p: number) => p === 6 },
  { label: 'Barrage de relégation', color: 'bg-draw', test: (p: number) => p === 16 },
  { label: 'Relégation', color: 'bg-loss', test: (p: number) => p >= 17 },
];

function zoneOf(position: number) {
  return ZONES.find((z) => z.test(position));
}

function PositionDot({ position }: { position: number }) {
  const zone = zoneOf(position);
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'inline-block w-1 h-5 rounded-sm mr-1 md:mr-2 align-middle',
          zone?.color ?? 'bg-transparent',
        )}
      />
      {zone && <span className="sr-only">{zone.label} : </span>}
    </>
  );
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
                  'sticky top-0 z-10 bg-surface px-1 md:px-2 py-3 font-semibold uppercase tracking-wider text-[10px]',
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
          {rows.map((row, i) => {
            const prev = i > 0 ? zoneOf(rows[i - 1].position) : undefined;
            const rule = i > 0 && zoneOf(row.position) !== prev ? 'border-t border-border' : '';
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
                    rule,
                    'px-1 md:px-2 py-3 text-center num text-fg-muted relative whitespace-nowrap',
                    isOL && 'text-ol-red-bright font-semibold',
                  )}
                >
                  {isOL && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r-sm bg-ol-red" />
                  )}
                  <PositionDot position={row.position} />
                  <span className="align-middle">{row.position}</span>
                </td>
                <td className={cn("px-2 py-3 max-w-0 min-w-[7.25rem]", rule)}>
                  <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
                    <TeamLogo teamId={row.teamId} name={row.team} size={22} src={seasonTeamLogoUrl(row.teamId)} />
                    <span
                      title={row.team}
                      className={cn(
                        'min-w-[4.5rem] line-clamp-3 break-words text-xs leading-tight md:text-sm md:line-clamp-none md:truncate',
                        isOL ? 'text-fg-bright font-semibold' : 'text-fg',
                      )}
                    >
                      {row.team}
                    </span>
                  </div>
                </td>
                <td className={cn("hidden md:table-cell px-2 py-3 text-center num text-fg-muted", rule)}>
                  {row.played}
                </td>
                <td className={cn("px-1 md:px-2 py-3 text-center num text-fg-muted", rule)}>{row.won}</td>
                <td className={cn("px-1 md:px-2 py-3 text-center num text-fg-muted", rule)}>{row.draw}</td>
                <td className={cn("px-1 md:px-2 py-3 text-center num text-fg-muted", rule)}>{row.lost}</td>
                <td className={cn("hidden md:table-cell px-2 py-3 text-center num text-fg-muted", rule)}>
                  {row.goalsFor}
                </td>
                <td className={cn("hidden md:table-cell px-2 py-3 text-center num text-fg-muted", rule)}>
                  {row.goalsAgainst}
                </td>
                <td
                  className={cn(
                    rule,
                    'px-1 md:px-2 py-3 text-center num',
                    row.goalDifference > 0
                      ? 'text-win'
                      : row.goalDifference < 0
                      ? 'text-loss-fg'
                      : 'text-fg-muted',
                  )}
                >
                  {dgSign}
                  {row.goalDifference}
                </td>
                <td
                  className={cn(
                    rule,
                    'px-1 md:px-2 py-3 text-center num font-bold',
                    isOL ? 'text-fg-bright' : 'text-fg',
                  )}
                >
                  {row.points}
                </td>
                <td className={cn("hidden md:table-cell px-2 py-3", rule)}>
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
    { color: 'bg-win', label: 'Ligue des champions' },
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
