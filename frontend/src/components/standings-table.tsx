import { seasonTeamLogoUrl } from '@/lib/calendar';
import { TeamLogo } from './team-logo';
import { OL_TEAM_ID, type StandingEntry, type FormOutcome } from '@/types/api';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { NextOpponents } from '@/types/next-opponents';
import { NextOpponentCell, nextOpponentState } from './next-opponent-cell';
import { NextOpponentsNote } from './next-opponents-note';

/**
 * L273 — sous 768 px, le tableau n'a pas la place d'une colonne de plus (4 px de marge à 320 px) :
 * la colonne « Prochain » y remplace G, N, P au choix (`vueTelephone`). À partir de 768 px, tout est affiché.
 */
export type VueTelephone = 'bilan' | 'prochain';

interface StandingsTableProps {
  rows: StandingEntry[];
  /** Réponse de `/api/next-opponents` ; absente : la colonne n'est pas affichée (tests anciens, usage hors page). */
  nextOpponents?: { data?: NextOpponents; isError: boolean };
  vueTelephone?: VueTelephone;
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
  { key: 'next', label: 'Prochain', align: 'left' as const, w: 'w-16 md:w-[4.5rem] lg:w-[6.25rem] xl:w-36' },
];

/** Libellés de l'en-tête « Prochain », repris par la légende (invariant 1 : la légende suit le rendu). */
// Revue UX de L273 (m4) : « Proch. » au téléphone, le même mot que la bascule « Prochain » (« Adv. » en était un autre).
export const NEXT_LABEL = { phone: 'Proch.', desktop: 'Prochain' } as const;

/** Colonnes qui cèdent la place à « Prochain » au téléphone, vue « Prochain ». */
const BILAN_KEYS = new Set(['won', 'draw', 'lost']);

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
        'inline-flex items-center justify-center w-5 h-5 rounded-full text-petite font-bold leading-none',
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

/** Classes de visibilité d'une colonne selon la vue du téléphone (`hidden` sous 768 px, `table-cell` au-delà). */
function columnVisibility(key: string, vue: VueTelephone, withNext: boolean, mobile?: boolean): string | false {
  if (mobile === false) return 'hidden md:table-cell';
  if (key === 'next') return vue === 'prochain' ? false : 'hidden md:table-cell';
  if (withNext && BILAN_KEYS.has(key) && vue === 'prochain') return 'hidden md:table-cell';
  return false;
}

type Visibility = (key: string, mobile?: boolean) => string | false;

