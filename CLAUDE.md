# OL Companion — guide Claude Code

App perso pour suivre l'Olympique Lyonnais (Ligue 1). Frontend React + TanStack, backend NestJS, sources de données : 365scores + football-data.org + Wikipedia FR. Déployé sur NAS Synology.

## Architecture

| | |
|---|---|
| Backend | NestJS 11 sur port `3002`, préfixe `/api` |
| Frontend | React 18 + Vite + TanStack Router/Query sur port `4202` (nginx) |
| Stockage | Caches JSON dans `data/` (fixtures, standings, news, cups, season-rankings, claude-usage) |
| Live | SSE `/api/events` (fixtures-changed, standings-changed, season-rankings-changed, claude-balance-changed) |
| Sources | 365scores (classement, forme), football-data.org (calendrier officiel), RSS (news), Wikipedia FR (logos) |

## Modules backend

`fixtures`, `standings`, `news`, `cups`, `players`, `wiki-image`, `channels`, `lineup`, `claude-usage`, `events`, `health`.

Endpoints clés :
- `GET /api/fixtures` — calendrier (cache 1h, refresh 5 min)
- `GET /api/standings`, `/api/standings/history`, `/api/standings/season-rankings` (365scores)
- `GET /api/news` — flux RSS multi-sources (cache 15 min)
- `GET /api/cups` — coupes (Coupe de France, Europa)
- `GET /api/wiki-image?q=NAME` — proxy Wikipedia FR avec cache
- `@Sse() /api/events` — flux SSE temps réel

## IDs externes

- **OL** : `teamId=523` (football-data) / `competitorId=465` (365scores) / `1649` (sofascore)
- **Ligue 1** : `competitionId=2015` (football-data) / `35` (365scores)

## 365scores

Headers obligatoires (sinon 403) : `X-Domain: fr`, `Referer: https://www.365scores.com/fr/football/league/ligue-1-35`, `User-Agent: Mozilla/5.0`.

## Workflow dev

```bash
ssh nas "cd /volume2/docker/developpeur/ol-companion && docker compose up -d --build ol-frontend"
```

## Variables d'env requises (`backend/.env`)

```
FOOTBALL_API_KEY=...          # token football-data.org
ANTHROPIC_API_KEY=sk-ant-...  # pour le claude usage badge partagé
CORS_ORIGIN=http://localhost:4202
PORT=3002
```

## Conventions code

- React 18, TypeScript strict, TanStack Router code-based, TanStack Query pour data fetching.
- Tailwind 3.4 + tokens HSL custom (`--ol-blue`, `--ol-red`, neon edges).
- Composants : 18+ dans `src/components/`, hooks `src/hooks/use-*.ts`, utils `src/lib/`.
- Sidebar sticky avec `NAV_ITEMS` et `SidebarLinks` (sources externes).
- BottomNav mobile (lg:hidden).

## Theme FC Noobz

Page `/fcnoobz` activate `body.theme-fcnoobz` → palette verte (lime + bleu électrique cyberpunk). Override des body::before/::after neon strips. Section perso pour Football Manager save.

## Pièges connus

- **365scores départage** : pour le classement Ligue 1, utiliser 365scores (qui respecte les règles LFP : différence de buts, buts marqués) et pas football-data.org (qui ne fait pas le départage correctement).
- **Wikipedia FR** : noms de villes / mots génériques tombent en faux positifs → mapping statique ID→full wiki name dans `wiki-image.service.ts` quand nécessaire.
- **Cache JSON** : invalidation manuelle si schéma cache change avant rebuild backend (sinon vieux objets servis).

## Stack précise

- React 18.3 · Vite 5.4 · TanStack Router 1.78 · TanStack Query 5.59 · Recharts 2.13 · Tailwind 3.4 · class-variance-authority · Lucide
- NestJS 11 · Anthropic SDK 0.91
- Docker multi-stage (`node:20-alpine` → `nginx:alpine`)
