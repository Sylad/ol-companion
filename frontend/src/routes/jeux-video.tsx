import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useJeuxVideo } from '@/hooks/use-jeux-video';
import { formatSortie, formatVerifie, siteName, type JeuxVideoData } from '@/lib/jeux-video';

const BLUE = '#3aa0ff';
const GREEN = '#84cc16';

export function JeuxVideoPage() {
  useEffect(() => {
    document.body.classList.add('theme-fcnoobz');
    return () => document.body.classList.remove('theme-fcnoobz');
  }, []);

  const { data, isPending, isError, isFetching, fetchStatus, refetch } = useJeuxVideo();
  // Même lecture que la page Équipe de France : hors ligne (requête en pause) le chargement reste affiché.
  const paused = fetchStatus === 'paused';
  const loading = isPending || (isError && (isFetching || paused));
  const failed = isError && !isFetching && !paused;
  const empty = !!data && !isError && !data.prochaineSortie && data.editions.length === 0 && data.nouveautes.length === 0;
  const full = !!data && !isError && !empty;

  return (
    <div
      className="-mx-5 -my-6 min-h-[calc(100vh-2rem)] space-y-8 px-5 py-6 lg:-mx-8 lg:-my-10 lg:px-8 lg:py-10"
      style={{
        background:
          'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(29, 78, 216, 0.18) 0%, transparent 65%), linear-gradient(180deg, #03040a 0%, #060814 60%, #03040a 100%)',
      }}
    >
      <div>
        <Link
          to="/fcnoobz"
          data-testid="lien-retour"
          className="mb-4 inline-flex min-h-[44px] items-center text-[13px] underline"
          style={{ color: GREEN }}
        >
          ← FC Noobz
        </Link>
        <header className="border-b pb-6" style={{ borderColor: 'rgba(132, 204, 22, 0.4)' }}>
          <div data-testid="surtitre-page" className="eyebrow" style={{ color: GREEN }}>
            FC Noobz
          </div>
          <h1 data-testid="titre-page" className="mt-1.5 font-display text-2xl font-extrabold leading-tight lg:text-4xl" style={{ color: BLUE }}>
            Jeux vidéo
          </h1>
          <p data-testid="sous-titre-page" className="mt-2 max-w-[60ch] text-sm text-fg-muted">
            Football Manager : la série et ses prochaines sorties
          </p>
        </header>
      </div>

      {(loading || failed) && (
        <section aria-busy={loading}>
          {loading ? (
            <div role="status" className="flex flex-col items-center gap-4 py-20 text-center text-fg-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <p data-testid="message-chargement" className="text-sm">
                Chargement de Football Manager…
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <p data-testid="message-erreur" role="alert" className="text-sm text-ol-red-bright">
                Impossible de charger les infos Football Manager.
              </p>
              <button
                type="button"
                data-testid="bouton-reessayer"
                onClick={() => void refetch()}
                className="min-h-[44px] rounded-md border px-5 text-sm font-semibold text-fg-bright"
                style={{ borderColor: GREEN, background: 'rgba(132, 204, 22, 0.1)' }}
              >
                Réessayer
              </button>
            </div>
          )}
        </section>
      )}

      {empty && (
        <>
          <p data-testid="message-vide" className="py-8 text-center text-sm text-fg-muted">
            Aucune info Football Manager pour le moment.
          </p>
          <div className="max-w-[720px]">
            <SeriePanel />
          </div>
        </>
      )}

      {full && <Contenu data={data} />}
    </div>
  );
}

