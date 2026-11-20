import { useId, useRef, useState } from 'react';
import { CalendarPlus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FootballDataSourceNote } from '@/components/football-data-attribution';

/** Chemin du flux iCalendar servi par le backend (L264). */
export const CALENDAR_PATH = '/api/calendar.ics';

/** Adresses d'abonnement à partir de l'origine du site (https en prod). */
export function calendarUrls(origin: string): { https: string; webcal: string; google: string } {
  const https = `${origin}${CALENDAR_PATH}`;
  const webcal = https.replace(/^https?:/, 'webcal:');
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
  };
}

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ol-red-bright';
const actionClass = cn(
  'inline-flex min-h-[44px] items-center justify-center rounded-md border border-ol-blue-bright bg-ol-blue-bright/10 px-4 text-sm font-semibold text-fg-bright hover:bg-ol-blue-bright/20',
  focusRing,
);

/**
 * L264 — « S'abonner » au calendrier des matchs depuis /fixtures. Le flux ne
 * contient que la Ligue 1 (football-data.org, seule source autorisée à être
 * redistribuée) : le panneau le dit, avec l'attribution.
 */
export function CalendarSubscribe({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<'ok' | 'ko' | null>(null);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = calendarUrls(typeof window === 'undefined' ? 'https://ol.sladoire.dev' : window.location.origin);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(urls.https);
      setCopy('ok');
    } catch {
      inputRef.current?.select();
      setCopy('ko');
    }
  };

  return (
    <div className={className}>
      <button
        ref={toggleRef}
        type="button"
        data-testid="abonnement-calendrier"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn(actionClass, 'gap-2 whitespace-nowrap px-3')}
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        S’abonner
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div
        id={panelId}
        data-testid="panneau-abonnement"
        hidden={!open}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            toggleRef.current?.focus();
          }
        }}
        className="mt-3 basis-full space-y-3 rounded-md border border-border bg-surface-2/40 p-3 text-sm text-fg-muted sm:p-4"
      >
        {/* Contenu monté seulement ouvert : la mention football-data de la page reste unique quand il est fermé. */}
        {open && (
          <>
            <h2 className="font-semibold text-fg-bright">Les matchs de l’OL dans votre agenda</h2>
            <p>
              Abonnez votre agenda aux matchs de <strong className="text-fg-bright">Ligue 1</strong> : il les met à jour
              seul, et un match dont l’horaire n’est pas encore fixé y figure sans heure, sur le week-end (ou le jour) prévu.
            </p>
            <p data-testid="abonnement-perimetre">
              Coupe de France, Ligue Europa et Ligue des champions n’y sont pas : football-data.org, la source de ce
              calendrier, ne les fournit pas.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <a data-testid="abonnement-webcal" href={urls.webcal} className={actionClass}>
                Apple Calendrier, Outlook…
              </a>
              <a
                data-testid="abonnement-google"
                href={urls.google}
                target="_blank"
                rel="noopener noreferrer"
                className={actionClass}
              >
                Google Agenda
              </a>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${panelId}-url`} className="block text-fg-muted">
                Autre agenda : l’adresse à coller
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={inputRef}
                  id={`${panelId}-url`}
                  data-testid="abonnement-adresse"
                  readOnly
                  value={urls.https}
                  onFocus={(e) => e.currentTarget.select()}
                  className={cn(
                    'min-h-[44px] min-w-0 flex-1 rounded-md border border-border bg-surface px-3 font-mono text-petite text-fg-bright',
                    focusRing,
                  )}
                />
                <button type="button" data-testid="abonnement-copier" onClick={() => void copyAddress()} className={actionClass}>
                  Copier l’adresse
                </button>
              </div>
              <p role="status" data-testid="abonnement-copie-statut" className="min-h-[1.25rem] text-petite">
                {copy === 'ok' && 'Adresse copiée.'}
                {copy === 'ko' && 'Copie impossible : l’adresse est sélectionnée, copiez-la à la main.'}
              </p>
            </div>
            <FootballDataSourceNote what="Données du calendrier" />
          </>
        )}
      </div>
    </div>
  );
}
