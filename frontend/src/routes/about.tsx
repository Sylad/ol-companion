import { ExternalLink, Sparkles, Code2, Palette, Server, Heart } from 'lucide-react';

const STACK = [
  {
    group: 'Frontend',
    icon: Palette,
    items: [
      'React 18 + TypeScript 5.6',
      'Vite 5 (dev server + build)',
      'Tailwind CSS 3 + tokens HSL custom',
      'TanStack Router (code-based)',
      'TanStack Query (cache & mutations)',
      'Recharts (graphes classement / saison)',
      'Lucide (icônes minimalistes)',
    ],
  },
  {
    group: 'Backend',
    icon: Server,
    items: [
      'NestJS 11 + TypeScript 5',
      'Stockage JSON local (cache fixtures)',
      'Proxy 365scores (classement live + forme)',
      'Proxy football-data.org (calendrier officiel)',
      'Proxy Wikipedia FR (logos / images)',
      'Server-Sent Events (live updates)',
    ],
  },
  {
    group: 'Infra',
    icon: Code2,
    items: [
      'Docker multi-stage (node:20-alpine → nginx:alpine)',
      'docker-compose Synology NAS',
      'Volumes persistants /volume2/docker',
      'nginx proxy /api → backend NestJS',
      'env_file .env (FOOTBALL_API_KEY + ANTHROPIC_API_KEY)',
      'Hostname réseau : nas:4202',
    ],
  },
];

const INSPIRATIONS = [
  {
    name: 'refactoringui.com',
    by: 'Adam Wathan & Steve Schoger',
    why: 'Le bouquin de chevet pour les non-designers : grille, contraste, hiérarchie, espacement.',
    url: 'https://refactoringui.com/',
  },
  {
    name: 'lawsofux.com',
    by: 'Jon Yablonski',
    why: 'Les principes UX cités à chaque revue : Hick, Fitts, Miller, Postel, Von Restorff.',
    url: 'https://lawsofux.com/',
  },
  {
    name: '365scores',
    by: '365scores Ltd.',
    why: 'Source de données officielle utilisée — classement, forme, départage LFP. Le départage par règles LFP était la raison du switch depuis football-data.org.',
    url: 'https://www.365scores.com/fr/football/league/ligue-1-35',
  },
  {
    name: 'Sofascore',
    by: 'Sofascore',
    why: 'Référence UI pour les stats sportives — dense, lisible, cards homogènes. Pas pillé : étudié.',
    url: 'https://www.sofascore.com/fr/football/team/olympique-lyonnais/1649',
  },
  {
    name: 'OL.fr — site officiel',
    by: 'Olympique Lyonnais',
    why: 'Source visuelle pour la palette identitaire (rouge OL + bleu OL) et pour les actualités. Image de marque respectée.',
    url: 'https://www.ol.fr/fr',
  },
  {
    name: 'shadcn/ui',
    by: 'shadcn',
    why: 'Pattern composants Radix + Tailwind à copier-coller, philosophie minimaliste. Inspiration des cards et de la sidebar.',
    url: 'https://ui.shadcn.com',
  },
];

