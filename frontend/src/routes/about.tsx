import { ExternalLink, Sparkles, Code2, Palette, Server, Heart } from 'lucide-react';
import { NotificationsToggle } from '@/components/notifications-toggle';
import { FootballDataSourceNote } from '@/components/football-data-attribution';

const STACK = [
  {
    group: 'Interface (frontend)',
    icon: Palette,
    items: [
      'React 18 + TypeScript 5.6',
      'Vite 8 (dev server + build) · tests Vitest 5',
      'Tailwind CSS 3 + tokens HSL custom',
      'TanStack Router (code-based)',
      'TanStack Query (cache & mutations)',
      'Recharts (graphes classement / saison)',
      'Leaflet 1.9 + react-leaflet (carte Ligue 1)',
      'Lucide (icônes minimalistes)',
    ],
  },
  {
    group: 'Serveur (backend)',
    icon: Server,
    items: [
      'NestJS 11 + TypeScript 5',
      'Stockage JSON local (cache fixtures)',
      'Proxy 365scores (classement live, forme, calendrier de la saison)',
      'Proxy football-data.org (prochain match, heures de coup d’envoi)',
      'Proxy Wikipedia FR (logos / images)',
      'Server-Sent Events (mises à jour en direct)',
    ],
  },
  {
    group: 'Infrastructure',
    icon: Code2,
    items: [
      'Docker multi-stage (frontend node:22-alpine → nginx:alpine, backend node:20-alpine)',
      'Images publiées sur GHCR par la CI GitHub Actions',
      'Kubernetes k3s, déployé par ArgoCD (GitOps, chart Helm)',
      'Volume persistant Kubernetes pour les caches JSON',
      'nginx proxy /api → backend NestJS',
      'Exposé via un tunnel Cloudflare (aucun port ouvert)',
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
    why: 'Source de données officielle utilisée — classement, forme, départage LFP. Le départage par règles LFP était la raison du passage depuis football-data.org.',
    url: 'https://www.365scores.com/fr/football/league/ligue-1-35',
  },
  {
    name: 'Sofascore',
    by: 'Sofascore',
    why: 'Référence d’interface pour les stats sportives — dense, lisible, cartes homogènes. Pas pillé : étudié.',
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
    why: 'Composants Radix + Tailwind à copier-coller, philosophie minimaliste. Inspiration des cartes et de la barre latérale.',
    url: 'https://ui.shadcn.com',
  },
];

export function AboutPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1.5 mb-2">
        <p className="text-petite uppercase tracking-[0.22em] text-fg-muted font-semibold">
          À propos · OL Companion
        </p>
        <h1 lang="en" className="font-display text-3xl lg:text-4xl font-bold text-fg-bright">
          Vibe coded with Claude Code
        </h1>
        <p className="text-fg-muted max-w-2xl">
          Une appli perso pour suivre l'OL — calendrier, classement, joueurs, actu —
          construite en discutant avec un agent IA.
        </p>
      </header>

      <section className="rounded-md border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-semibold text-fg-bright mb-1">Notifications de match</h2>
        <p className="text-sm text-fg-muted mb-4">
          Reçois une notification système (Android, ordinateur, ou appli installée) quand Lyon marque,
          prend un rouge, démarre ou termine un match. À activer toi-même, désactivable à tout moment.
        </p>
        <NotificationsToggle />
        <p className="text-petite text-fg-dim mt-3 leading-snug">
          Aucun serveur push externe — c'est ton onglet OL Companion (ou la PWA installée) qui
          déclenche la notif locale via le service worker, à partir du flux SSE en temps réel.
        </p>
      </section>

      <section className="relative overflow-hidden rounded-md border border-border bg-surface p-6">
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-ol-red/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-12 w-64 h-64 rounded-full bg-ol-blue/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start gap-5">
          <div className="shrink-0">
            <img
              src="/icon.png"
              alt=""
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
              couleurs <span className="text-ol-red-bright font-semibold">rouge</span> et <span className="text-ol-blue-fg font-semibold">bleu</span> du club.
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
                className="text-ol-blue-fg hover:underline inline-flex items-center gap-1 font-medium"
              >
                ChatGPT
                <ExternalLink className="h-3 w-3" />
              </a>
              {' '}a été mon premier complice : génération du logo OL Companion, maquettes UX
              et propositions de design qui ont guidé la construction. Une collab humaine et IA :
              ChatGPT pour les pistes visuelles, Claude Code pour l'implémentation, puis Codex
              pour quelques passes de refonte et de revue.
            </p>
            <p className="text-fg leading-relaxed mt-3">
              Plus récemment, Codex a pris le relais sur une passe d'amélioration ciblée :
              chargement progressif des routes, état de connexion en direct visible, lecture produit
              du tableau de bord et ajustements de structure sans casser l'existant.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-fg-dim">
              <Sparkles className="h-3 w-3 text-ol-red-bright" aria-hidden="true" />
              <span>Données en direct via 365scores · Logos via Wikipedia FR · Hébergé sur Kubernetes (k3s).</span>
            </div>
            <FootballDataSourceNote what="Prochain match et heures des coups d’envoi de Ligue 1" className="mt-2" />
          </div>
        </div>
      </section>

      <section aria-labelledby="pile-technique" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* L260 : titres sans saut de niveau (WCAG 1.3.1) — h2 de la section, h3 de chaque groupe. */}
        <h2 id="pile-technique" className="sr-only">Pile technique</h2>
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
        <h2 className="font-display text-lg font-semibold text-fg-bright mb-1">
          Inspirations &amp; sources
        </h2>
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
              <span className="text-petite uppercase tracking-wider text-fg-dim">
                par {i.by}
              </span>
              <p className="text-xs text-fg-muted leading-relaxed mt-1">{i.why}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-6 mb-6">
        <h2 className="font-display text-lg font-semibold text-fg-bright mb-1">Mes autres sites</h2>
        <p className="text-sm text-fg-muted mb-5">
          Quatre autres apps perso vibe-codées avec Claude Code, toutes en open-source.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { tag: '🦖', name: 'Evatosorus', desc: 'Codex Mésozoïque (cadeau pour Eva)', url: 'https://evatosorus.pages.dev' },
            { tag: '⚔️', name: 'Warhammer 40K Codex', desc: 'Codex narratif de fan, W40K', url: 'https://github.com/Sylad/warhammer40k' },
            { tag: '💸', name: 'Finance Tracker', desc: 'Suivi finances perso (PDF Claude)', url: 'https://github.com/Sylad/finance-tracker' },
            { tag: '🌿', name: 'Eywa', desc: 'Codex Pandora (pour Eva)', url: 'https://avatar-pandora-12q.pages.dev' },
          ].map((s) => (
            <a key={s.name} href={s.url} target="_blank" rel="noopener"
              className="rounded-md border border-border p-3 flex items-center gap-3 hover:border-ol-red-bright transition-colors group">
              <span aria-hidden="true" className="text-2xl select-none">{s.tag}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-display font-semibold text-fg-bright group-hover:text-ol-red-bright transition-colors">{s.name}</span>
                <span className="block text-xs text-fg-muted">{s.desc}</span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-fg-dim group-hover:text-ol-red-bright shrink-0" />
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
        <div className="text-petite uppercase tracking-[0.2em] text-fg-dim mt-4">
          Allez l'OL · <span lang="en">Made with curiosity</span> · v2.0
        </div>
      </section>
    </div>
  );
}
