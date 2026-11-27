import { seasonTeamLogoUrl } from '@/lib/calendar';
import { formatKickoffLong } from '@/lib/kickoff';
import type { NextOpponent, NextOpponents } from '@/types/api';
import { TeamLogo } from './team-logo';

/**
 * L273 — colonne « Prochain » du classement : le prochain adversaire en Ligue 1 de chaque club
 * (football-data.org). Domicile / extérieur se lit en lettres (« Dom. » / « Ext. »), jamais par la
 * couleur seule (WCAG 1.4.1) ; l'écusson est nommé (texte alternatif) et l'infobulle redit le match.
 */

/** Libellés courts affichés, et leur forme longue lue par les lecteurs d'écran et la légende. */
export const VENUE_SHORT = { home: 'Dom.', away: 'Ext.' } as const;
export const VENUE_LONG = { home: 'à domicile', away: 'à l’extérieur' } as const;

/** Pourquoi une case est vide : dit en texte, jamais une case muette (invariant 12). */
export type EmptyReason = 'loading' | 'unavailable' | 'season-over' | 'none' | 'unlinked';

export const EMPTY_REASON_TEXT: Record<EmptyReason, string> = {
  loading: 'Prochain adversaire en cours de chargement',
  unavailable: 'Prochain adversaire indisponible (football-data.org n’a pas répondu)',
  'season-over': 'Saison terminée : plus aucun match de Ligue 1 programmé',
  none: 'Aucun match de Ligue 1 programmé pour ce club (match reporté sans nouvelle date)',
  unlinked: 'Club inconnu de football-data.org : prochain adversaire non relié',
};

export type NextOpponentState =
  | { kind: 'match'; next: NextOpponent; opponentName: string }
  | { kind: 'empty'; reason: EmptyReason };

/** Ce que montre la case d'un club, d'après la réponse (ou son absence). `names` : noms du classement, par identifiant. */
export function nextOpponentState(
  teamId: number,
  query: { data?: NextOpponents; isError: boolean },
  names: ReadonlyMap<number, string>,
): NextOpponentState {
  const { data } = query;
  if (!data) return { kind: 'empty', reason: query.isError ? 'unavailable' : 'loading' };
  if (!data.linkedTeamIds.includes(teamId)) return { kind: 'empty', reason: 'unlinked' };
  const next = data.next.find((n) => n.teamId === teamId);
  if (!next) return { kind: 'empty', reason: data.seasonOver ? 'season-over' : 'none' };
  // Le nom affiché est celui du classement (mêmes lettres que la ligne de l'adversaire), sinon celui de football-data.
  const opponentName = (next.opponentId !== null && names.get(next.opponentId)) || next.opponentName;
  return { kind: 'match', next, opponentName };
}

/** « Monaco, à domicile — J12, dimanche 29 novembre · 20h45 » */
export function nextOpponentTitle(next: NextOpponent, opponentName: string): string {
  const quand = formatKickoffLong({ date: next.utcDate, timeConfirmed: next.timeConfirmed });
  const journee = next.matchday !== null ? `J${next.matchday}, ` : '';
  return `${opponentName}, ${VENUE_LONG[next.venue]} — ${journee}${quand}`;
}

export function NextOpponentCell({ state }: { state: NextOpponentState }) {
  if (state.kind === 'empty') {
    return (
      <span className="text-fg-dim text-xs" title={EMPTY_REASON_TEXT[state.reason]} data-testid="prochain-vide" data-raison={state.reason}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{EMPTY_REASON_TEXT[state.reason]}</span>
      </span>
    );
  }
  const { next, opponentName } = state;
  const title = nextOpponentTitle(next, opponentName);
  return (
    // Sous 768 px, écusson et lieu l'un sous l'autre : la colonne tient dans 36 px (le tableau en a 4 de reste à 320 px).
    <span className="inline-flex flex-col items-center gap-0.5 align-middle md:flex-row md:gap-1.5" title={title} data-testid="prochain-adversaire">
      {next.opponentId !== null ? (
        <TeamLogo teamId={next.opponentId} name={opponentName} label={opponentName} size={20} src={seasonTeamLogoUrl(next.opponentId)} />
      ) : (
        // Club absent de la table de correspondance : initiales, sans recherche d'image (aucun appel de plus).
        <span
          role="img"
          aria-label={opponentName}
          className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-2 text-petite font-semibold uppercase text-fg-dim"
        >
          <span aria-hidden="true">{opponentName.slice(0, 2)}</span>
        </span>
      )}
      <span className="text-petite leading-none text-fg-muted">
        <span aria-hidden="true">{VENUE_SHORT[next.venue]}</span>
        <span className="sr-only">{VENUE_LONG[next.venue]}</span>
      </span>
    </span>
  );
}
