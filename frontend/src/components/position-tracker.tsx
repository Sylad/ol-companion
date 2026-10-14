import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  type TooltipProps,
} from 'recharts';
import { Info, Loader2 } from 'lucide-react';
import { useSeasonRankings } from '@/hooks/use-season-rankings';
import { RetryMessage } from '@/components/retry-message';

interface ChartPoint {
  matchday: number;
  position: number;
  points: number;
}

const POSITION_COLOR = '#3b5dc9'; // OL blue bright — bleu identité OL, pas vert
const HIGHLIGHT_COLOR = '#ef4444'; // OL red — pour le point "vous êtes ici"
const GRID_COLOR = 'hsl(var(--border))';
const AXIS_COLOR = 'hsl(var(--fg-dim))';

function PositionTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ChartPoint;
  return (
    <div className="rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <div className="text-fg-dim mb-1">Journée {p.matchday}</div>
      <div className="text-fg-bright font-semibold num">
        {p.position}
        <sup>{p.position === 1 ? 'er' : 'e'}</sup>{' '}
        place
      </div>
      <div className="text-fg-muted num">{p.points} pts</div>
    </div>
  );
}

// L151 : `interval={1}` de recharts saute un tick sur deux (J6 sans étiquette) ; on
// fixe donc les journées étiquetées. ≤ 20 points : toutes ; au-delà : première,
// multiples de 5 et dernière (un multiple à moins de 2 de la dernière est écarté).
export function matchdayTicks(data: { matchday: number }[]): number[] {
  const jours = data.map((d) => d.matchday);
  if (jours.length <= 20) return jours;
  const first = jours[0];
  const last = jours[jours.length - 1];
  const milieu = jours.filter((m) => m > first && m < last && m % 5 === 0 && last - m > 1);
  return [first, ...milieu, last];
}

export function PositionTracker() {
  const { data, isLoading, isError, refetch } = useSeasonRankings();

  return (
    <section className="rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-4 flex items-center justify-between border-b border-border">
        <div>
          <div className="eyebrow mb-1">Saison en cours</div>
          <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
            Tracker de classement
          </h2>
        </div>
        <div className="group relative">
          <button
            type="button"
            aria-label="Position de l'OL au fil des journées de Ligue 1"
            aria-describedby="info-position-tracker"
            className="text-fg-dim hover:text-fg cursor-help rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b5dc9]"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
          <span
            id="info-position-tracker"
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden w-56 rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-xs text-fg shadow-lg group-hover:block group-focus-within:block"
          >
            Position de l'OL au fil des journées de Ligue 1
          </span>
        </div>
      </header>

      <div className="p-5">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-fg-dim">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span>Chargement de l'évolution…</span>
          </div>
        )}
        {isError && !data && (
          <RetryMessage
            className="flex flex-col items-center gap-3 py-12 text-center"
            message="Impossible de charger l'évolution du classement."
            onRetry={() => void refetch()}
            messageTestId="message-erreur-position-tracker"
            buttonTestId="bouton-reessayer-position-tracker"
          />
        )}
        {data && data.length === 0 && (
          <p className="py-12 text-center text-fg-muted">Aucune donnée d'évolution disponible.</p>
        )}
        {data && data.length > 0 && <Chart data={data} />}
      </div>
    </section>
  );
}

function Chart({ data }: { data: ChartPoint[] }) {
  const lastIdx = data.length - 1;
  const lastPoint = data[lastIdx];
  const maxPosition = Math.max(...data.map((d) => d.position), 18);

  const yTicks = [1, 5, 10, 15, 18].filter((t) => t <= Math.max(maxPosition, 18));

  return (
    <>
      <div className="h-[280px] w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 12, right: 12, left: -10, bottom: 4 }}
          >
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="matchday"
              stroke={AXIS_COLOR}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              ticks={matchdayTicks(data)}
              interval={0}
              label={{ value: 'Journée', position: 'insideBottom', fill: AXIS_COLOR, fontSize: 10, dy: 8 }}
            />
            <YAxis
              reversed
              domain={[1, 18]}
              ticks={yTicks}
              stroke={AXIS_COLOR}
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip content={<PositionTooltip />} cursor={{ stroke: GRID_COLOR, strokeDasharray: '3 4' }} />
            <Line
              type="monotone"
              dataKey="position"
              stroke={POSITION_COLOR}
              strokeWidth={2.5}
              dot={{ fill: POSITION_COLOR, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: POSITION_COLOR, stroke: 'hsl(var(--bg))', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={lastPoint.matchday}
              y={lastPoint.position}
              r={6}
              fill={HIGHLIGHT_COLOR}
              stroke="hsl(var(--bg))"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="sr-only" data-testid="resume-position-tracker">
        Évolution de l'OL au classement de Ligue 1 : {lastPoint.position}
        {lastPoint.position === 1 ? 'er' : 'e'} place après la journée {lastPoint.matchday},{' '}
        {lastPoint.points} pts. Départ : {data[0].position}
        {data[0].position === 1 ? 'er' : 'e'} place à la journée {data[0].matchday}.
      </p>
      <div className="sr-only">
        <table>
          <caption>Évolution de l'OL au classement de Ligue 1, journée par journée</caption>
          <thead>
            <tr>
              <th scope="col">Journée</th>
              <th scope="col">Place</th>
              <th scope="col">Points</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.matchday}>
                <th scope="row">{d.matchday}</th>
                <td>{d.position}</td>
                <td>{d.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-fg-dim">
        <span>
          Journée <span className="num text-fg">{data[0].matchday}</span> →{' '}
          <span className="num text-fg">{lastPoint.matchday}</span>
        </span>
        <span>
          Actuellement{' '}
          <span className="num text-fg-bright font-semibold">
            {lastPoint.position}
            <sup>{lastPoint.position === 1 ? 'er' : 'e'}</sup>
          </span>{' '}
          · {lastPoint.points} pts
        </span>
      </div>
    </>
  );
}
