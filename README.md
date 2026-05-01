# OL Companion

> Compagnon perso pour suivre l'Olympique Lyonnais : calendrier, classement Ligue 1 (avec règles LFP de départage), effectif, news, coupes. Plus une section privée FC Noobz pour suivre l'équipe loisirs entre amis.

![OL Companion — dashboard — placeholder](./docs/screenshots/dashboard.png)

## Pourquoi

Dev Java/web depuis 2005, je voulais explorer [Claude Code](https://claude.com/claude-code) sur un stack moderne (**React 18 + Vite + Tailwind + shadcn**) avec un sujet vraiment perso : suivre l'OL au jour le jour, sans dépendre d'apps mainstream qui pollue d'ads ou imposent un parcours.

L'identité visuelle reprend les **codes du club** (rouge + bleu lyonnais) avec une mise en scène inspirée d'un néon "Olympique Lyonnais" qui éclaire le fond de page. Référence design : Sofascore, Football Manager, Linear.

En amont du code, [ChatGPT](https://chat.openai.com) a aidé à générer le **logo OL Companion** et les premières maquettes UX qui ont guidé la construction.

## Fonctionnalités

- **Dashboard** — prochain match, dernier résultat, position au classement
- **Classement Ligue 1** avec règles LFP (différence générale, buts marqués, etc.) — données 365scores
- **Trajectoire saison** : tracker de position (chart Recharts, line OL bleu + dot OL rouge sur la journée courante)
- **Calendrier** — fixtures passés + à venir avec adversaires, scores, compositions
- **Effectif** — composition (formation field SVG dynamique) + liste des joueurs avec photos 365scores CDN
- **Coupes** — Coupe de France + Coupes d'Europe le cas échéant
- **News** — agrégat de sites OL (officiel, olympique-et-lyonnais.com)
- **YouTube** — chaînes lore/club (officielle, Olympique-et-Lyonnais, Julien Le Gone, Le Onze Lyonnais, Aulasinho, Teddy Spencer)
- **FC Noobz** — section privée perso (ex: équipe loisirs entre amis)

## Stack

| Couche | Tech |
|---|---|
| Frontend | React 18 + TypeScript 5 + Vite 5 + Tailwind 3 + TanStack Router/Query + Recharts |
| Backend | NestJS 10 + TypeScript 5 + Anthropic SDK + node-fetch |
| Storage | JSON cache local (TTL 1h sur fixtures, etc.) |
| Sources externes | [365scores](https://www.365scores.com/) (classement + lineups), [football-data.org](https://www.football-data.org/) (free tier, fixtures), Wikipedia FR |
| Build | Docker multi-stage (node:20-alpine → nginx:alpine) |
| Déploiement | docker-compose (testé Synology NAS DSM) |

## Setup local

### Prérequis
- Docker 24+
- Une clé [football-data.org](https://www.football-data.org/client/register) (free tier suffit pour Ligue 1)
- Optionnel : clé Anthropic pour les enrichissements lore/résumés

### Lancement
```bash
git clone <ce-repo> ol-companion
cd ol-companion

cp backend/.env.example backend/.env
# Édite FOOTBALL_API_KEY (obligatoire) + ANTHROPIC_API_KEY (optionnel)

mkdir -p data
docker compose up -d --build
```

Frontend disponible sur `http://localhost:4202`.
Backend API sur `http://localhost:3002/api/health`.

Les caches API (fixtures, standings, etc.) se peuplent au premier appel.

## Identité visuelle

- **Palette** : rouge (HSL 0 73% 50%) + bleu OL (HSL 224 64% 33%) + or discret pour les accents nobles
- **Néon** : `body::before/::after` lignes lumineuses haut/bas (rouge/bleu)
- **Fonts** : Inter / Manrope (display) / Geist Mono (chiffres tabular)
- **Règle stricte** : pas de vert sauf sémantique universelle (W/victoire/+goals/LdC). Le décoratif reste rouge ou bleu OL.

## Notes

- 365scores n'a pas d'API publique officielle ; ce projet utilise leur endpoint web non-documenté avec headers raisonnables. Si tu forks pour un autre club, regarde `backend/src/modules/standings/` et `backend/src/modules/lineup/` pour le pattern.
- Le module wiki-image est porté du projet warhammer40k (FR cette fois).

## Crédits IA

- **[Claude Code](https://claude.com/claude-code)** (Anthropic) — code frontend, backend, infra Docker
- **[ChatGPT](https://chat.openai.com)** (OpenAI) — logo OL Companion, premières maquettes UX, propositions de design

Inspirations design : [Sofascore](https://www.sofascore.com/), Football Manager 2024, [Linear](https://linear.app).
Principes UX : [refactoringui.com](https://refactoringui.com/), [lawsofux.com](https://lawsofux.com/).

OL ❤️

## Licence

MIT pour le code. Les marques OL, 365scores, football-data appartiennent à leurs ayants-droit respectifs.

---

**Si tu veux faire pareil** — prends un sujet qui t'enflamme, ouvre Claude Code, décris en langage naturel ce que tu rêves de voir exister, puis itère. Tu seras surpris de ce qu'on peut bâtir en quelques sessions.
