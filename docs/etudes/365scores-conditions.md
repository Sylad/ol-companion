# 365scores : conditions d'utilisation, en-têtes envoyés, couverture (L263)

Étude sans code, 2026-11-20. Lot P0 de `docs/etudes/idees-supporter.md` (L237). Un verdict sourcé par question.

## Verdicts en bref

| # | Question | Verdict |
|---|---|---|
| 1 | Que disent les conditions de 365scores sur l'usage automatisé, l'API et la réutilisation ? | Aucune clause ne parle d'accès automatisé, de robots ni d'API. En revanche, la réutilisation est **interdite sans accord écrit** : licence « personnelle, non commerciale » (§ 3.3), interdiction de « fournir des services à des tiers » (§ 4.4) et de tout « usage non personnel » (§ 5.1), données comprises dans le « Contenu » protégé (§ 7.1, § 7.3). **Un site public qui sert à tous ses visiteurs le classement, les compos et les stats de 365scores n'entre pas dans ce que ces conditions permettent.** |
| 2 | Les en-têtes envoyés par l'app sont-ils un contournement anti-robot ? | **Aujourd'hui, ils ne contournent rien** : le 20-11, les six familles d'appels de l'app répondent 200 sans aucun de ces en-têtes (requêtes honnêtes, § 2.3). Le « 403 sans eux » vient du premier commit (2026-05-01), mesuré sur l'ancien hôte `data.365scores.com`, et n'a jamais été remesuré. Mais ils **se font passer pour le site de 365scores** (Chrome 124, `Referer` et `Origin` de www.365scores.com), et le code dit qu'ils sont là pour passer l'« anti-scraping » : c'est le geste que la règle exclut. **À retirer** (en-tête honnête qui nomme l'app), et ne jamais les remettre si 365scores se met à refuser. |
| 3a | OL Lyonnes est-elle couverte ? | **Oui.** `Lyon (W)`, `competitorId` **19622** : Première Ligue (365scores `6083`, « Féminines ») et Ligue des champions féminine (`6225`), résultats, matchs à venir, classement, compos et stats (15 matchs sur 16 de la saison avec `hasLineups`). |
| 3b | Le champ diffuseur TV est-il exploitable ? | **Non, pas comme source fiable.** Le champ `tvNetworks` existe (« CANAL+ Foot » sur Anderlecht – Lyon) mais il est absent de Lille – Lyon la veille du match, et faux (`hasTVNetworks`) sur les 22 matchs du classement conservé. Idée 7 : table tenue à la main, comme le proposait L237. |
| 3c | Que contiennent `previousMeetings`, `recentMatches`, `missingPlayers` ? | Dans les fixtures conservées, **seulement les drapeaux** `has…` (vrais partout). Le contenu est ailleurs : absents dans `lineups.members` (statut 3, avec `injury`), **déjà lus par l'app** (`injured`) ; face-à-face et forme dans un autre appel, `/web/games/h2h/` (15 confrontations depuis 2020, 15 derniers matchs par équipe). |
| 4 | Sources de remplacement gratuites et autorisées ? | **football-data.org** pour la Ligue 1 et la Ligue des champions (offre gratuite, attribution obligatoire : **l'app ne l'affiche pas**) ; **openfootball** (CC0) pour l'historique seulement (Ligue 1 2026-27 arrêtée au 20-09) ; **Wikidata** (CC0) et **Wikipédia** (CC BY-SA) pour l'histoire. **Rien de gratuit et autorisé ne couvre** la Coupe de France, la Ligue Europa, OL Lyonnes, les compos, les absents ni les stats de match. Remplacer 365scores en entier n'est pas possible à coût nul : c'est un choix pour Sylvain (§ 5). |

## 1. Méthode