export function AboutPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1.5 mb-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-fg-dim font-semibold">
          À propos · OL Companion
        </p>
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-fg-bright">
          Vibe coded with Claude Code
        </h1>
        <p className="text-fg-muted max-w-2xl">
          Une appli perso pour suivre l'OL — calendrier, classement, joueurs, actu —
          construite en discutant avec un agent IA.
        </p>
      </header>

      <section className="relative overflow-hidden rounded-md border border-border bg-surface p-6">
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-ol-red/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-12 w-64 h-64 rounded-full bg-ol-blue/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start gap-5">
          <div className="shrink-0">
            <img
              src="/icon.png"
              alt="OL Companion"
              className="w-16 h-16 rounded-md shadow-[0_0_20px_rgba(220,38,38,0.3)]"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold text-fg-bright mb-3">
              L'histoire courte
            </h2>
            <p className="text-fg leading-relaxed mb-3">
              Développeur Java côté serveur depuis 21 ans, mais novice sur React et le front
              moderne. J'avais envie d'un compagnon numérique pour suivre l'OL — pas un site
              Web encombré de pubs, ni une app générique. Quelque chose de fait main, aux
              couleurs <span className="text-ol-red-bright font-semibold">rouge</span> et <span className="text-ol-blue-bright font-semibold">bleu</span> du club.
            </p>
            <p className="text-fg leading-relaxed mb-3">
              Toute l'appli (frontend React, backend NestJS, infra Docker) a été co-construite avec
              {' '}
              <a
                href="https://claude.com/claude-code"
                target="_blank"
                rel="noopener"
                className="text-ol-red-bright hover:underline inline-flex items-center gap-1 font-medium"
              >
                Claude Code
                <ExternalLink className="h-3 w-3" />
              </a>
              . Mon rôle : tracer la vision, valider les choix, repérer ce qui cloche.
              Le rôle de Claude : poser le code, expliquer, itérer.
            </p>
            <p className="text-fg leading-relaxed">
              En amont du code,
              {' '}
              <a
                href="https://chat.openai.com/"
                target="_blank"
                rel="noopener"
                className="text-ol-blue-bright hover:underline inline-flex items-center gap-1 font-medium"
              >
                ChatGPT
                <ExternalLink className="h-3 w-3" />
              </a>
              {' '}a été mon premier complice : génération du logo OL Companion, maquettes UX
              et propositions de design qui ont guidé la construction. Une vraie collab à trois —
              humain + ChatGPT (visuels) + Claude Code (implémentation), pour explorer le front
              moderne en sortant de ma zone Java.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-fg-dim">
              <Sparkles className="h-3 w-3 text-ol-red-bright" />
              <span>Données live via 365scores · Logos via Wikipedia FR · Hébergé sur NAS Synology.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {STACK.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.group}
              className="rounded-md border border-border bg-surface p-5 hover:border-border-strong transition-colors"
            >
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <Icon className="h-4 w-4 text-ol-red-bright" strokeWidth={1.75} />
                <h3 className="font-display font-semibold text-fg-bright tracking-wide text-sm uppercase">
                  {s.group}
                </h3>
              </div>
              <ul className="space-y-2 text-sm text-fg-muted">
                {s.items.map((it) => (
                  <li key={it} className="flex items-start gap-2">
                    <span className="text-ol-red-bright/60 select-none mt-0.5">›</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="rounded-md border border-border bg-surface p-5">
        <h3 className="font-display text-lg font-semibold text-fg-bright mb-1">
          Inspirations &amp; sources
        </h3>
        <p className="text-sm text-fg-muted mb-5">
          Pas une copie, mais des principes que j'ai essayé d'appliquer.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {INSPIRATIONS.map((i) => (
            <a
              key={i.name}
              href={i.url}
              target="_blank"
              rel="noopener"
              className="group rounded-md border border-border bg-surface-2/40 p-4 flex flex-col gap-1.5 hover:border-border-strong hover:bg-surface-2 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold text-fg-bright group-hover:text-ol-red-bright transition-colors">
                  {i.name}
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-fg-dim group-hover:text-ol-red-bright transition-colors" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-fg-dim">
                par {i.by}
              </span>
              <p className="text-xs text-fg-muted leading-relaxed mt-1">{i.why}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-6 text-center">
        <Heart className="h-5 w-5 text-ol-red-bright mx-auto mb-3" strokeWidth={1.75} />
        <p className="text-fg-muted text-sm leading-relaxed max-w-2xl mx-auto">
          Si tu veux faire pareil : prends un sujet qui t'enflamme, ouvre Claude Code,
          décris en langage naturel ce que tu rêves de voir exister, et itère.
          Tu seras surpris de ce qu'on peut construire en quelques sessions.
        </p>
        <div className="text-[10px] uppercase tracking-[0.2em] text-fg-dim mt-4">
          Allez l'OL · Made with curiosity · v2.0
        </div>
      </section>
    </div>
  );
}
