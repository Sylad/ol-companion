import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Trophy } from 'lucide-react';
import { FcNoobzEtatChargement } from '@/components/fcnoobz-etat-chargement';
import { useFcNoobzCarrieres } from '@/hooks/use-fcnoobz-carrieres';
import {
  clubSummary,
  editionName,
  placeText,
  provenanceText,
  sortCarrieres,
  type CarriereClub,
  type CarriereEdition,
} from '@/lib/fcnoobz-carrieres';

// L121 — « Mes carrières » : clubs dirigés dans chaque édition de Football Manager (fiche fcnoobz-carrieres).

const BLUE = '#3aa0ff';
const GREEN = '#84cc16';

export function FcNoobzCarrieresPage() {
  useEffect(() => {
    document.body.classList.add('theme-fcnoobz');
    return () => document.body.classList.remove('theme-fcnoobz');
  }, []);

  const { data, isPending, isError, isFetching, fetchStatus, refetch } = useFcNoobzCarrieres();
  // Même lecture que la page Jeux vidéo : hors ligne (requête en pause) le chargement reste affiché.
  const paused = fetchStatus === 'paused';
  const loading = isPending || (isError && (isFetching || paused));
  const failed = isError && !isFetching && !paused;
  const editions = data && !isError ? sortCarrieres(data) : [];
  const empty = !!data && !isError && editions.length === 0;

  return (
    <div
      className="-mx-5 -my-6 min-h-[calc(100dvh-2rem)] space-y-8 px-5 py-6 lg:-mx-8 lg:-my-10 lg:px-8 lg:py-10"
      style={{
        background:
          'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(29, 78, 216, 0.18) 0%, transparent 65%), linear-gradient(180deg, #03040a 0%, #060814 60%, #03040a 100%)',
      }}
    >
      <PageHeader />

      {(loading || failed) && (
        <FcNoobzEtatChargement
          loading={loading}
          messageChargement="Chargement des carrières…"
          messageErreur="Impossible de charger les carrières."
          onRetry={() => void refetch()}
        />
      )}

      {empty && (
        <div className="py-8 text-center text-sm text-fg-muted">
          <p data-testid="message-vide">Aucune carrière importée pour le moment.</p>
          <p data-testid="message-vide-suite" className="mx-auto mt-2 max-w-[60ch]">
            Elles apparaîtront ici après le prochain import : relevé en local depuis les sauvegardes de Football Manager
            (ou saisi à la main), puis publié avec le site.
          </p>
        </div>
      )}

      {editions.length > 0 && data && (
        <>
          {editions.map((e) => (
            <EditionBlock key={e.edition} edition={e} />
          ))}
          <p data-testid="provenance" className="text-xs text-fg-dim">
            {provenanceText(data.releveLe, editions)}
          </p>
        </>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <Link
        to="/fcnoobz"
        data-testid="lien-retour"
        className="mb-4 inline-flex min-h-[44px] items-center text-dense underline"
        style={{ color: GREEN }}
      >
        ← FC Noobz
      </Link>
      <header className="border-b pb-6" style={{ borderColor: 'rgba(132, 204, 22, 0.4)' }}>
        <div data-testid="surtitre-page" className="eyebrow" style={{ color: GREEN }}>
          FC Noobz
        </div>
        <h1 data-testid="titre-page" className="mt-1.5 font-display text-2xl font-extrabold leading-tight lg:text-4xl" style={{ color: BLUE }}>
          Mes carrières
        </h1>
        <p data-testid="sous-titre-page" className="mt-2 max-w-[60ch] text-sm text-fg-muted">
          Football Manager, édition par édition : clubs, saisons, divisions et titres
        </p>
        <p data-testid="avertissement-jeu" className="mt-2 max-w-[60ch] text-dense text-fg-muted">
          Parties de Football Manager : des résultats de jeu vidéo, pas de vrais matchs.
        </p>
      </header>
    </div>
  );
}

function EditionBlock({ edition }: { edition: CarriereEdition }) {
  const titreId = `edition-${edition.edition}`;
  return (
    <section data-testid="edition" aria-labelledby={titreId}>
      <h2 id={titreId} data-testid="edition-nom" className="mb-4 font-display text-xl font-bold lg:text-2xl" style={{ color: BLUE }}>
        {editionName(edition.edition)}
      </h2>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {edition.clubs.map((c) => (
          <ClubCard key={c.club} club={c} />
        ))}
      </div>
    </section>
  );
}

function ClubCard({ club }: { club: CarriereClub }) {
  return (
    <article
      data-testid="club"
      className="min-w-0 rounded-md p-5"
      style={{ background: 'linear-gradient(180deg, rgba(5, 7, 20, 0.85), rgba(3, 4, 10, 0.9))', border: '1px solid rgba(132, 204, 22, 0.4)' }}
    >
      <h3 data-testid="club-nom" className="break-words font-display text-lg font-bold text-fg-bright">
        {club.club}
      </h3>
      <p data-testid="club-resume" className="mb-3 mt-0.5 text-dense" style={{ color: GREEN }}>
        {clubSummary(club)}
      </p>
      <ul>
        {club.saisons.map((s) => (
          <li key={s.saison} data-testid="saison-ligne" className="carriere-saison border-t border-border py-2.5 first:border-t-0 first:pt-0">
            {/* Revue UX m4 : dans une carte étroite, la division a sa propre ligne sous saison et place (index.css). */}
            <div className="carriere-saison-ligne text-sm">
              <span className="carriere-saison-tete">
                <span data-testid="saison-annee" className="num whitespace-nowrap font-semibold text-fg-bright">
                  {s.saison}
                </span>
                {s.enCours && (
                  <span
                    data-testid="saison-en-cours"
                    className="rounded-sm px-1.5 text-petite font-bold uppercase tracking-wider"
                    style={{ color: GREEN, border: `1px solid ${GREEN}` }}
                  >
                    En cours
                  </span>
                )}
              </span>
              <span data-testid="saison-division" className="carriere-division break-words text-fg-muted">
                {s.division}
              </span>
              <span data-testid="saison-place" className="carriere-place num font-semibold text-fg-bright">
                {placeText(s)}
              </span>
            </div>
            {s.titres && s.titres.length > 0 && (
              <ul data-testid="saison-titres" className="mt-1.5 space-y-1">
                {s.titres.map((t) => (
                  <li key={t} className="flex items-start gap-1.5 text-dense text-fg-bright">
                    <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GREEN }} aria-hidden="true" />
                    <span>
                      <span className="sr-only">Titre : </span>
                      {t}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}
