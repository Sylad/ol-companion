# OL Companion — guide Claude Code

App perso pour suivre l'Olympique Lyonnais (Ligue 1). Frontend React + TanStack, backend NestJS, sources de données : 365scores + football-data.org + Wikipedia FR. En production sur le k3s de dark-blue (namespace `preprod`, chart `developpeur-gitops/charts/ol-companion`), public via le tunnel Cloudflare sur https://ol.sladoire.dev.

## Architecture

| | |
|---|---|
| Backend | NestJS 11 sur port `3002`, préfixe `/api` |
| Frontend | React 18 + Vite + TanStack Router/Query sur port `4202` (nginx) |
| Stockage | Caches JSON dans `data/` (fixtures, standings, news, cups, season-rankings) |
| Live | SSE `/api/events` (fixtures-changed, standings-changed, season-rankings-changed) |
| Sources | 365scores (classement, forme), football-data.org (calendrier officiel), RSS (news), Wikipedia FR (logos) |

## Modules backend

`fixtures`, `standings`, `news`, `cups`, `players`, `wiki-image`, `channels`, `lineup`, `events`, `health`.

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

En local sur Big-Blue :

```bash
cd backend && npm run start:dev    # NestJS --watch sur :3002 (caches dans backend/data/)
cd frontend && npm run dev         # Vite sur :5173, proxy /api → :3002
```

`docker-compose.yml` reste disponible pour un lancement local en conteneurs (`docker compose up -d --build`,
frontend sur :4202, données dans `./data`).

Livraison : commit + push sur `main` → la CI (`.github/workflows/build.yml`) construit et pousse
`ghcr.io/sylad/ol-companion-{backend,frontend}:sha-<7>` → `cadence deliver` (voir `cadence.yaml`)
lance `scripts/deploy.sh` (bump du tag dans `developpeur-gitops/charts/ol-companion/values.yaml`,
ArgoCD synchronise) puis `scripts/verify-rollout.sh` et les URL de santé.

## Variables d'env requises (`backend/.env`)