- **Conditions lues dans Chromium** (Playwright, page rendue, sans compte, sans accepter les cookies) le 2026-11-20 à 13 h 15. `https://www.365scores.info/pages/terms` n'affiche que le cadre du site : le texte est un Google Doc intégré dans une iframe, `https://docs.google.com/document/d/e/2PACX-1vTdJhTVVDaozuy-6wbD6Ln9ixQmZfG9uD2zUxIdTOaAGOZrnNQ9kfPEwtj5ZdWMx5K6i4LKJmIEUkxn/pub`, titré « 365SCORES TERMS AND CONDITIONS (Public!!!) », **« Last updated on August 18, 2024 »**. Texte relevé hors dépôt : `ol-companion-…captures/L263_terms_clean.txt`.
- **En-têtes** : lus dans `backend/src/config/scores365-http.ts` et leur historique git.
- **Requêtes honnêtes seulement** : `curl` avec son `User-Agent` par défaut ou `ol-companion-etude-L263/1.0 (curl)`, **sans** `Referer`, `Origin`, `X-Domain` ni User-Agent de navigateur. Une seule requête par appel, soit une vingtaine en tout. Aucun en-tête imitant un navigateur n'a été envoyé, aucune protection n'a été testée ni contournée. Les pages de 365scores ont été ouvertes dans Chromium comme le ferait un visiteur ; la recherche « lyon » (§ 3.1) a été faite par la page elle-même, avec son origine.
- **Fixtures** : `backend/test/fixtures/365_*.json`, conservées par les lots précédents.
- **Non vérifié** : le flux play-by-play `pbpgenerator.365scores.com` et le CDN `imagecache.365scores.com` (pas de match en cours, et rien à mesurer sur les logos) ; les conditions propres aux widgets de 365scores (§ 5) ; l'avis d'un juriste.

## 2. Les en-têtes envoyés par l'app

### 2.1 Ce que le code envoie

Tous les appels à `webws.365scores.com` passent par `scores365Headers()` (`backend/src/config/scores365-http.ts:32-41`) :

| En-tête | Valeur | Ce qu'il dit au serveur |
|---|---|---|
| `User-Agent` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36` | « Je suis Chrome 124 sous Windows » (faux : c'est Node) |
| `Accept` | `application/json` | neutre |
| `Accept-Language` | `fr-FR,fr;q=0.9` | neutre |
| `X-Domain` | `fr` | en-tête propre au site de 365scores |
| `Referer` | `https://www.365scores.com/fr/football` ou `…/team/lyon-465` ou `…/league/ligue-1-35` (`SCORES365_REFERER`) | « Je viens de cette page de 365scores » (faux) |
| `Origin` | `https://www.365scores.com` | « Je suis le script de www.365scores.com » (faux) |

Le commentaire de tête le dit sans détour : « 365scores anti-scraping requires browser-like headers (otherwise 403) » (`scores365-http.ts:2`). Le même motif est écrit dans `CLAUDE.md` (« Headers 365scores obligatoires — Sinon HTTP 403 ») et dans `scores365-host.spec.ts:184` (« En-têtes anti-scraping inchangés (sinon 403) »).

### 2.2 D'où vient le « 403 sans eux »

