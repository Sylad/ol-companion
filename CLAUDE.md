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
- `GET /api/fixtures` — Ligue 1 selon football-data : matchs joués + toute la fin de saison (`limit=100`, cache 1h, refresh 30 min) ; dit au calendrier si l'heure d'une journée est fixée
- `GET /api/season-matches` — toute la saison, toutes compétitions suivies (365scores, cache 30 min) ; sert la page Calendrier, le « dernier résultat » et le « prochain rendez-vous » du tableau de bord (L45, toutes compétitions), la carte, les statistiques d'équipe et de joueurs
- `GET /api/france` — équipe de France A (L113) : `nextMatch`, 5 derniers `results`, `squad`, en un appel (365scores `competitorId` 5061 ; copie 10 min, dernière réponse connue si 365scores échoue, sinon 503) ; `nextMatch.timeConfirmed` = faux au-delà de 14 jours (365scores seul, pas de football-data) ; même règle (`config/kickoff-horizon.ts`) pour `timeConfirmed` de `GET /api/live-match/{gameId}/stats`, lu par l'en-tête de la page de match des Bleus (L168) ; pour un match de **Ligue 1 à venir**, football-data qui parle de la journée décide (`footballDataSaysKickoff`, `kickoff-confirmation.ts`, L170), les 14 jours ne servent qu'en son silence ; un match à venir d'une **autre compétition suivie** (`TRACKED_COMPETITIONS`) a `timeConfirmed` vrai, comme dans `/api/season-matches` (L172) : seuls les Bleus et les amicaux gardent les 14 jours
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

Headers obligatoires (sinon 403) : `X-Domain: fr`, `Referer: https://www.365scores.com/fr/football/league/ligue-1-35`, `User-Agent: Mozilla/5.0`.

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
- **Limite de débit par visiteur** : `ClientIpThrottlerGuard` (APP_GUARD) identifie le client par l'en-tête `CF-Connecting-IP`, que le nginx frontend pose lui-même (map + `proxy_set_header`, jamais la valeur du client), repli `req.ip` ; une IPv6 est suivie par son préfixe /64 (L19, `clientTracker`), une IPv4 mappée redevient IPv4. Ne JAMAIS activer `trust proxy` (X-Forwarded-For forgeable). Tester la conf nginx avec `DOCKER_API_VERSION=1.44 scripts/test-nginx-conf.sh`. L'Ingress LAN `ol.dark-blue.lan` qui envoie `/api` directement au backend contourne ce nginx.
- **Seaux de la limite** (L32) : `backend/src/config/throttlers.ts` — défaut 10/s + 60/min par visiteur ; `/api/wiki-image` (cache serveur, un appel par logo) a le sien, 40/s + 300/min (`@Throttle`). Mesure du 03-10 : un premier chargement de /standings = 26 appels `/api` en 250 ms dont ~20 logos, 12 refusés en 429. Le classement prend en plus ses écussons au CDN 365scores (`TeamLogo src=seasonTeamLogoUrl`), sans appel wiki-image. Ne pas ajouter d'appel `/api` par ligne d'une liste.

## Stack précise

- React 18.3 · Vite 5.4 · TanStack Router 1.78 · TanStack Query 5.59 · Recharts 2.13 · Tailwind 3.4 · Lucide
- NestJS 11 (aucun SDK LLM : l'app n'appelle jamais Claude, SDK Anthropic retiré en L17)
- Docker multi-stage (`node:20-alpine` → `nginx:alpine`)

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
- ✅ **Current matchday robuste aux fixtures décalées** (fix 2026-05-10) : `currentMatchday` = MODE des `played` counts (pas le max), `roundComplete` = `≥ 75% des équipes au matchday courant` (pas `min === max`). Une équipe rescheduled-ahead (cas Nantes 2026-05-10 : 17 équipes à MD32, Nantes à MD33) ne fige plus la mise à jour de `season-rankings.json`. L'ancrage de l'entrée OL dans `season-rankings.json` est désormais sur `OL.played` directement, pas sur le `currentMatchday` de la ligue. Voir helpers `computeCurrentMatchday()` et `isRoundComplete()` testés (11 specs).
- ✅ Journées historiques pré-2026-04-28 peuvent être incorrectes — dette acceptée par user, pas de reconstruction.