function Contenu({ data }: { data: JeuxVideoData }) {
  const { prochaineSortie: sortie } = data;
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <div className="grid gap-6">
          <Panel testId="prochaine-sortie" eyebrow={['surtitre-prochaine-sortie', 'À venir']} title={['titre-prochaine-sortie', 'Prochaine sortie']}>
            {sortie ? (
              <>
              <p data-testid="sortie-nom" className="mb-2 font-semibold text-fg-bright">
                {sortie.nom}
              </p>
              <p
                data-testid="sortie-date"
                className={sortie.date ? 'num text-[22px] font-bold text-fg-bright' : 'num text-lg font-bold text-fg-muted'}
              >
                {formatSortie(sortie.date)}
              </p>
              {sortie.plateformes && (
                <p data-testid="sortie-plateformes" className="mt-2.5 text-[13px] text-fg-muted">
                  {sortie.plateformes}
                </p>
              )}
              </>
            ) : (
              <VideMessage testId="prochaine-sortie-vide">Aucune sortie annoncée pour le moment.</VideMessage>
            )}
          </Panel>
          <Panel testId="editions" eyebrow={['surtitre-editions', 'Déjà sorties']} title={['titre-editions', 'Éditions précédentes']}>
            {data.editions.length === 0 ? (
              <VideMessage testId="editions-vide">Aucune édition précédente.</VideMessage>
            ) : (
            <ul>
              {data.editions.map((e) => (
                <li key={e.nom} data-testid="edition-ligne" className="flex justify-between gap-3 border-t border-border py-2.5 text-sm first:border-t-0 first:pt-0">
                  <span data-testid="edition-nom" className="text-fg-bright">
                    {e.nom}
                  </span>
                  <span data-testid="edition-date" className="num whitespace-nowrap text-right text-fg-muted">
                    {formatSortie(e.date)}
                  </span>
                </li>
              ))}
            </ul>
            )}
          </Panel>
        </div>
        <div className="grid gap-6">
          <Panel testId="nouveautes-annoncees" eyebrow={['surtitre-nouveautes', 'Annoncé']} title={['titre-nouveautes', 'Nouveautés annoncées']}>
            {data.nouveautes.length === 0 ? (
              <VideMessage testId="nouveautes-vide">Aucune nouveauté annoncée pour le moment.</VideMessage>
            ) : (
            <ul>
              {data.nouveautes.map((n) => (
                <li key={n.titre} data-testid="nouveaute-ligne" className="border-t border-border py-3 first:border-t-0 first:pt-0">
                  <div data-testid="nouveaute-titre" className="text-sm font-semibold text-fg-bright">
                    {n.titre}
                  </div>
                  <div data-testid="nouveaute-description" className="mt-0.5 text-[13px] leading-snug text-fg-muted">
                    {n.description}
                  </div>
                </li>
              ))}
            </ul>
            )}
          </Panel>
          <SeriePanel />
        </div>
      </div>
      <p data-testid="source-verification" className="text-xs text-fg-dim">
        Infos vérifiées le {formatVerifie(data.verifieLe)}
        {data.sources.length > 0 && (
          <>
            {' '}
            sur{' '}
            {premiereAdresseParSite(data.sources).map((s, i) => (
              <span key={s}>
                {i > 0 && ', '}
                <a href={s} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: GREEN }}>
                  {siteName(s)}
                </a>
              </span>
            ))}
          </>
        )}
        . Les dates peuvent changer.
      </p>
    </>
  );
}

function premiereAdresseParSite(sources: string[]): string[] {
  const parSite = new Map<string, string>();
  for (const u of sources) if (!parSite.has(siteName(u))) parSite.set(siteName(u), u);
  return [...parSite.values()];
}

function VideMessage({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <p data-testid={testId} className="text-sm text-fg-muted">
      {children}
    </p>
  );
}

function SeriePanel() {
  return (
    <Panel testId="serie" eyebrow={['surtitre-serie', 'La série']} title={['titre-serie', 'Football Manager']}>
      <p data-testid="serie-presentation" className="text-sm leading-relaxed text-fg-muted">
        Série de simulation de gestion de football : on dirige un club, de la composition d’équipe au mercato, saison après saison.
        C’est le jeu dans lequel est né le FC Noobz.
      </p>
    </Panel>
  );
}

function Panel({ testId, eyebrow, title, children }: { testId: string; eyebrow: [string, string]; title: [string, string]; children: React.ReactNode }) {
  return (
    <section
      data-testid={testId}
      className="rounded-md p-5"
      style={{ background: 'linear-gradient(180deg, rgba(5, 7, 20, 0.85), rgba(3, 4, 10, 0.9))', border: '1px solid rgba(132, 204, 22, 0.4)' }}
    >
      <div data-testid={eyebrow[0]} className="eyebrow" style={{ color: GREEN }}>
        {eyebrow[1]}
      </div>
      <h2 data-testid={title[0]} className="mb-3 mt-1.5 font-display text-xl font-bold" style={{ color: BLUE }}>
        {title[1]}
      </h2>
      {children}
    </section>
  );
}