- Le premier commit (`ceccfe2`, 2026-05-01) contient déjà la phrase « Headers obligatoires (sinon 403) » et les trois en-têtes `X-Domain`, `Referer`, `User-Agent`. Aucune mesure n'est conservée, ni le code d'erreur, ni sa source (CloudFront, l'application, un pare-feu).
- L'hôte de l'époque, `data.365scores.com`, ne répond plus depuis le 2026-10-01 (`scores365-http.ts:15-17`, L33). L'app est passée à `webws.365scores.com` **sans remesurer** le besoin de ces en-têtes.

### 2.3 Ce que répond l'API aujourd'hui, sans ces en-têtes

Le 2026-11-20 vers 13 h 15, avec `User-Agent: ol-companion-etude-L263/1.0 (curl)` et rien d'autre :

| Appel (famille utilisée par l'app) | Réponse |
|---|---|
| `/web/games/results/?…&competitors=465&limit=10` | 200, 50 369 octets |
| `/web/games/fixtures/?…&competitors=465` | 200, 48 177 octets |
| `/web/standings/?…&competitions=35` | 200, 133 541 octets |
| `/web/game/?…&gameId=4735207&withLineups=true` | 200, 39 000 octets |
| `/web/squads/?langId=15&…&competitors=465` | 200, 29 337 octets |
| `/web/games/?…&onlyLiveGames=true&competitors=465` | 200, 104 octets (aucun match en cours) |

Même résultat avec le `User-Agent` par défaut de `curl` (`curl/x.y`), avec ou sans `X-Domain`. Les réponses viennent de CloudFront (`via: … cloudfront.net`, `x-cache: Miss/Hit from cloudfront`) devant un serveur `Kestrel`. **Aucun refus, aucun défi, aucun contrôle anti-robot n'a été rencontré.** `webws.365scores.com/robots.txt` répond 404 ; celui de `www.365scores.com` ne parle que des pages du site, pas de l'API.

### 2.4 Verdict au regard de la règle « aucun contournement anti-robot »

La règle, telle qu'appliquée dans ce dépôt : « des essais avec des en-têtes `Referer`/`Origin` imitant un navigateur ont été écartés : ils reviendraient à contourner un contrôle anti-robot » (`docs/etudes/sources-stats.md:32`, L236) ; « aucun en-tête imitant un navigateur n'a été envoyé » (`docs/etudes/idees-supporter.md:22`, L237).

- **Effet mesuré** : nul. Le 20-11, ces en-têtes ne font passer aucune barrière, puisqu'il n'y en a pas (§ 2.3). L'app n'est pas, ce jour-là, en train de forcer une protection.
- **Nature du geste** : c'est exactement ce que la règle désigne. L'app se présente comme Chrome et comme le script de www.365scores.com pour obtenir ce qu'un client qui se nomme n'aurait pas eu le 01-05 ; son propre code l'écrit (« anti-scraping requires browser-like headers »). Si 365scores remet un filtre, ces en-têtes le contourneront sans que personne ne le voie.
- **Verdict** : **contraire à la règle par son intention et par sa forme, sans effet aujourd'hui.** À corriger par un lot court : n'envoyer qu'un `User-Agent` qui nomme l'app (par exemple `ol-companion (+https://ol.sladoire.dev)`), `Accept` et `Accept-Language` ; retirer `Referer`, `Origin` et `X-Domain` ; réécrire le commentaire, la ligne de `CLAUDE.md` et `scores365-host.spec.ts:184`. Si un jour 365scores refuse ce client honnête, l'app affiche son erreur et l'on change de source : on ne remet pas les en-têtes. Ce lot ne règle pas le § 3 : un accès honnête reste soumis aux conditions.

## 3. Conditions d'utilisation de 365scores (mises à jour le 2024-08-18)

Citations exactes, texte anglais d'origine (aucune version française n'est servie : `/fr/pages/terms` intègre le même document).

### 3.1 Usage automatisé, robots, API

Le texte **ne contient aucune clause** sur l'accès automatisé, les robots, l'extraction de données ou une API (recherche de « scrap », « crawl », « robot », « spider », « API », « extract » : aucune occurrence ; « automat » n'apparaît qu'au § 12.2, à propos de la journalisation des visiteurs par 365scores). Aucune API n'y est offerte aux développeurs. La seule clause technique :

> 4.5. You must not copy, or make any alteration to, or access the software code of, the Platform or damage, interfere with, or disrupt the integrity, performance or use of the Services;

L'app n'accède pas au code de la plateforme ; elle lit des réponses JSON. Le rythme des appels (copies de 10 à 30 min, direct toutes les 30 s pendant un match) ne relève pas de « disrupt the integrity, performance ». Pas d'infraction mesurable à 4.5.

### 3.2 Réutilisation et usage pour des tiers

> 3.3. By installing any of the Applications, 365 Scores hereby grants you a limited, personal and non-exclusive license to install and use these Applications, for personal non-commercial purposes only […]

> 4.4. You must not use the Services to provide services to third parties;

> 5.1 The Services are not intended for your commercial use, or any other non-personal use. […]

> 7.1. Certain content and information provided on and through the Services, including, without limitation, 365 Scores' logo, trademark, graphics, design, information, text, images, data and other material displayed, available or present through the Applications (the "Content") are the copyrighted and/or trademarked work of 365 Scores solely or of 365 Scores' affiliates, and may not be used without express written permission from us, other than for attribution.

> 7.3. Except as expressly permitted in these Terms, you have no right to modify, edit, copy, reproduce, create derivative works of, reverse engineer, alter, enhance or in any way exploit any of the 365 Scores Content in any manner.

> 13.2. 365 Scores may at any time modify, suspend, or discontinue, temporarily or permanently, the Services or any part thereof, impose restrictions on them in its sole discretion, for a specific User or all users, without the need to give notice, including but not limited to block, cutoff, restrict, and cease services for any reason.

Droit applicable : anglais, tribunaux de Londres (§ 15).

### 3.3 Verdict

- L'app est **non commerciale** (ni publicité ni paiement) : elle échappe à la partie « commercial » de 5.1.
- Elle est **publique** (https://ol.sladoire.dev, tunnel Cloudflare) et sert à chaque visiteur des données de 365scores, reformatées (classement retrié, momentum calculé, stats agrégées) : c'est un « non-personal use » (5.1), un service rendu à des tiers (4.4), une copie et une œuvre dérivée du « Content », données comprises (7.1, 7.3), **sans l'accord écrit** que 7.1 exige. Les photos des joueurs et les logos chargés depuis le CDN de 365scores sont aussi du « Content ».
- Un usage strictement personnel (Sylvain seul, instance non exposée) serait défendable au titre de 3.3. L'usage actuel ne l'est pas.
- Le risque concret, à la lecture de 13.2 : un blocage sans préavis, à tout moment. L'app n'a pas de repli pour le classement, les compos, les coupes ni le direct.
- **Ce que l'étude ne dit pas** : la portée juridique de ces clauses (opposabilité à qui n'a rien installé, droit des bases de données) ; ce n'est pas un avis juridique.

**Sortie autorisée la plus simple** : demander l'accord écrit que prévoit 7.1 (contact : contact@365scores.com, § 10.2, ou la page « Publishers »). C'est une démarche de Sylvain.

## 4. Couverture, d'après les fixtures et les réponses de ce jour

### 4.1 OL Lyonnes

La recherche du site (`/web/search/?query=lyon`, faite par la page de 365scores ouverte dans Chromium) donne `Lyon (W)`, « Olympique Lyonnais (W) », `id` **19622**, `gender` 2, compétition principale **6083**. Puis, en requêtes honnêtes :

- **Résultats** (`competitors=19622`) : 16 matchs, de la finale de Ligue des champions féminine (2026-05-23, Barcelone 4 – 0 Lyon) à Arsenal 0 – 2 Lyon (2026-11-19) ; deux compétitions, « Féminines » (`6083`) et « UEFA Women's Champions League » (`6225`). `hasLineups` vrai sur 15 matchs, `hasStats` sur les 16.
- **À venir** : 14 matchs, dont Lyon – Strasbourg (2026-11-22, J10) et Lyon – Häcken (2026-12-16, Ligue des champions).
- **Classement** `competitions=6083` : « Féminines », Lyon 1re, 27 points en 9 matchs. **11 lignes** servies : à vérifier contre le nombre de clubs de la Première Ligue avant de s'en servir.
- Coupe de France féminine : aucun match dans les réponses (la compétition n'avait peut-être pas commencé pour l'OL) ; à remesurer en janvier.

**Verdict** : couverture suffisante pour l'idée 5 (calendrier, résultats, classement, compos), **mais elle hérite du § 3** : lire davantage 365scores aggrave l'écart avec les conditions. Aucune source gratuite et autorisée ne couvre la D1 féminine (§ 5).

### 4.2 Diffuseur TV

| Réponse | `hasTVNetworks` | `tvNetworks` |
|---|---|---|
| Fixture `365_game_anderlecht_lyon_ended_member_without_id.json` (Ligue Europa, terminé) | absent | `[{"id": 6898, "name": "CANAL+ Foot", "countryId": 5, …}]` |
| Fixtures `365_game_lyon_crystal_palace_upcoming_not_confirmed.json`, `365_game_lyon_rennes_live.json` | absent | absent |
| Fixture `365_standings_ligue1_live_lyon_2nd.json` (matchs suivants des 18 clubs) | `false` sur 22 matchs | — |
| `/web/game/?gameId=4735207` (Lille – Lyon du 2026-11-21), avec `userCountryId=75` puis `userCountryId=5` | absent | absent |
| `/web/games/h2h/?gameId=4735207` | présent | — |
| Matchs d'OL Lyonnes (16 joués) | vrai sur 3, tous de Ligue des champions (finale de mai, Chelsea, Arsenal) | non lu |

`countryId` 5 est la France chez 365scores (Ligue 1 : `competitionFilters` `id 35, countryId 5`). Le champ existe donc par pays, mais il manque pour un match de Ligue 1 la veille du coup d'envoi. **Verdict : inexploitable comme source** ; il ne servirait au mieux que de complément, et toujours sous le § 3. Idée 7 : table à la main ou rien.

### 4.3 Blocs d'avant-match

**Dans les fixtures conservées**, les trois réponses `/web/game/` ne portent que les drapeaux : `hasPreviousMeetings`, `hasRecentMatches` et `hasMissingPlayers` sont vrais dans les trois. **Aucune ne contient les blocs eux-mêmes.** Le contenu, d'après les fixtures et les appels faits par la page de match de 365scores (Lille – Lyon, ouverte dans Chromium : `/web/game/`, `/web/games/h2h/`, `/web/stats/preGame`, `/web/trends/`) :

- **Absents (`missingPlayers`)** : ce n'est pas un bloc séparé. Ce sont les membres de `lineups.members` au **statut 3** (« Missing »), avec un objet `injury` : `reason` (« Hamstring Injury », « Lésion du ménisque »), `expectedReturn` (« Late June 2027 », « A few weeks ») et `categoryId` 1. Fixtures : 2 à 4 absents par équipe (Crystal Palace – Lyon : 3 et 3, avec leur blessure). Lille – Lyon du 21-11 : 3 absents pour Lille, 6 pour Lyon. **L'app les lit déjà** : `lineup.service.ts` les range dans `injured` de `/api/lineup` (via `splitLineupRoles`), que la page joueur parcourt pour retrouver le dernier match d'un joueur (`player.$athleteId.tsx:265`) ; leur blessure n'est pas affichée. Aucune suspension n'a été vue dans les réponses lues : on ne sait pas comment 365scores la code.
- **Face-à-face (`previousMeetings`)** : `/web/games/h2h/?gameId=…`, champ `game.h2hGames`. Lille – Lyon : 15 matchs, du 2020-11-01 au 2026-02-01, Ligue 1 et Coupe de France, score de chaque match. Absent des fixtures.
- **Forme (`recentMatches`)** : même réponse, `homeCompetitor.recentGames` et `awayCompetitor.recentGames`, 15 matchs chacun, toutes compétitions. Absent des fixtures.
- Le reste de la page (« Meilleures tendances », « Buts attendus ») vient de `/web/trends/` et `/web/stats/preGame`, avec des cotes de paris (`addMainOdds=true`, `showOdds=true`) : non étudié.

**Verdict** : la fiche d'avant-match (idée 1) a ses données chez 365scores, en un appel de plus (`h2h`) ; les absents sont déjà là. Elle hérite du § 3.

## 5. Sources de remplacement gratuites et autorisées

| Source | Ce qu'elle couvre pour l'OL | Licence, lue où | Limites mesurées |
|---|---|---|---|
| **football-data.org** (déjà utilisée) | Offre gratuite, 12 compétitions dont **Ligue 1** et **Ligue des champions** : matchs, résultats, classements (pages `/pricing` et `/client/register`, lues le 20-11 : « Basic data (Fixtures, Results and League Tables) », « 10 API calls per minute », « Scores delayed ») | Conditions générales du 2018-06-01, lues dans Chromium (fenêtre « terms and conditions » de `/client/register`). **§ 7.1 : « You agree to include the following attribution to Football-Data in your app or website: "Football data provided by the Football-Data.org API" »** ; § 2.3 : une clé par application ; § 9.2 : les logos restent à leurs ayants droit ; § 9.1 : plus d'affichage des données après résiliation | Ni Coupe de France, ni D1 féminine dans toute la liste de couverture (`/coverage`, aucune occurrence) ; Ligue Europa et qualifications de Ligue des champions seulement dans l'offre payante « 30 competitions » ; pas de compos, d'absents ni de stats de match dans l'offre gratuite ; départage LFP incorrect (règle du projet). **L'app ne porte pas la mention d'attribution** (`frontend/src`, aucune occurrence de « Football-Data.org API ») : écart à corriger, indépendant de 365scores |
| **openfootball** `football.json` | Ligue 1 (`fr.1.json`) de 2010-11 à 2026-27, date, heure, score, journée | Licence **CC0-1.0** (API GitHub) et README : « dedicated to the public domain. Use as you please with no restrictions whatsoever » | Saison 2026-27 : 306 matchs, **45 avec un score, dernier le 2026-09-20**, dernier commit le 2026-09-22 : deux mois de retard. Bon pour l'historique et le face-à-face sur plusieurs saisons, pas pour la saison en cours. Ligue 1 seule (et Ligue 2) ; pas de coupe, pas de féminines. Le dépôt `openfootball/france` cité par L237 renvoie « Moved Permanently » sur l'API GitHub : non relu |
| **Wikidata** | Palmarès, saisons, joueurs, stades | CC0 (cité par L237, non relu ici) | Pas de direct ni de compos |
| **Wikipédia FR** (déjà utilisée) | Saisons, tableaux d'évolution du classement, OL Lyonnes | CC BY-SA 4.0 (cité par L237) | Mise à jour par des bénévoles, à heure inconnue |
| **Widgets de 365scores** (`publishers.365scores.com`) | Classement, compos, face-à-face, absents « Injuries & Suspensions », stats, en scripts à intégrer | **Conditions des widgets non lues** (page commerciale sans lien vers des conditions ; « Talk to us ») | Ils affichent de la publicité et des cotes de paris (« Betting Revenue opportunities », « Winning Odds ») : à peser contre la palette et le ton du site. C'est la seule voie offerte par 365scores à un site tiers |

**Verdict** : aucune combinaison gratuite et autorisée ne remplace 365scores en entier. Ce qu'on perdrait en le quittant : Coupe de France, Ligue Europa, OL Lyonnes, compos, absents, stats et momentum du direct, départage LFP, photos des joueurs. Ce qui se remplace : calendrier et résultats de Ligue 1 et de Ligue des champions (football-data, attribution à ajouter), historique (openfootball).

## 6. Ce que l'étude propose (à trancher par Sylvain)

Trois gestes indépendants, du moins coûteux au plus engageant :

1. **En-têtes honnêtes** (lot court, code) : § 2.4. Effet mesurable : les tests et la prod reçoivent toujours 200 avec un `User-Agent` qui nomme l'app ; mesure faite ici sur les six familles d'appels.
2. **Attribution football-data** (lot court, visible) : la mention exigée par son § 7.1, en pied de page ou dans « À propos ».
3. **Statut de 365scores** — décision de Sylvain, la seule irréversible ou engageante :
   - (a) écrire à 365scores pour l'accord prévu au § 7.1 (gratuit, réponse incertaine) ;
   - (b) garder l'usage actuel en connaissance de cause, sans étendre la lecture de 365scores (idées 1, 5, 13 en suspens) ;
   - (c) restreindre l'instance publique à ce que football-data et openfootball permettent, et garder 365scores pour l'instance locale de Sylvain (usage personnel, § 3.3) ;
   - (d) passer par les widgets officiels, après lecture de leurs conditions.

   Tant que ce choix n'est pas fait, les idées de L237 qui lisent davantage 365scores (fiche d'avant-match, OL Lyonnes, groupe lyonnais) restent bloquées par ce P0.
