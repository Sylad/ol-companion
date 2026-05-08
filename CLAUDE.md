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

## Règles projet (durables)

### Palette stricte rouge + bleu OL
- ✅ **Vert** réservé aux usages **sémantiques universels** : forme W (W=vert / N=jaune / L=rouge), goal-difference positif, badge "Victoire", positions 1-3 LdC dans le classement (convention Sofascore/Google).
- ✅ **Bleu OL** (`--ol-blue` `#1e3a8a`, bright `#3b5dc9`) : trajectoires/évolutions (PositionTracker line), highlights neutres, primary CTAs, marqueurs équipes adverses sur la carte L1.
- ✅ **Rouge OL** (`--ol-red` `#dc2626`, bright `#ef4444`) : LIVE indicators, accents importants, "vous êtes ici", neon strip top, marqueur OL sur la carte L1, dot du point actuel sur PositionTracker.
- ❌ **Pas de vert décoratif** pour graphes/charts/lines/borders qui n'ont pas de sens "victoire".

### Theme FC Noobz
- Page `/fcnoobz` active `body.theme-fcnoobz` → palette **verte** (lime + bleu électrique cyberpunk). Override des `body::before/::after` neon strips. C'est la **seule** exception à la règle palette OL ci-dessus, isolée par le scope `body.theme-fcnoobz`.

### Standings — source unique 365scores + tri LFP
- ✅ Source = **365scores** (`competitions=35`), qui respecte l'ordre LFP officiel (différence générale, buts marqués, face-à-face).
- ❌ Ne **PAS** reconstruire un H2H local depuis football-data.org — déjà essayé, ne match pas ligue1.com.
- ✅ Defense in depth : `standings.service.ts` ré-applique le tri LFP officiel localement après fetch (commit `faa283f`). Si 365scores change de format un jour, on reste robuste.
- ✅ **Round-complete check** : la mise à jour de `season-rankings.json` ne se fait que si `MIN(played) === MAX(played)` (journée complète pour TOUTES les équipes), pour éviter les snapshots mid-journée. Journées historiques pré-2026-04-28 peuvent être incorrectes — dette acceptée par user, pas de reconstruction.

### Headers 365scores obligatoires
Sinon HTTP 403 :
```
X-Domain: fr
Referer: https://www.365scores.com/fr/football/league/ligue-1-35
User-Agent: Mozilla/5.0 ...
```
Centralisés dans `SCORES365_HEADERS`.

### Live-match
- Cron `*/30 * * * * *` (30 sec) sur `live-match.service`, mais **diff signature** avant emit SSE — pas de spam.
- Frontend : `useLiveMatchStats` poll **30s seulement en live**, jamais sinon.
- Détection match courant = live > recent <2h > upcoming <24h.

### Brackets de coupe
- CdF affichée dès stageNum **6** (1/4), EL dès stageNum **3** (1/8). En dessous, ne pas afficher (round trop tôt).
- Continue d'afficher après élimination OL — c'est voulu (suivi du parcours adverse).

### Carte Ligue 1 — markers bicolores
- Marker = cercle moitié gauche (leg aller) + moitié droite (leg retour). Couleur de chaque moitié = résultat OL côté concerné (V = bleu OL si match à domicile / D = rouge / N = neutre).
- Source = full-season history 365scores (pas seulement les matchs joués).
- Collision Paris (PSG + Paris FC) : offset visuel `+20px y` sur le 2ème.
- OL marker = rouge plein (cf palette).

### Sources d'images (par ordre)
1. **Wikipedia FR** via `/api/wiki-image?q=` (logo, stadium, joueurs).
2. **CDN 365scores** pour logos clubs : `imagecache.365scores.com/.../Competitors/<id>` (utilisé sur popups carte L1).
3. **Site officiel ol.fr** (logo SVG/PNG haute qualité).
4. **Sofascore** (https://sofascore.com — teamId OL = 1649) pour stats détaillées si 365scores manque.
- ❌ Mots génériques (noms de villes, prénoms) tombent en faux positifs sur Wikipedia FR. Solution : mapping statique ID → full wiki name dans `wiki-image.service.ts` quand nécessaire.

### Cache JSON
- Invalidation **manuelle** si schéma cache change avant rebuild backend (sinon vieux objets servis avec champs manquants).

### Season reset
- Cron 1er août 03:00 Europe/Paris archive `data/<cache>.json` → `data/archive/<season>/`. Endpoint manuel `POST /api/admin/reset-season` derrière `PinGuard` (pas encore activé, mais réservé).