### Calendrier — une source par match, jamais d'heure inventée (L39)
- ✅ La page `/fixtures` lit **`/api/season-matches`** (365scores) : Ligue 1, Ligue des champions (qualifications comprises), Ligue Europa, Coupe de France, dans l'ordre des dates. Elle ne lit plus `/api/fixtures` ; le dernier résultat (L131, toutes compétitions) et le prochain rendez-vous (L45) du tableau de bord lisent aussi `/api/season-matches`.
- ✅ **Une seule liste des compétitions suivies** : `TRACKED_COMPETITIONS` (`season-matches.service.ts`, identifiant 365scores → code + nom). Tout ce qui lit `getMatches()` en dépend : calendrier, carte (Ligue 1 seule, filtre `L1`), statistiques d'équipe et de joueurs. Une compétition de la saison absente de la liste est journalisée (`compétition non suivie`) à chaque rafraîchissement — les 4 qualifications de Ligue des champions d'août 2026 (`332`) avaient été écartées en silence. Les matchs amicaux (`321`) ne sont pas suivis. La page Coupes a sa propre liste (`cups.service.ts`, `COMP_NAMES` et `COMP_ORDER` : `37`, `573` et `332`, les qualifications de Ligue des champions, L174 ; le tableau à élimination n'existe que pour `37` et `573`).
- ✅ **Match sans journée** (`roundNum` absent : qualifications, tours à élimination) : `matchday: null` et `round` = tour + manche, lus dans `stageName` et `legNum` (« 3e tour de qualification · aller », « Barrages · retour »). Un tour sans nom français connu n'est pas affiché. Le score est celui du match, pas le cumul aller-retour : le cumul calculé à partir de l'aller est dans `aggregateScore` (L51), `null` hors manche retour jouée.
- ✅ **Toute la saison** : `SeasonMatchesService` demande `/web/games/results/` (matchs joués), puis `/web/games/fixtures/` (≈ 27 matchs à venir d'un coup) et suit `paging.nextPage` jusqu'à l'enveloppe sans `games` (plafond `FORWARD_PAGES`, journalisé s'il est atteint). Avant, 8 pages de 3 à 5 matchs s'arrêtaient à J28. La journée vient de `roundNum`.
- ✅ **`timeConfirmed`** (sur les deux endpoints) : 365scores ne signale PAS une heure non fixée — il met une heure de remplissage (17:00 UTC le samedi) que rien ne distingue d'une vraie. football-data le dit : statut `SCHEDULED` + `utcDate` à 00:00:00Z (contre `TIMED`). Règle (`season-matches/kickoff-confirmation.ts`, spec directe `kickoff-confirmation.spec.ts`) pour un match de Ligue 1 à venir : football-data **parle** de la même journée → il décide (`TIMED` = fixée **si son instant est celui de 365scores** — sinon l'heure de 365scores est un remplissage ou une valeur périmée, « à confirmer » (L46, `footballDataSaysKickoff(matchday, footballData, date)`, aussi pour la réponse stats du direct) ; `SCHEDULED` à minuit UTC = à confirmer) ; football-data n'en dit **rien** (clé absente, pas de cache, appel en échec, journée au-delà de sa réponse, match sans journée) → l'heure de 365scores est affichée si le match est dans les **14 prochains jours**, « à confirmer » au-delà. Match joué ou en cours, et autres compétitions : heure de 365scores tenue pour fixée, faute de signal.
- ✅ **Un appel football-data refusé ne retire rien** (`FixturesService`) : `fetchMatches` rend `null` sur un 429, une erreur réseau ou une charge illisible (jamais `[]`, qui veut dire « aucun match ») ; la partie en échec (matchs joués ou à venir) est reprise du dernier cache, la réponse fraîche l'emporte sur un match gardé, et si les deux appels échouent le cache n'est pas réécrit. **Borne d'âge (L46)** : le cache note le dernier succès de chaque partie (`finishedAt`, `upcomingAt` ; un cache plus ancien se date par `ts`) ; une partie gardée plus de 24 h est abandonnée (le calendrier retombe sur la règle des 14 jours) avec une ligne `error` au journal, et si les deux appels échouent depuis plus de 24 h le cache est servi tel quel mais l'échec durable est journalisé en `error`. Avant, un 429 sur les matchs à venir réécrivait le cache avec les seuls matchs joués et le match du lendemain passait en « Horaire à confirmer ».
- ✅ **Jour non fixé (L47)** : `timeConfirmed: false` vaut aussi pour le jour (la date est un remplissage, un samedi pour 18 lignes sur 21). `lib/kickoff.ts` `unconfirmedDay()` : vendredi/samedi/dimanche → « Week-end du <samedi> », autre jour → « Date (et horaire) à confirmer » ; calendrier, carte Prochain et tableau de bord. Le tableau de bord n'affiche alors ni compte à rebours ni « Jour de match » : statut « À confirmer ».
- ✅ Le champ est **dérivé à chaque lecture** (`FixturesService.peekFixtures()`, sans appel réseau), jamais écrit dans les caches JSON. Côté écran, une seule règle : `lib/kickoff.ts` (« Horaire à confirmer »).
- ✅ Écussons du calendrier et du dernier résultat : CDN 365scores par identifiant (`seasonTeamLogoUrl`, `TeamLogo src=`), pas `/api/wiki-image` — une trentaine de clubs d'un coup dépassait la limite de débit, et la recherche par nom rendait une photo de ville pour des clubs européens.
- ❌ Ne pas déduire « heure non fixée » de l'heure elle-même : 17:00 UTC est aussi une vraie heure de coup d'envoi (19:00 l'été).

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
- Marker = cercle moitié gauche (leg aller) + moitié droite (leg retour). Couleur de chaque moitié = résultat OL côté concerné (V = bleu OL éclairci `WIN_BLUE` / D = rouge / N = gris) **plus un motif blanc** (V aplat, N barre, D oblique, pas joué point) : jamais la couleur seule (L191, `lib/ligue1-map-colors.ts`, contrastes testés).
- **Cadrage (L192)** : `lib/ligue1-map-view.ts` — la carte s'ouvre sur la France (`fitBounds` des 18 clubs, marge 36 px, `zoomSnap` 0,25 : zoom 6 à 1440×900, mesuré ; le `pad(0.18)` donnait 5), la molette ne zoome pas (`scrollWheelZoom` faux : la page défile), bouton « Recentrer » (`frameFrance(map, true)`), zoom arrière borné au cadrage (zoom minimal reposé à chaque `resize`, depuis le zoom du cadrage calculé : aussi après Recentrer depuis un zoom avant), zoom avant à 14, glisser borné à la **vue d'ouverture**, une borne par axe (`maxBounds` = centre du cadrage ± la demi-carte, +1 px de jeu, recalculé à chaque cadrage ; au zoom minimal la carte ne bouge pas, plus près la vue ne la quitte pas : jamais au-delà de la vue de départ, Recentrer y ramène ; pas de garantie de clubs à l'écran, les coins de cette vue sont la mer). L'ancienne marge symétrique « France + 1,5 de chaque côté » (4× la France) laissait la vue partir en Pologne sur téléphone : ne pas la rétablir. `L195` lève la limite le temps d'une fiche (`liftMaxBounds` / `restoreMaxBounds`, qui remettent la limite COURANTE, pas une constante). Un `resize` passe par `followResize` : au zoom minimal le cadrage suit, plus près seuls le zoom minimal et la limite suivent (le zoom et le déplacement de l'utilisateur restent). Le bouton « Recentrer » est un `L.Control` `bottomleft` (portail React) : il suit les boutons de zoom dans l'ordre de tabulation (WCAG 2.4.3), avant les liens d'attribution. Le zoom minimal se pose APRÈS le `fitBounds` : avant, le zoom animé qui s'ensuit défait le cadrage (jsdom n'anime pas : mesure dans Chromium, `tests-navigateur/carte-cadrage.test.ts`, qui compte les marqueurs visibles après des glissers dans les 4 directions, à 1440, 390 et 320 px, et mesure `window.scrollY` pour la molette). Les tests Chromium de la carte servent `/api/season-matches` en 200 (liste vide) : depuis L194 un 503 affiche l'écran d'erreur, pas la carte.
- Source = full-season history 365scores (pas seulement les matchs joués).
- **Chargement et erreur (L194)** : tant que `/api/season-matches` n'a pas répondu (`data` indéfinie), `Ligue1Map` ne rend ni carte ni légende mais « Chargement de la carte… » (`role=status`) ou, en erreur, un message + « Réessayer » (`RetryMessage`) ; jamais de marqueurs « Pas encore joué » ni de bulle « Pas de match OL recensé » faute de données. Une liste vide chargée affiche la carte ; un rafraîchissement en échec ne la retire pas.
- **Zone cliquable et couples proches (L193)** : chaque club a une zone cliquable de 24 × 24 px (`HIT_SIZE_PX`, WCAG 2.5.8) que ne recouvre aucune autre, à tout zoom, à 1440, 390 comme 320 px (L197) ; le cercle dessiné (14 px, 18 pour l'OL) reste au centre. Les 15 clubs trop proches à l'ouverture sont écartés de 4 à 19 px, dans un sens fixe (table `NUDGES_PX`, calculée par relaxation pour que les zones restent disjointes du zoom d'ouverture à 320 px — zoom 4, le plus bas — au zoom maximal ; l'OL ne bouge jamais ; à 320 px Le Havre/Le Mans, Lens/PSG, Paris FC/Auxerre, Rennes/Lorient se recouvraient, L197 ; si les coordonnées des clubs changent, recalculer la table), **en pixels d'écran et jamais en mètres** (`markerNudge`, `lib/ligue1-map-hit.ts`) ; le popup s'ouvre au-dessus du cercle décalé. Le cadrage d'ouverture tient compte du décalage (`drawnBounds`, `lib/ligue1-map-view.ts`) : ne pas recréer de décalage Paris en mètres ni en `+20px`, cela casserait l'écart des zones et les marges égales. Le bouton « Recentrer » est en bas à gauche, contrôle `bottomleft` (en haut il recouvrait Brest à 390 px). Tests : `lib/ligue1-map-hit.test.ts`, et dans Chromium `tests-navigateur/carte-zones-cliquables.test.ts`.
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
