import { useId, useRef, useState } from 'react';
import { seasonTeamLogoUrl } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { formatKickoffLong } from '@/lib/kickoff';
import type { NextOpponent, NextOpponents } from '@/types/next-opponents';
import { TeamLogo } from './team-logo';

/**
 * L273 — colonne « Prochain » du classement : le prochain adversaire en Ligue 1 de chaque club
 * (football-data.org). Domicile / extérieur se lit en lettres (« Dom. » / « Ext. »), jamais par la
 * couleur seule (WCAG 1.4.1) ; l'écusson est nommé (texte alternatif) et une bulle, au toucher, au clavier et au survol, redit le match.
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

/** Noms du classement trop longs pour la case, et leur forme courte (revue UX de L273, M1 : nom écrit dès 1024 px). */
const NOMS_COURTS: Record<string, string> = {
  'Olympique de Marseille': 'Marseille',
  'Olympique Lyonnais': 'Lyon',
  'Paris Saint-Germain': 'PSG',
  'Stade Rennais': 'Rennes',
  'Stade Brestois': 'Brest',
};

/** Nom court écrit à côté de l'écusson : table ci-dessus, sinon sans sigle de tête (« OGC Nice » → « Nice »). */
export function nomCourt(nom: string): string {
  return NOMS_COURTS[nom] ?? nom.replace(/^(?:[A-Z]{2,5}|Stade|Olympique de) (?=\S)/, '');
}

/** Mot affiché sous l'écusson d'un match qui se joue, à la place de Dom. / Ext. (le lieu reste dans l'infobulle). */
export const LIVE_SHORT = 'Direct';

/** « Monaco, à domicile — J12, dimanche 29 novembre · 20h45 » ; en cours : « Monaco, à domicile — J12, match en cours » */
export function nextOpponentTitle(next: NextOpponent, opponentName: string): string {
  const journee = next.matchday !== null ? `J${next.matchday}, ` : '';
  if (next.live) return `${opponentName}, ${VENUE_LONG[next.venue]} — ${journee}match en cours`;
  const quand = formatKickoffLong({ date: next.utcDate, timeConfirmed: next.timeConfirmed });
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
  return <NextOpponentMatch next={state.next} opponentName={state.opponentName} />;
}

/**
 * Revue UX de L273 (M1) : le détail du match (adversaire, lieu, journée, date) n'était que dans un `title`, hors de
 * portée du doigt et du clavier. La case est un bouton : la bulle s'ouvre au toucher, au focus clavier et au survol,
 * se ferme à Échap (le focus reste sur le bouton, WCAG 1.4.13), à la perte du focus ou en quittant la case à la souris.
 * Elle décrit le bouton (`aria-describedby`) même fermée. Dès 1024 px, le nom de l'adversaire est écrit à côté de
 * l'écusson.
 */
function NextOpponentMatch({ next, opponentName }: { next: NextOpponent; opponentName: string }) {
  const [open, setOpen] = useState(false);
  const bulleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const detail = nextOpponentTitle(next, opponentName);
  return (
    <span
      className="relative flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (document.activeElement !== buttonRef.current) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        data-testid="prochain-adversaire"
        aria-describedby={bulleId}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className={cn(
          // Sous 360 px, écusson et lieu l'un sous l'autre : la colonne n'a que 38 px utiles à 320 px. Dès 360 px, sur
          // une ligne (56 px utiles ; écusson 20 + 6 + « Dom. » ≈ 53) : la ligne garde la hauteur de la vue Bilan (m2).
          // « Direct » (≈ 36 px) reste dessous jusqu'à 768 px.
          // Cible de 24 px, dont 2 px de chaque côté pris sur la marge de la case (-my-0.5) : la ligne ne grandit pas.
          '-my-0.5 inline-flex min-h-6 min-w-6 cursor-pointer flex-col items-center gap-0.5 rounded-sm text-left md:flex-row md:gap-1.5',
          !next.live && 'min-[360px]:flex-row min-[360px]:gap-1.5',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ol-red-bright',
        )}
      >
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
        {/* Dès 1024 px, nom court de l'adversaire à côté de l'écusson (déjà lu par le texte alternatif de l'écusson) ;
            de 1024 à 1279 px, au-dessus du lieu (sur une ligne, le tableau débordait de 20 px à 1024), sur une ligne au-delà.
            Sous 1024 px, `contents` : le lieu reste un enfant direct du bouton. */}
        <span className="contents lg:flex lg:flex-col lg:items-start lg:gap-0.5 xl:flex-row xl:items-center xl:gap-1.5">
          <span aria-hidden="true" data-testid="prochain-nom" className="hidden max-w-[6.5rem] truncate text-xs leading-none text-fg lg:inline">
            {nomCourt(opponentName)}
          </span>
          {next.live ? (
            // Match en cours : « Direct » (texte rouge du direct, comme les autres indicateurs LIVE), jamais « Dom. » seul,
            // qui le ferait lire comme un match à venir.
            <span className="text-petite leading-none font-semibold text-live" data-testid="prochain-direct">
              <span aria-hidden="true">{LIVE_SHORT}</span>
              <span className="sr-only">{VENUE_LONG[next.venue]}, match en cours</span>
            </span>
          ) : (
            <span className="text-petite leading-none text-fg-muted">
              <span aria-hidden="true">{VENUE_SHORT[next.venue]}</span>
              <span className="sr-only">{VENUE_LONG[next.venue]}</span>
            </span>
          )}
        </span>
      </button>
      <span
        id={bulleId}
        role="tooltip"
        data-testid="prochain-bulle"
        hidden={!open}
        className="absolute right-0 top-full z-20 mt-1 w-max max-w-[15rem] rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-xs text-fg shadow-lg"
      >
        {detail}
      </span>
    </span>
  );
}