```
FOOTBALL_API_KEY=...          # token football-data.org
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
- **e2e backend hermétiques** (`npm run test:e2e`, `backend/test/app.e2e-spec.ts`) : tout l'AppModule démarre sans réseau (fetch et sockets non locaux bloqués, chaque tentative fait échouer le test), dans un cwd temporaire (jamais `backend/data/`), crons neutralisés par override de `SchedulerOrchestrator`. Tout service qui rafraîchit au démarrage dans `onModuleInit` doit être ajouté à `STARTUP_REFRESHERS` du test, sinon « aucun appel réseau sortant » échoue. La CI ne lance pas les tests.
- **Limite de débit par visiteur** : `ClientIpThrottlerGuard` (APP_GUARD) identifie le client par l'en-tête `CF-Connecting-IP`, que le nginx frontend pose lui-même (map + `proxy_set_header`, jamais la valeur du client), repli `req.ip`. Ne JAMAIS activer `trust proxy` (X-Forwarded-For forgeable). Tester la conf nginx avec `DOCKER_API_VERSION=1.44 scripts/test-nginx-conf.sh`. L'Ingress LAN `ol.dark-blue.lan` qui envoie `/api` directement au backend contourne ce nginx.

## Stack précise

- React 18.3 · Vite 5.4 · TanStack Router 1.78 · TanStack Query 5.59 · Recharts 2.13 · Tailwind 3.4 · class-variance-authority · Lucide
- NestJS 11 (aucun SDK LLM : l'app n'appelle jamais Claude, SDK Anthropic retiré en L17)
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
- ❌ Sofascore renvoie `403 Forbidden` côté serveur (Cloudflare bot-check). Tested 2026-05-10, rejeté comme alternative.
- ✅ Defense in depth : `standings.service.ts` ré-applique le tri LFP officiel localement après fetch (commit `faa283f`). Si 365scores change de format un jour, on reste robuste.
- ✅ **Current matchday robuste aux fixtures décalées** (fix 2026-05-10) : `currentMatchday` = MODE des `played` counts (pas le max), `roundComplete` = `≥ 75% des équipes au matchday courant` (pas `min === max`). Une équipe rescheduled-ahead (cas Nantes 2026-05-10 : 17 équipes à MD32, Nantes à MD33) ne fige plus la mise à jour de `season-rankings.json`. L'ancrage de l'entrée OL dans `season-rankings.json` est désormais sur `OL.played` directement, pas sur le `currentMatchday` de la ligue. Voir helpers `computeCurrentMatchday()` et `isRoundComplete()` testés (11 specs).
- ✅ Journées historiques pré-2026-04-28 peuvent être incorrectes — dette acceptée par user, pas de reconstruction.

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
- **Fenêtre coup d'envoi** (fix 2026-09-19) : dans [kickoff − 15 min ; + 3 h] on ne lâche JAMAIS le match connu, même si les 3 listes 365scores sont vides (le match sort de `fixtures` quelques secondes avant de passer en `statusGroup 3`) ou si un appel échoue (timeout 8 s sur 50 Ko, HTTP non-2xx). Échec → retry 60 s, jamais le throttle 15 min. Specs `live-match.service.spec.ts`.
- **Momentum** = dérivé du play-by-play 365scores (`game.playByPlay.feedURL`, `pbpgenerator.365scores.com`, TTL 10 s), pondéré/lissé dans `live-match.momentum.ts`. Le widget SportRadar (`momentumsrcf.365scores.com`) est un iframe dont le feed est verrouillé ; Sofascore 403. Ne pas rechercher une autre source sans nouvelle info.
- `game.members[]` peut contenir des pseudo-membres sans `id` (`'But annulé'`) : `id` optionnel dans le schéma, les consommateurs filtrent.

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
- Cron 1er août 03:00 Europe/Paris archive `data/<cache>.json` → `data/archive/<season>/`. Endpoint manuel `POST /api/admin/reset-season` derrière `PinGuard` + `DemoWriteGuard`.

### PIN guard + mode démo verrouillé (Cloudflare)
- `APP_PIN` (vide → permissif) protège les endpoints write : `POST /api/admin/reset-season`. SSE `/api/events` toujours bypass.
- `DEMO_FORCED_HOSTS` (default `trycloudflare.com,cfargotunnel.com`) : si le `Host` (jamais `X-Forwarded-Host`, forgeable par le client — L14) est l'un de ces noms ou un sous-domaine (égalité exacte ou suffixe précédé d'un point, jamais une sous-chaîne ; décision unique dans `modules/demo/forced-demo.ts`, partagée par le middleware et le `PinGuard`), le PIN est bypassé MAIS les écritures retournent 403 (`DemoWriteGuard`). Le frontend affiche le badge "Mode démo verrouillée" via `/api/demo/status` (hook `useDemoStatus` + `DemoBanner`). `DEMO_FORCED=true` (off par défaut) verrouille toute l'instance côté serveur, sans en-tête.
- La prod est publique via le tunnel Cloudflare (chart `cloudflared` de `developpeur-gitops`). Pour une démo ponctuelle depuis Big-Blue : `cloudflared tunnel --url http://localhost:4202` → URL random `https://*.trycloudflare.com` automatiquement en mode démo verrouillée.
- Voir `forced_demo_host_pattern.md` (mémoire user) pour le pattern complet, partagé avec finance-tracker.

## Plan, sessions et revue UX (cadence)

Le reste à faire vit dans `docs/plan/raf.yaml`, tenu par `raf`
([cadence](https://github.com/Sylad/cadence)) : chaque commit cite son lot dans le
message (`fix(L4): …`, `L2/t1`), `raf now` dit la suite, `raf check` repère les
écarts. Début et fin de session : skills `/cadence:session-start` et
`/cadence:session-close`.

**Plan de travail public** (`/plan`, L23) : après TOUT `raf` qui modifie le plan
(start, done, add, drop…) ou toute nouvelle entrée Nouveautés, lancer `cd frontend && npm run plan`
et commiter `frontend/public/plan-data/plan.json` (versionné : le build Docker n'a pas `docs/`) ;
le test `scripts/plan-data.test.mjs` échoue sinon. Seuls les lots `visible: true` sont publiés, sous
leur titre public (`public:` du lot, sinon titre de sa Nouveauté, sinon masqués) ; jamais les notes.
`npm run build` se termine par `plan-data.mjs --leaks dist` (code 1 si une note, un verdict UX ou un
titre brut du plan se retrouve dans le bundle).

**Revue UX obligatoire** (règle de Sylvain du 2026-09-28, tous les projets perso) : toute nouvelle
page ou modification d'écran est un lot `--visible`, revu par l'agent `cadence:ux-reviewer` (captures
1440 et 390 px, écarts fondés sur une règle nommée ou une mesure) avant `raf done`. Le verdict
s'enregistre avec `raf ux <lot> "…"`, sinon `raf done` refuse. Les lots « Revue UX — … » planifient
la revue de chaque écran existant ; les écarts trouvés deviennent des sous-tâches du lot.
