# OL Companion — guide Claude Code

App perso pour suivre l'Olympique Lyonnais (Ligue 1). Frontend React + TanStack, backend NestJS, sources de données : 365scores + football-data.org + Wikipedia FR. En production sur le k3s de dark-blue (namespace `preprod`, chart `developpeur-gitops/charts/ol-companion`), public via le tunnel Cloudflare sur https://ol.sladoire.dev.

## Architecture

| | |
|---|---|
| Backend | NestJS 11 sur port `3002`, préfixe `/api` |
| Frontend | React 18 + Vite + TanStack Router/Query sur port `4202` (nginx) |
| Stockage | Caches JSON dans `data/` (fixtures, standings, news, cups, season-rankings) |
| Live | SSE `/api/events` (fixtures-changed, standings-changed, season-rankings-changed) |
| Sources | 365scores (classement, forme, calendrier de la saison), football-data.org (prochain match, heure des coups d'envoi fixée ou non), RSS (news), Wikipedia FR (logos) |

## Modules backend

`fixtures`, `standings`, `news`, `cups`, `players`, `france`, `wiki-image`, `channels`, `lineup`, `events`, `health`.

Endpoints clés :
- `GET /api/fixtures` — Ligue 1 selon football-data : matchs joués (`limit=40`, toute la saison pour le `.ics`) + toute la fin de saison, matchs en cours, interrompus et reportés compris (`limit=100`, cache 1h, refresh 30 min ; deux appels, chacun avec une liste de statuts, sinon un match en cours sortait du `.ics`) ; dit au calendrier si l'heure d'une journée est fixée
- `GET /api/season-matches` — toute la saison, toutes compétitions suivies (365scores, cache 30 min) ; sert la page Calendrier, le « dernier résultat » et le « prochain rendez-vous » du tableau de bord (L45, toutes compétitions), la carte, les statistiques d'équipe et de joueurs
- `GET /api/france` — équipe de France A (L113) : `nextMatch`, 5 derniers `results`, `squad`, en un appel (365scores `competitorId` 5061 ; copie 10 min, dernière réponse connue si 365scores échoue, sinon 503) ; `nextMatch.timeConfirmed` = faux au-delà de 14 jours (365scores seul, pas de football-data) ; même règle (`config/kickoff-horizon.ts`) pour `timeConfirmed` de `GET /api/live-match/{gameId}/stats`, lu par l'en-tête de la page de match des Bleus (L168) ; pour un match de **Ligue 1 à venir**, football-data qui parle de la journée décide (`footballDataSaysKickoff`, `kickoff-confirmation.ts`, L170), les 14 jours ne servent qu'en son silence ; un match à venir d'une **autre compétition suivie** (`TRACKED_COMPETITIONS`) a `timeConfirmed` vrai, comme dans `/api/season-matches` (L172) : seuls les Bleus et les amicaux gardent les 14 jours
- `GET /api/calendar.ics` — abonnement d'agenda (L264), Ligue 1 seule, **football-data.org seul** (aucune donnée de 365scores : ses conditions interdisent le service à des tiers) ; `UID` = `fd-<id football-data>@ol.sladoire.dev`, `SEQUENCE` + 1 quand le moment change (heure fixée, avancée, report), `DTSTAMP` = `LAST-MODIFIED` = dernière modification, révisions dans `data/calendar-revisions.json` (flux identique d'une lecture à l'autre tant que rien ne change) ; horaire non fixé = événement en dates seules (vendredi → dimanche pour un week-end) ; aucun match → 503 en `Cache-Control: no-store` (L268 : une erreur n'est jamais cachable ; le 200 reste `public, max-age=900`, Cloudflare répond `cf-cache-status: DYNAMIC`, mesuré le 20-11), jamais un calendrier vide (l'agenda effacerait ses matchs) ; révisions lues validées (`validRevisions` : fichier d'une autre forme ignoré, entrée `null` ou incomplète écartée seule, journalisé). Bouton « S'abonner » sur `/fixtures` (`components/calendar-subscribe.tsx`). Code : `modules/calendar/` (`ics.ts` : échappement, pliage à 75 octets, CRLF)
- `GET /api/match-impact?at=<coup d'envoi ISO>` — « Ce que ça change » (L265) : place de l'OL avant/après la journée d'un match de Ligue 1 terminé et écart avec les places clés (1, 3, 5, 6, 15), **football-data.org seul** (`/v4/competitions/2015/matches`, un appel, copie `data/ligue1-matches-fd.json` de 15 min, lue à la demande, jamais au démarrage ; après un appel en échec — 429, réseau, réponse vide — aucun nouvel appel avant 15 min, `LEAGUE_MATCHES_FAILURE_WAIT_MS` : la clé est partagée avec le calendrier) ; même départage que le tracker (`rankedTableUpTo`, `season-rankings.ts`) ; journée provisoire tant qu'un match des journées 1 à N n'est pas terminé (`remaining`) ; 404 si football-data n'a pas de match de l'OL à 12 h près, 503 sans donnée. Bloc `components/ce-que-ca-change.tsx` (« Dernier résultat » de l'accueil, titre h3 sous le h2 de la carte ; page d'un match de L1 terminé : rangée à part, dernière du centre, sur toute sa largeur, sous la rangée Carte des tirs | pile — règle R19 de `docs/specs/page-match-fm/fiche.yaml` ; ni dans la pile de 264 px (5 lignes, 430 px vides), ni entre l'en-tête et la grille, qui faisait passer Statistiques | Momentum sous le pli à 1366 × 768, R16) ; place réservée pendant le chargement (`aria-busy`) : sur /match comme à l'accueil, le gabarit superpose en CSS (`content: attr(data-gabarit)`, invisible, hors DOM) le cas le plus long, ≤ 4 px de décalage exigé avec ou sans « Provisoire » et en 503 (`tests-navigateur/match-geometrie.test.ts` à 1366, 1440 et 390 ; `tests-navigateur/accueil-ce-que-ca-change-L265.test.ts` à 375, 390 et 1440 — la réserve de deux lignes de l'accueil laissait « OL en chiffres » descendre de 56 px à 390, revue UX r2) ; badge « Provisoire » neutre (`text-fg-muted` sur `bg-surface-2`, 6,8:1), jamais `draw` ; mention football-data dans la note des sources seulement si le bloc montre une donnée ; phrase dans `lib/ce-que-ca-change.ts`. `src/test/setup.ts` simule `use-match-impact` pour TOUS les tests (404 : ni bloc ni appel, les tests scellés de `/match` restent intacts) ; un test du bloc reprend le vrai hook par `vi.unmock('@/hooks/use-match-impact')` (`match.ce-que-ca-change-L265.test.tsx`). Tests navigateur : réponses dans `tests-navigateur/donnees/match-impact-L265.json`
- `GET /api/standings`, `/api/standings/history`, `/api/standings/season-rankings` (365scores)
- `GET /api/news` — flux RSS multi-sources (cache 15 min)
- `GET /api/cups` — coupes (Coupe de France, Ligue Europa, qualifications de Ligue des champions) ; statuts : « Éliminé » (`isCupEliminated`, seulement sur preuve : dernière confrontation à élimination directe perdue — les deux manches d'un aller-retour (`legNum`) dans les résultats, sinon le cumul ne prouve rien, L175, sauf qualifié lu chez 365scores — et rien à venir, ou 50 jours sans match), « En lice », « En attente du tirage » (phase de ligue jouée, classement illisible) et, pour les seules qualifications (332), « Qualifié » (`isQualifiersWon`, L174) : les DEUX manches des barrages sont dans les résultats, rien à venir, cumul gagné (ou qualifié désigné par 365scores) ; un aller seul joué reste « En lice », car 365scores retire un match des matchs à venir avant le coup d'envoi et ne le met dans les résultats qu'à la fin ; « Qualifié » prime sur « Éliminé »
- `GET /api/wiki-image?q=NAME` — proxy Wikipedia FR avec cache
- `@Sse() /api/events` — flux SSE temps réel

## IDs externes

- **OL** : `teamId=523` (football-data) / `competitorId=465` (365scores) / `1649` (sofascore)
- **Ligue 1** : `competitionId=2015` (football-data) / `35` (365scores)
- **Autres compétitions suivies (365scores)** : Coupe de France `37`, Ligue Europa `573`, Ligue des champions `572` et ses qualifications `332` (une compétition à part chez 365scores)

## 365scores

En-têtes honnêtes seulement (L267) : `User-Agent: ol-companion/<version> (+https://ol.sladoire.dev)`, `Accept`, `Accept-Language` ; ni `Referer`, ni `Origin`, ni `X-Domain`, ni User-Agent de navigateur (règle de Sylvain : aucun contournement anti-robot). Mesuré le 20-11 : les six familles d'appels répondent 200 sans eux (`docs/etudes/365scores-conditions.md`). Si 365scores refuse un jour ce client, l'app affiche son erreur et l'on change de source : on ne remet PAS d'en-tête imité. Conditions d'utilisation : usage public non couvert sans accord écrit (même étude, § 3).

## Workflow dev

En local sur Big-Blue :

```bash
cd backend && npm run start:dev    # NestJS --watch sur :3002 (caches dans backend/data/)
cd frontend && npm run dev         # Vite sur :5173, proxy /api → :3002
```

`docker-compose.yml` reste disponible pour un lancement local en conteneurs (`docker compose up -d --build`,
frontend sur :4202, données dans `./data`).

Tests navigateur (L187) : `cd frontend && npm run test:navigateur` mesure la géométrie de la page match dans Chromium (Playwright, `tests-navigateur/`) ; hors `npm test` et hors CI (demande `npx playwright install chromium`). Un changement de mise en page de `/match` se rejoue là, jsdom ne mesure rien.

Dépendances frontend (L182) : `frontend/package-lock.json` est suivi, CI et Dockerfile font `npm ci` ; toute modif de `package.json` commite aussi le lockfile.

Livraison : commit + push sur `main` → la CI (`.github/workflows/build.yml`) construit et pousse
`ghcr.io/sylad/ol-companion-{backend,frontend}:sha-<7>` → `cadence deliver` (voir `cadence.yaml`)
lance `scripts/deploy.sh` (bump du tag dans `developpeur-gitops/charts/ol-companion/values.yaml`,
ArgoCD synchronise) puis `scripts/verify-rollout.sh`, les URL de santé et `scripts/verify-cache.sh`.

**Fuseau des tests frontend (L169)** — `vitest.config.ts` et `vitest.acceptation.config.ts` posent `process.env.TZ = 'Europe/Paris'` : l'app affiche l'heure de Paris, et le runner GitHub est en UTC (un coup d'envoi à 20:00 UTC s'y lisait « 20h00 » au lieu de « 21h00 »). Vérifier : `TZ=UTC npm test`.

**Cache HTTP du frontend (L54)** — `frontend/nginx.conf` : `index.html` (`/`, `/index.html`, repli des
routes) et les fichiers de `public/`, aux noms fixes (`sw.js`, manifeste, icônes, `plan-data/`,
`nouveautes-data/`), partent en `Cache-Control: no-cache` (revalidés à chaque visite, 304 possible) ;
`/assets/` (noms à empreinte de Vite) en `public, max-age=31536000, immutable`, et un fichier absent y
répond 404 `no-store`, jamais le repli HTML. Ne rien servir sous `/assets/` sans empreinte dans le nom.
Le service worker (`public/sw.js`) n'intercepte ni les navigations ni `/assets/` : il ne garde que
l'icône, le manifeste et le favicon (cache `olc-shell-v1`, à renommer si l'un d'eux change). Preuve
rejouable : `cd frontend && npm run build`, puis `DOCKER_API_VERSION=1.44 scripts/test-nginx-cache.sh` (L58 : Range sans 206 ni 416, 404 `no-store` exigé aussi par `verify-cache.sh`, provenance des fichiers de `assets/` ; rejoué par la CI, job `nginx-cache`).

## Variables d'env requises (`backend/.env`)

```
FOOTBALL_API_KEY=...          # token football-data.org
CORS_ORIGIN=http://localhost:4202
PORT=3002
```

## Conventions code

- React 18, TypeScript strict, TanStack Router code-based, TanStack Query pour data fetching.
- Tailwind 3.4 + tokens HSL custom (`--ol-blue`, `--ol-red`, neon edges).
- **Tailles de texte (L258)** : une seule échelle, en rem, dans `frontend/src/theme/typographie.ts` (`text-petite` 12 px, `text-moyenne` 14, `text-grande` 16, plus `dense`, `titre`, `score*`, `display-*` ; les `text-xs`… de Tailwind restent permis), racine `html { font-size: 100% }`. Jamais de `text-[Npx]`, de `font-size` ou de raccourci `font:` en px, de `fontSize` numérique (style, attribut JSX/SVG ; Recharts : `TAILLE.petite`) ni de taille en rem/em sous 12 px : `typographie.test.ts` les refuse. Une nouvelle taille s'ajoute au thème ; `cn` (tailwind-merge) connaît ses noms. Le plancher se mesure sur la TAILLE CALCULÉE (L261) : `tests-navigateur/plancher-12px-L261.test.ts` parcourt toutes les pages à 390 et 1440 px (réponses réelles de l'API dans `tests-navigateur/donnees/`) — une page ou un endpoint nouveau s'y ajoute ; `sup`/`sub`/`small` ont un plancher de 0,75 rem (`index.css`). Composition de /match (L269, D-1) : une rangée de la formation = une ligne à l'écran, toujours (le quinconce de L261 a été retiré : il coupait une défense à 4 en 2 + 2) ; noms toujours à 12 px (plus aucune réduction, `TAILLES_NOM_PASTILLE` supprimé) ; une pastille part de la largeur commune (`flex: 0 1`) mais ne descend jamais sous son mot le plus large (`min-width: auto`), ses voisines cèdent la place ; si une rangée ne tient pas même ainsi, ses noms les plus larges, un à un, se coupent en syllabes avec trait d'union (césures douces, `lib/coupure-nom.ts`, dernier recours). Mesure dans Chromium : `plancher-12px-L261.test.ts` (Lille – Lyon 4-3-3 et 4-2-3-1, `donnees/lille-lyon-L269.json`, à 320, 390, 1366 et 1440).
- Composants : 18+ dans `src/components/`, hooks `src/hooks/use-*.ts`, utils `src/lib/`.
- Sidebar sticky avec `NAV_ITEMS` et `SidebarLinks` (sources externes).
- BottomNav mobile (lg:hidden).

## Theme FC Noobz

Page `/fcnoobz` activate `body.theme-fcnoobz` → palette verte (lime + bleu électrique cyberpunk). Override des body::before/::after neon strips. Section perso pour Football Manager save.

**Mes carrières (L121)** : `/fcnoobz/carrieres` lit `frontend/public/fcnoobz-data/carrieres.json` (statique, aucun appel backend), produit sur Big-Blue par `cd frontend && node scripts/fcnoobz-import.mjs <relevé.json>…` (saisie à la main ou résumé de sauvegarde, exemple `scripts/fcnoobz-releve-exemple.json`) puis relu et commité. Liste blanche (`scripts/fcnoobz-carrieres-schema.mjs`) : édition, club, saison, division, place, titres, enCours, provenance, releveLe — jamais un nom de joueur ni une finance ; l'import refuse le reste et `fcnoobz-import.test.mjs` revérifie le fichier publié. Fiche : `docs/specs/fcnoobz-carrieres/fiche.yaml`. La lecture des sauvegardes par `fmsave` (étude L120, I1) n'est pas codée.

## Pièges connus

- **365scores départage** : pour le classement Ligue 1, utiliser 365scores (qui respecte les règles LFP : différence de buts, buts marqués) et pas football-data.org (qui ne fait pas le départage correctement).
- **Wikipedia FR** : noms de villes / mots génériques tombent en faux positifs → mapping statique ID→full wiki name dans `wiki-image.service.ts` quand nécessaire.
- **Cache JSON** : invalidation manuelle si schéma cache change avant rebuild backend (sinon vieux objets servis).
- **e2e backend hermétiques** (`npm run test:e2e`, `backend/test/app.e2e-spec.ts`) : tout l'AppModule démarre sans réseau (fetch et sockets non locaux bloqués, chaque tentative fait échouer le test), dans un cwd temporaire (jamais `backend/data/`), crons neutralisés par override de `SchedulerOrchestrator`. Tout service qui rafraîchit au démarrage dans `onModuleInit` doit être ajouté à `STARTUP_REFRESHERS` du test, sinon « aucun appel réseau sortant » échoue. La CI ne lance pas les tests.
- **Limite de débit par visiteur** : `ClientIpThrottlerGuard` (APP_GUARD) identifie le client par l'en-tête `CF-Connecting-IP`, que le nginx frontend pose lui-même (map + `proxy_set_header`, jamais la valeur du client), repli `req.ip` ; une IPv6 est suivie par son préfixe /64 (L19, `clientTracker`), une IPv4 mappée redevient IPv4. Ne JAMAIS activer `trust proxy` (X-Forwarded-For forgeable). Tester la conf nginx avec `DOCKER_API_VERSION=1.44 scripts/test-nginx-conf.sh`. L'Ingress LAN `ol.dark-blue.lan` qui envoie `/api` directement au backend contourne ce nginx.
- **Seaux de la limite** (L32) : `backend/src/config/throttlers.ts` — défaut 10/s + 60/min par visiteur ; `/api/wiki-image` (cache serveur, un appel par logo) a le sien, 40/s + 300/min (`@Throttle`). Mesure du 03-10 : un premier chargement de /standings = 26 appels `/api` en 250 ms dont ~20 logos, 12 refusés en 429. Le classement prend en plus ses écussons au CDN 365scores (`TeamLogo src=seasonTeamLogoUrl`), sans appel wiki-image. Ne pas ajouter d'appel `/api` par ligne d'une liste.

## Stack précise

- React 18.3 · Vite 8.3 (Rolldown, Oxc) · Vitest 5.1 · @vitejs/plugin-react 6 · TanStack Router 1.78 · TanStack Query 5.59 · Recharts 2.13 · Tailwind 3.4 · Lucide
- NestJS 11 (aucun SDK LLM : l'app n'appelle jamais Claude, SDK Anthropic retiré en L17)
- Backend (L251) : @nestjs/core, common, platform-express, testing en 11 ; @nestjs/cli, schematics, config, schedule en 12, TypeScript 6. config et schedule 12 sont ESM uniquement : Jest (Node 22) ne les charge que transformés en CommonJS (`transformIgnorePatterns` + `babel-jest` avec `@babel/plugin-transform-modules-commonjs`, dans `package.json` et `test/jest-e2e.json`) — un autre paquet ESM-only (core 12…) doit être ajouté au motif. `overrides` npm (glob 14, minimatch 11 sous test-exclude) : ferment les failles de la chaîne de Jest. Note : `docs/etudes/montee-nestjs12-node22-L251.md`.
- Docker multi-stage : frontend `node:22-alpine` → `nginx:alpine` (Vitest 5 exige Node 22.12+, CI frontend en Node 22, L250), backend `node:22-alpine` (L253, Node 20 en fin de vie)

## Règles projet (durables)

### Palette stricte rouge + bleu OL
- ✅ **Vert** réservé aux usages **sémantiques universels** : forme W (W=vert / N=jaune / L=rouge), goal-difference positif, badge "Victoire", positions 1-3 LdC dans le classement (convention Sofascore/Google), **échelle des notes des joueurs** (pastilles du terrain, L7 : vert ≥ 8, vert-jaune ≥ 7, jaune ≥ 6, orange ≥ 5, rouge ; seul le chiffre change de couleur pour tenir 4,5:1, `ratingTextColor`).
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
- ✅ **Rendus dégradés de 365scores** (fix 2026-10-03) : l'origine sert par moments, en HTTP 200, 18 lignes dont 1 à 3 sans objet `competitor`, ou une enveloppe de 121 octets sans clé `standings` ; les lignes touchées changent d'un rendu à l'autre, quels que soient les en-têtes et les paramètres, et CloudFront fige chaque rendu 30 min par clé (URL + `Origin` + variante `Accept-Encoding`, pas le `Referer`). Lecture unique `readScores365Standings()` (`standings/scores365-standings.ts`), partagée par `StandingsService` et le mini-classement du direct : le club d'une ligne sans `competitor` est le seul présent dans TOUS les matchs de la ligne (`detailedRecentForm` + `nextMatch`) ; ligne non attribuable ou club en double → tout le classement est refusé avec un log, jamais de classement incomplet. Ne pas « corriger » en changeant d'en-têtes ou de `langId`.
- ✅ **Tracker de classement de l'accueil (L241)** : `season-rankings.json` n'est PLUS une photo du classement du moment (relevée quand 14 clubs sur 18 avaient le même nombre de matchs, réécrite à chaque heure : J7 était 4e alors que l'OL était 1er à l'issue de la J7). `StandingsService.refreshSeasonRankings` lit les résultats de toute la Ligue 1 (`/web/games/results/?competitions=35`, pages `paging.previousPage` jusqu'à la J1), `computeOlRankingsByRound` (`standings/season-rankings.ts`) recalcule le classement après chaque journée où l'OL a joué (matchs de `roundNum` ≤ journée ; ordre officiel LFP complet (ligue1.com/fr/articles/l1_article_2830-, cité dans `compare`) : points, différence de buts générale, points puis différence de buts en confrontations directes (entre les clubs encore à égalité), buts marqués, victoires, victoires à l'extérieur ; fair-play et tirage au sort non calculables : égalité restante = meilleure place du groupe, L242 : Lyon et Lille, 4 pts et +2 à la J2 sans confrontation directe, se départagent aux buts marqués (Lille 4, Lyon 3) : Lyon 4e, ce que confirme le tableau « Évolution du classement » de Wikipédia FR 2026-2027 ; la cible « 3e » de la référence de Sylvain et de Sofascore n'est reproduite par aucune source officielle). Appel en échec ou sans match : le fichier reste. Test sur résultats réels : `season-rankings.spec.ts` (fixture `test/fixtures/ligue1-2026-results-j1-j9.json`). `currentMatchday` reste le MODE des `played` (fix 2026-05-10, `computeCurrentMatchday()`).
- ✅ Journées historiques pré-2026-04-28 peuvent être incorrectes — dette acceptée par user, pas de reconstruction.

### Calendrier — une source par match, jamais d'heure inventée (L39)
- ✅ La page `/fixtures` lit **`/api/season-matches`** (365scores) : Ligue 1, Ligue des champions (qualifications comprises), Ligue Europa, Coupe de France, dans l'ordre des dates. Elle ne lit plus `/api/fixtures` ; le dernier résultat (L131, toutes compétitions) et le prochain rendez-vous (L45) du tableau de bord lisent aussi `/api/season-matches`.
- ✅ **Une seule liste des compétitions suivies** : `TRACKED_COMPETITIONS` (`season-matches.service.ts`, identifiant 365scores → code + nom). Tout ce qui lit `getMatches()` en dépend : calendrier, carte (Ligue 1 seule, filtre `L1`), statistiques d'équipe et de joueurs. Une compétition de la saison absente de la liste est journalisée (`compétition non suivie`) à chaque rafraîchissement — les 4 qualifications de Ligue des champions d'août 2026 (`332`) avaient été écartées en silence. Les matchs amicaux (`321`) ne sont pas suivis. La page Coupes a sa propre liste (`cups.service.ts`, `COMP_NAMES` et `COMP_ORDER` : `37`, `573` et `332`, les qualifications de Ligue des champions, L174 ; le tableau à élimination n'existe que pour `37` et `573`).
- ✅ **Match sans journée** (`roundNum` absent : qualifications, tours à élimination) : `matchday: null` et `round` = tour + manche, lus dans `stageName` et `legNum` (« 3e tour de qualification · aller », « Barrages · retour »). Un tour sans nom français connu n'est pas affiché. Le score est celui du match, pas le cumul aller-retour : le cumul calculé à partir de l'aller est dans `aggregateScore` (L51), `null` hors manche retour jouée.
- ✅ **Toute la saison** : `SeasonMatchesService` demande `/web/games/results/` (matchs joués), puis `/web/games/fixtures/` (≈ 27 matchs à venir d'un coup) et suit `paging.nextPage` jusqu'à l'enveloppe sans `games` (plafond `FORWARD_PAGES`, journalisé s'il est atteint). Avant, 8 pages de 3 à 5 matchs s'arrêtaient à J28. La journée vient de `roundNum`.
- ✅ **`timeConfirmed`** (sur les deux endpoints) : 365scores ne signale PAS une heure non fixée — il met une heure de remplissage (17:00 UTC le samedi) que rien ne distingue d'une vraie. football-data le dit : statut `SCHEDULED` + `utcDate` à 00:00:00Z (contre `TIMED`) ; un match reporté ou interrompu (`POSTPONED`, `SUSPENDED`) à 00:00:00Z n'a pas d'heure non plus (L268, `fixtures/kickoff-time.ts`), sinon il s'affichait à 01:00. Règle (`season-matches/kickoff-confirmation.ts`, spec directe `kickoff-confirmation.spec.ts`) pour un match de Ligue 1 à venir : football-data **parle** de la même journée → il décide (`TIMED` = fixée **si son instant est celui de 365scores** — sinon l'heure de 365scores est un remplissage ou une valeur périmée, « à confirmer » (L46, `footballDataSaysKickoff(matchday, footballData, date)`, aussi pour la réponse stats du direct) ; `SCHEDULED` à minuit UTC = à confirmer) ; football-data n'en dit **rien** (clé absente, pas de cache, appel en échec, journée au-delà de sa réponse, match sans journée) → l'heure de 365scores est affichée si le match est dans les **14 prochains jours**, « à confirmer » au-delà. Match joué ou en cours, et autres compétitions : heure de 365scores tenue pour fixée, faute de signal.
- ✅ **Un appel football-data refusé ne retire rien** (`FixturesService`) : `fetchMatches` rend `null` sur un 429, une erreur réseau ou une charge illisible (jamais `[]`, qui veut dire « aucun match ») ; la partie en échec (matchs joués ou à venir) est reprise du dernier cache, la réponse fraîche l'emporte sur un match gardé, et si les deux appels échouent le cache n'est pas réécrit. **Borne d'âge (L46)** : le cache note le dernier succès de chaque partie (`finishedAt`, `upcomingAt` ; un cache plus ancien se date par `ts`) ; une partie gardée plus de 24 h est abandonnée (le calendrier retombe sur la règle des 14 jours) avec une ligne `error` au journal, et si les deux appels échouent depuis plus de 24 h le cache est servi tel quel mais l'échec durable est journalisé en `error`. Avant, un 429 sur les matchs à venir réécrivait le cache avec les seuls matchs joués et le match du lendemain passait en « Horaire à confirmer ».
- ✅ **Jour non fixé (L47)** : `timeConfirmed: false` vaut aussi pour le jour (la date est un remplissage, un samedi pour 18 lignes sur 21). `lib/kickoff.ts` `unconfirmedDay()` : vendredi/samedi/dimanche → « Week-end du <samedi> », autre jour → « Date (et horaire) à confirmer » ; calendrier, carte Prochain et tableau de bord. Le tableau de bord n'affiche alors ni compte à rebours ni « Jour de match » : statut « À confirmer ».
- ✅ **Bandeau de l'accueil pendant un direct (L84)** : `DashboardHero` lit aussi `useCurrentLiveMatch()` ; si `status === 'live'`, le bandeau montre ce match (`liveAsMatch`, identifiants 365scores → OL = 523 comme dans la liste de la saison), sinon le prochain match de `/api/season-matches`. 365scores sort le match en cours de ses matchs à venir : la liste de la saison ne l'a pas (le bandeau disait « Prochain rendez-vous · Nice » pendant Lens – Lyon). Ne pas faire dépendre le bandeau du seul `IN_PLAY` de la liste.
- ✅ Le champ est **dérivé à chaque lecture** (`FixturesService.peekFixtures()`, sans appel réseau), jamais écrit dans les caches JSON. Côté écran, une seule règle : `lib/kickoff.ts` (« Horaire à confirmer »).
- ✅ **Nom d'une compétition lue brute (L72)** : `/match`, la carte du direct et « Dernier match » de `/players` passent par `competitionLabel(competitionId, nomBrut)` (`lib/competitions.ts`, glossaire par identifiant 365scores : `35`, `37`, `573`, `572` et `332`) ; jamais « France, Ligue 1 ». `/api/lineup` porte `competitionId` (un cache plus ancien sans lui affiche le nom brut jusqu'au prochain rafraîchissement) ; une compétition non suivie garde son nom brut.
- ✅ Écussons du calendrier et du dernier résultat : CDN 365scores par identifiant (`seasonTeamLogoUrl`, `TeamLogo src=`), pas `/api/wiki-image` — une trentaine de clubs d'un coup dépassait la limite de débit, et la recherche par nom rendait une photo de ville pour des clubs européens.
- ❌ Ne pas déduire « heure non fixée » de l'heure elle-même : 17:00 UTC est aussi une vraie heure de coup d'envoi (19:00 l'été).

### En-têtes sortants : l'app se nomme (L267)
- Tout appel sortant (365scores, football-data, Wikipédia, RSS) porte `User-Agent: ol-companion/<version du backend> (+https://ol.sladoire.dev)` : `APP_USER_AGENT` / `outboundHeaders()` (`backend/src/config/outbound-http.ts`) ; 365scores via `scores365Headers()` (+ `Accept`, `Accept-Language`).
- ❌ Jamais de `Referer`, `Origin`, `X-Domain` ni de User-Agent de navigateur : `config/outbound-http.spec.ts` (garde sur les sources + appels déroulés) et `scores365-host.spec.ts` le refusent. Un 403 d'une source n'est pas une raison de les remettre.
- ✅ Mention exigée par football-data (§ 7.1 de ses conditions) : « Football data provided by the Football-Data.org API », composant `FootballDataAttribution` (`frontend/src/components/football-data-attribution.tsx`), sur l'accueil, le calendrier, la carte, la page d'un match de Ligue 1 à venir et À propos (`routes/attribution-football-data-L267.test.tsx`). Une nouvelle page qui affiche une donnée de football-data la reprend.

### Live-match
- Cron `*/30 * * * * *` (30 sec) sur `live-match.service`, mais **diff signature** avant emit SSE — pas de spam.
- Frontend : `useLiveMatchStats` poll **30s seulement en live**, jamais sinon.
- Détection match courant = live > recent <2h > upcoming <24h.
- **Fenêtre coup d'envoi** (fix 2026-09-19) : dans [kickoff − 15 min ; + 3 h] on ne lâche JAMAIS le match connu, même si les 3 listes 365scores sont vides (le match sort de `fixtures` quelques secondes avant de passer en `statusGroup 3`) ou si un appel échoue (timeout 8 s sur 50 Ko, HTTP non-2xx). Échec → retry 60 s, jamais le throttle 15 min. Specs `live-match.service.spec.ts`.
- **Momentum** = dérivé du play-by-play 365scores (`game.playByPlay.feedURL`, `pbpgenerator.365scores.com`, TTL 10 s), pondéré/lissé dans `live-match.momentum.ts`. Le widget SportRadar (`momentumsrcf.365scores.com`) est un iframe dont le feed est verrouillé ; Sofascore 403. Ne pas rechercher une autre source sans nouvelle info.
- **Attribution du momentum (L274)** : le play-by-play écrit le club à sa façon (« Lillestrøm ») quand le détail du match en donne un autre (« Lillestrom ») : toutes les actions de Lillestrøm étaient ignorées en silence (graphe d'une seule couleur, Lyon – Lillestrøm 26-11). `normaliseTeamName` (sans accents ni lettres liées, ø → o, æ → ae…) compare au nom ET au nom long (`longName`) ; un nom contenu dans l'autre ne compte que si un seul côté correspond. `countMomentumActions` → `momentumActions` { home, away, unattributed } dans la réponse ; une action sans équipe est journalisée et l'écran en donne la part dans l'en-tête du bloc, forme courte « 27/71 actions (38 %) sans équipe » et phrase entière en texte accessible (`lib/momentum-note.ts`), jamais une moitié vide ; pas sous le graphe : une ligne de plus y faisait passer la rangée Statistiques | Momentum à 781,5 px pour 768 à 1366 × 768 (R16, cas mesuré dans `tests-navigateur/match-geometrie.test.ts`). Le texte sous le graphe dit que c'est une reconstruction et énumère ce qu'elle compte, sans possession ni occasions franches (absentes du flux ; `chartEvents` porte un xG par tir, non utilisé) : la liste vient de la table des poids du backend (`MOMENTUM_WEIGHTS` → `MOMENTUM_BASIS`, champ `momentumBasis` de la réponse : tirs, corners, coups francs obtenus, hors-jeu), jamais écrite à part côté écran ; le test du graphe relit une réponse réelle du service (`frontend/src/test/fixtures/live-match-lyon-lillestrom-L274.json`, vérifiée égale au service par `live-match.service.momentum-L274.spec.ts`, régénérée avec `ECRIRE_REPONSE_L274=1`). Coup franc obtenu : 1 dans le camp adverse ou sur une aile, 0,3 dans son camp — le flux est en anglais (« attacking half », « wing », « defensive half »), l'ancien en français (« adverse », « aile »), les deux sont lus. Play-by-play réels de 4 matchs dans `test/fixtures/365_pbp_*_L274.json`.
- **Joueurs en vue (L266)** : `game.topPerformers` ne dit ni unité ni période, et ses `type` changent de sens au coup d'envoi (avant : saison de la compétition, 38 = tacles gagnés EN MOYENNE PAR MATCH, « Tackles 0.1 » de Niakhate ; ensuite : chiffres du match, 20 = tacles, 4 = tirs cadrés). Libellés établis par type dans `live-match/top-performer-stats.ts` (preuve : `/web/stats/?competitions=35`, fixtures `*_L266.json`) ; un type absent des tables n'est pas affiché.
- `game.members[]` peut contenir des pseudo-membres sans `id` (`'But annulé'`) : `id` optionnel dans le schéma, les consommateurs filtrent.

### Brackets de coupe
- CdF affichée dès stageNum **6** (1/4), EL dès stageNum **3** (1/8). En dessous, ne pas afficher (round trop tôt).
- Continue d'afficher après élimination OL — c'est voulu (suivi du parcours adverse).

### Carte Ligue 1 — markers bicolores
- Marker = cercle moitié gauche (leg aller) + moitié droite (leg retour). Couleur de chaque moitié = résultat OL côté concerné (V = bleu OL éclairci `WIN_BLUE` / D = rouge / N = gris) **plus un motif blanc** (V aplat, N barre, D oblique, pas joué point) : jamais la couleur seule (L191, `lib/ligue1-map-colors.ts`, contrastes testés).
- **Cadrage (L192)** : `lib/ligue1-map-view.ts` — la carte s'ouvre sur la France (`fitBounds` des 18 clubs, marge 36 px, `zoomSnap` 0,25 : zoom 6 à 1440×900, mesuré ; le `pad(0.18)` donnait 5), la molette ne zoome pas (`scrollWheelZoom` faux : la page défile), bouton « Recentrer » (`frameFrance(map, true)`), zoom arrière borné au cadrage (zoom minimal reposé à chaque `resize`, depuis le zoom du cadrage calculé : aussi après Recentrer depuis un zoom avant), zoom avant à 14, glisser borné à la **vue d'ouverture**, une borne par axe (`maxBounds` = centre du cadrage ± la demi-carte, +1 px de jeu, recalculé à chaque cadrage ; au zoom minimal la carte ne bouge pas, plus près la vue ne la quitte pas : jamais au-delà de la vue de départ, Recentrer y ramène ; pas de garantie de clubs à l'écran, les coins de cette vue sont la mer). L'ancienne marge symétrique « France + 1,5 de chaque côté » (4× la France) laissait la vue partir en Pologne sur téléphone : ne pas la rétablir. `L195` lève la limite le temps d'une fiche (`liftMaxBounds` / `restoreMaxBounds`, qui remettent la limite COURANTE, pas une constante). Un `resize` passe par `followResize` : au zoom minimal le cadrage suit, plus près seuls le zoom minimal et la limite suivent (le zoom et le déplacement de l'utilisateur restent). Le bouton « Recentrer » est un `L.Control` `bottomleft` (portail React) : il suit les boutons de zoom dans l'ordre de tabulation (WCAG 2.4.3), avant les liens d'attribution. Le zoom minimal se pose APRÈS le `fitBounds` : avant, le zoom animé qui s'ensuit défait le cadrage (jsdom n'anime pas : mesure dans Chromium, `tests-navigateur/carte-cadrage.test.ts`, qui compte les marqueurs visibles après des glissers dans les 4 directions, à 1440, 390 et 320 px, et mesure `window.scrollY` pour la molette). Les tests Chromium de la carte servent `/api/season-matches` en 200 (liste vide) : depuis L194 un 503 affiche l'écran d'erreur, pas la carte.
- Source = full-season history 365scores (pas seulement les matchs joués).
- **Chargement et erreur (L194)** : tant que `/api/season-matches` n'a pas répondu (`data` indéfinie), `Ligue1Map` ne rend ni carte ni légende mais « Chargement de la carte… » (`role=status`) ou, en erreur, un message + « Réessayer » (`RetryMessage`) ; jamais de marqueurs « Pas encore joué » ni de bulle « Pas de match OL recensé » faute de données. Une liste vide chargée affiche la carte ; un rafraîchissement en échec ne la retire pas.
- **Zone cliquable et couples proches (L193)** : chaque club a une zone cliquable d'au moins 24 × 24 px (`HIT_SIZE_PX`, WCAG 2.5.8) que ne recouvre aucune autre, à tout zoom, à 1440, 390 comme 320 px (L197) ; depuis L272 (D-2, « je plissais les yeux ») le cercle dessiné fait 22 px (`CLUB_MARKER_PX`, 26 pour l'OL, `OL_MARKER_PX`) et la zone suit la place laissée par les voisins au zoom courant, de 24 à 44 px (`hitSizesAtZoom` : écart au plus proche voisin, arrondi au pair ; 44 px pour 12 clubs sur 18 à l'ouverture à 1440, 4 à 390, tous dès le zoom 10). 44 px partout dès l'ouverture demanderait d'écarter des clubs de 47 px (390) à 115 px (320) de leur stade : non retenu. La légende dessine ses pastilles avec les fonctions des marqueurs (`clubMarkerSvg`, `olMarkerHtml`), à leur taille (`ligue1-map-legend.test.tsx`, `tests-navigateur/carte-marqueurs-L272.test.ts`). Les 15 clubs trop proches à l'ouverture sont écartés de 4 à 19 px, dans un sens fixe (table `NUDGES_PX`, calculée par relaxation pour que les zones restent disjointes du zoom d'ouverture à 320 px — zoom 4, le plus bas — au zoom maximal ; l'OL ne bouge jamais ; à 320 px Le Havre/Le Mans, Lens/PSG, Paris FC/Auxerre, Rennes/Lorient se recouvraient, L197 ; si les coordonnées des clubs changent, recalculer la table), **en pixels d'écran et jamais en mètres** (`markerNudge`, `lib/ligue1-map-hit.ts`) ; le popup s'ouvre au-dessus du cercle décalé. Le cadrage d'ouverture tient compte du décalage (`drawnBounds`, `lib/ligue1-map-view.ts`) : ne pas recréer de décalage Paris en mètres ni en `+20px`, cela casserait l'écart des zones et les marges égales. Le bouton « Recentrer » est en bas à gauche, contrôle `bottomleft` (en haut il recouvrait Brest à 390 px). Tests : `lib/ligue1-map-hit.test.ts`, et dans Chromium `tests-navigateur/carte-zones-cliquables.test.ts`.
- **Fiche du club (L195)** : `role=dialog` nommé par le club, focus dans la fiche à l'ouverture, Échap ou × → focus rendu au marqueur du club de la fiche (`ouvrirFiche` pour l'ouverture ; `FicheClavier` pose UN écouteur `keydown`/`click` en capture sur le conteneur de la carte, jamais un par ouverture : Échap vaut où que soit le focus dans la carte, Espace sur le × aussi ; × nommé « Fermer la fiche »). **La légende est sous la carte à toute largeur, jamais posée dessus** : le recalage de la fiche (44/6 px) n'évite que les boutons de zoom, une légende flottante cachait le × et l'en-tête (1440 : Strasbourg ; 768 : six clubs). Largeur en `cqw` de la carte (`.ligue1-popup-content`, `.ligue1-map` conteneur), jamais en `vw` : la marge de page varie ; recalage 44/6 px ; `maxBounds` levés le temps de la fiche (sinon un club du nord, fiche haute, déborde au-dessus de la carte) et remis à la fermeture. « Domicile » / « Extérieur » en toutes lettres. Tests Chromium : `tests-navigateur/carte-popup-320.test.ts` (320, 390, 1440) et `tests-navigateur/carte-popup-recouvrement.test.ts` (1440, 1024, 768, 390, 320 ; 18 fiches ouvertes au clavier ; × et en-tête entiers et recouverts par aucun contrôle ni la légende, mesure par la géométrie, `elementFromPoint` seulement en filet car il traverse `pointer-events:none`) ; jsdom : `components/ligue1-map.popup-L195.test.tsx`, `ligue1-map-legend.test.tsx`.
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

Le reste à faire vit dans `.cadence/raf.yaml`, tenu par `raf`
([cadence](https://github.com/Sylad/cadence)) : chaque commit cite son lot dans le
message (`fix(L4): …`, `L2/t1`), `raf now` dit la suite, `raf check` repère les
écarts. Début et fin de session : skills `/cadence:session-start` et
`/cadence:session-close`.

**Vagues `cadence orchestrate` (L220)** : `cadence.yaml` déclare le précheck sur Sonnet
(`precheck: true`), la porte de tests lancée après chaque implement/fix (`orchestrate.test` :
`npm test` du backend jest puis `npm test` du frontend vitest) et le build (`orchestrate.build` :
`nest build` puis `npm run build` du frontend). Sont exclus de la porte : le e2e backend hermétique
(`npm run test:e2e`, lent, expirerait sous charge), les tests Chromium (`npm run test:navigateur`) et
les acceptations rouges (`accept:` seul). Si l'on ajoute des tests ou un build, mettre à jour ces
commandes et les chiffres du commentaire de `cadence.yaml`.

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