export function StandingsTable({ rows, nextOpponents, vueTelephone = 'bilan' }: StandingsTableProps) {
  const withNext = !!nextOpponents;
  const names = new Map(rows.map((r) => [r.teamId, r.team]));
  const visibility: Visibility = (key, mobile) => columnVisibility(key, vueTelephone, withNext, mobile);
  const columns = withNext ? COLUMNS : COLUMNS.filter((c) => c.key !== 'next');
  return (
    <div className="-mx-1">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="text-fg-dim">
            {columns.map((col) => (
              <th
                key={col.key}
                title={col.key === 'next' ? 'Prochain adversaire en Ligue 1' : undefined}
                className={cn(
                  'sticky top-[calc(var(--bandeau-demo-h,0px)+var(--ligne-direct-h,0px))] z-10 bg-surface px-1 md:px-2 py-2 md:py-3 font-semibold uppercase tracking-wider text-petite',
                  col.w,
                  col.align === 'center' ? 'text-center' : 'text-left',
                  visibility(col.key, col.mobile),
                  'border-b border-border',
                  // « PROCH. » (55 px en capitales espacées) laissait le tableau 7 px trop large à 320 px : espacement
                  // normal et marge réduite au téléphone pour cet en-tête seul.
                  col.key === 'next' && 'max-md:px-0.5 max-md:tracking-normal md:px-1 xl:px-2',
                )}
              >
                {col.key === 'next' ? <NextHeader /> : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const prev = i > 0 ? zoneOf(rows[i - 1].position) : undefined;
            const rule = i > 0 && zoneOf(row.position) !== prev ? 'border-t border-border' : '';
            // Contre-revue UX de L273 (m3) : de 768 à 1279 px le tableau est à sa largeur minimale et la colonne
            // « Prochain » se règle sur son contenu (en-tête, puis nom court) : marge de 4 px au lieu de 8, rendus au nom
            // du club (« Strasbourg » était coupé de 5 px dans Chromium).
            return (
              <StandingsRow key={row.teamId} row={row} rule={rule} visibility={visibility}>
                {nextOpponents && (
                  <td className={cn('px-1 xl:px-2 py-3', rule, visibility('next'))}>
                    <NextOpponentCell state={nextOpponentState(row.teamId, nextOpponents, names)} />
                  </td>
                )}
              </StandingsRow>
            );
          })}
        </tbody>
      </table>

      <Legend />
      {nextOpponents && <NextOpponentsNote query={nextOpponents} vueTelephone={vueTelephone} />}
    </div>
  );
}

function PositionCell({ row, rule, isOL }: { row: StandingEntry; rule: string; isOL: boolean }) {
  return (
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
  );
}

function ClubCell({ row, rule, isOL }: { row: StandingEntry; rule: string; isOL: boolean }) {
  return (
    <td className={cn("px-1.5 md:px-2 py-3 max-w-0 min-w-[7rem] md:min-w-[8rem]", rule)}>
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
  );
}

function goalDifferenceClass(gd: number): string {
  if (gd > 0) return 'text-win';
  return gd < 0 ? 'text-loss-fg' : 'text-fg-muted';
}

interface StandingsRowProps {
  row: StandingEntry;
  rule: string;
  visibility: Visibility;
  /** Cellules ajoutées en fin de ligne (colonne « Prochain », L273). */
  children?: ReactNode;
}

function StandingsRow({ row, rule, visibility, children }: StandingsRowProps) {
  const isOL = row.teamId === OL_TEAM_ID;
  const num = 'px-1 md:px-2 py-3 text-center num text-fg-muted';
  const numDesktop = 'hidden md:table-cell px-2 py-3 text-center num text-fg-muted';
  return (
    <tr
      id={isOL ? 'ligne-ol' : undefined}
      tabIndex={isOL ? -1 : undefined}
      className={cn(
        isOL && 'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ol-red',
        'group transition-colors',
        isOL ? 'bg-ol-red/5 hover:bg-ol-red/10' : 'hover:bg-surface-2/50',
      )}
    >
      <PositionCell row={row} rule={rule} isOL={isOL} />
      <ClubCell row={row} rule={rule} isOL={isOL} />
      <td className={cn(numDesktop, rule)}>{row.played}</td>
      <td className={cn(num, rule, visibility('won'))}>{row.won}</td>
      <td className={cn(num, rule, visibility('draw'))}>{row.draw}</td>
      <td className={cn(num, rule, visibility('lost'))}>{row.lost}</td>
      <td className={cn(numDesktop, rule)}>{row.goalsFor}</td>
      <td className={cn(numDesktop, rule)}>{row.goalsAgainst}</td>
      <td className={cn(rule, 'px-1 md:px-2 py-3 text-center num', goalDifferenceClass(row.goalDifference))}>
        {row.goalDifference > 0 ? '+' : ''}
        {row.goalDifference}
      </td>
      <td className={cn(rule, 'px-1 md:px-2 py-3 text-center num font-bold', isOL ? 'text-fg-bright' : 'text-fg')}>
        {row.points}
      </td>
      <td className={cn("hidden md:table-cell px-2 py-3", rule)}>
        <FormStrip form={row.recentForm} />
      </td>
      {children}
    </tr>
  );
}

/**
 * En-tête de la colonne : « Proch. » sous 768 px (« PROCHAIN » en capitales prenait 84 px à 320 px, le tableau
 * débordait de 31 px), « Prochain » au-delà ; nom accessible entier dans les deux cas.
 */
export function NextHeader() {
  return (
    <>
      <span aria-hidden="true" className="md:hidden">{NEXT_LABEL.phone}</span>
      <span aria-hidden="true" className="hidden md:inline">{NEXT_LABEL.desktop}</span>
      <span className="sr-only">Prochain adversaire en Ligue 1</span>
    </>
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
