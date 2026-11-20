# Idées pour le site, vu d'un supporter de l'OL

Lot L237, demande de Sylvain du 2026-11-01. Étude rédigée le 2026-11-20. **Aucun code écrit, aucun lot créé** : les idées retenues sont proposées comme lots à la fin, le lead décide.

## En bref

Le site couvre déjà bien le **pendant** (direct, momentum, faits, compositions, notifications dans l'onglet) et l'**après** immédiat (score, statistiques, classement). Les manques qui comptent le plus pour un supporter sont :

1. **avant le match** : la page d'un match à venir ne dit ni l'historique contre l'adversaire, ni sa forme, ni les absents, ni l'arbitre, ni où le regarder ;
2. **hors de l'onglet ouvert** : pas d'abonnement au calendrier, pas de notification quand le site est fermé ;
3. **tout ce qui n'est pas l'équipe première masculine en compétition** : OL Lyonnes, histoire du club, mercato.

Les trois premières idées du classement (fiche d'avant-match, abonnement au calendrier, « ce que ça change » après le match) utilisent des données que l'app reçoit **déjà**. Elles n'ajoutent aucune source.

Un point préalable : l'app dépend entièrement de 365scores, dont les conditions d'utilisation n'ont pas pu être lues (§ 4). Toute idée qui lit davantage 365scores en hérite ; le premier lot proposé (P0) lève ce doute.

> Précision du 2026-11-20 (L263) : conditions lues, verdicts dans [`365scores-conditions.md`](365scores-conditions.md). La réutilisation publique est interdite sans accord écrit (§ 7.1 de leurs conditions) ; les en-têtes imitant un navigateur ne passent aucune barrière aujourd'hui (200 sans eux) mais sont à retirer ; le choix sur 365scores revient à Sylvain.

## 1. Méthode, et ce qui n'a pas été mesuré

- **Le site actuel** : routes et modules lus dans le code (`frontend/src/router.tsx`, `backend/src/modules/`), lots livrés lus dans `.cadence/raf.yaml`, puis parcours de la prod le 2026-11-20 dans Chromium (Playwright, sans connexion ni envoi) : `/`, `/fixtures`, `/players`, `/news`, `/cups`, `/standings` à 390 px et la page du prochain match (Lille – Lyon, J11, `/match/4735207`) à 1440 px. Captures hors dépôt, dans `ol-companion-…captures/L237_*.png`.
- **Les données déjà reçues** : champs des réponses 365scores conservées dans `backend/test/fixtures/` (`365_game_*.json`).
- **Les références** : recherche web standard (fiches App Store, pages publiques, articles). Les fonctionnalités de L'Équipe, FotMob, Flashscore ou de l'appli officielle sont décrites d'après leurs pages publiques et des connaissances générales, **pas d'après un essai des applis** (aucun compte, aucune appli installée). Sofascore n'a pas été rouvert : il répond 403 à tout accès automatisé, comme l'a mesuré L236 (`docs/etudes/sources-stats.md`).
- **Les licences** : lues sur la page de la source quand c'était possible. Celles qui n'ont pas pu l'être sont signalées « non lue ». Aucun contournement : aucun en-tête imitant un navigateur n'a été envoyé pendant cette étude, aucune page derrière un contrôle anti-robot n'a été lue.
- **Ce que les supporters consultent** n'a pas été mesuré auprès de supporters (pas d'enquête, pas de statistiques d'audience : le site n'en collecte pas). Le classement « valeur » est un jugement argumenté, à corriger par Sylvain.

## 2. Ce que le site offre aujourd'hui (2026-11-20)

| Moment | Ce qu'on trouve | Où |
|---|---|---|
| Avant | Prochain rendez-vous toutes compétitions, compte à rebours, horaire « à confirmer » honnête, lieu | `/` (bandeau) |
| Avant | Calendrier complet de la saison (46 matchs), filtres par compétition et statut | `/fixtures` |
| Avant | Page du match à venir : date, heure, « Joueurs en vue » (chiffres de la saison), mini-classement, **compositions probables** des deux équipes | `/match/<id>` |
| Pendant | Direct : score, faits, momentum, statistiques, carte des tirs, composition, mini-classement en direct, bandeau du direct sur toutes les pages, notifications **tant que l'onglet est ouvert** | `/match`, `/`, barre latérale |
| Après | Dernier résultat, statistiques du match, notes des joueurs (365scores), tracker de classement journée par journée | `/`, `/match`, `/standings` |
| Saison | Classement LFP, statistiques d'équipe et de joueurs, fiches joueurs, coupes et tableaux, carte de la Ligue 1 avec bilan par adversaire | `/standings`, `/players`, `/cups`, `/map` |
| À côté | Actu (3 flux RSS) et liens vers 6 chaînes YouTube, Équipe de France, FC Noobz | `/news`, `/equipe-de-france`, `/fcnoobz` |

Observé sur la page du match à venir Lille – Lyon : rien sur les confrontations passées, la forme de Lille, les absents, l'arbitre, le stade (le bandeau de l'accueil, lui, dit « Stade Pierre-Mauroy »), la diffusion TV ni la météo. Écart repéré en passant, hors du sujet de l'étude : « Moussa Niakhate · Tacles : 0,1 » dans « Joueurs en vue » (une moyenne affichée comme un compte ?). C'est à vérifier dans un lot de correction, pas ici.

## 3. Ce que consultent les supporters, et ce qu'offrent les références

| Moment | Besoin du supporter | Références (pages publiques) | Le site |
|---|---|---|---|
| Avant (J-7 à J-1) | Quand, où, sur quelle chaîne ; l'ajouter à son agenda | Appli officielle (billetterie, l'appli « Stade » est le seul accès au Groupama Stadium [^appli]), L'Équipe (programme TV), FotMob et Flashscore (rappels, widgets) | Date et heure : oui. Chaîne : non. Agenda : non |
| Avant (J-2 à H-1) | Absents, suspendus, compo probable, forme des deux équipes, historique, arbitre | FotMob (avant-match : nouvelles des équipes, face-à-face, composition construite par les fans [^fotmob]), Flashscore (compositions probables [^flash]), sites de supporters (avant-match rédigé) | Compo probable : oui. Le reste : non |
| Jour de match au stade | Accès (tram T3, navettes, parkings), ouverture des portes, météo, règlement | Appli « Stade » et ol.fr, règlement intérieur du Groupama Stadium [^reglement] | Non |
| Pendant | Score, faits, stats, notifications même téléphone verrouillé | Toutes les applis de score (notifications push), OLPLAY (vidéo [^olplay]) | Oui, sauf notifications hors onglet |
| Après | Résumé vidéo, notes, réactions, conséquences au classement | L'Équipe (notes, analyses), chaînes YouTube (OL officiel, créateurs), OLPLAY | Notes et classement : oui. Vidéos : liens vers les chaînes seulement. Conséquences : implicites |
| Mercato | Arrivées, départs, rumeurs sourcées | L'Équipe, Olympique-et-Lyonnais, Transfermarkt (valeurs, historique) | Seulement au détour des flux d'actu |
| Histoire | Palmarès, saisons passées, « il y a N ans ce jour-là », bilan historique contre un club | Wikipédia, sites de supporters, musée de l'OL | Non |
| Féminines | OL Lyonnes : calendrier, résultats, classement Arkema Première Ligue et Ligue des champions | FFF (articles par journée [^fff]), OLPLAY, presse | Non (l'actu en parle, aucune donnée) |
| Groupe lyonnais | Réserve, U19, formés au club | OLPLAY (académie), presse locale | Non |
| Tribunes | Virage Nord (Bad Gones), Virage Sud (Lyon 1950…), déplacements, tifos | Réseaux des groupes, presse locale [^tribunes] | Non |

## 4. Sources de données gratuites : état et licence

| Source | Ce qu'elle apporte | Accès | Licence ou conditions | Statut pour l'app |
|---|---|---|---|---|
| **365scores** (déjà utilisée) | Matchs, compos, faits, stats ; dans les réponses déjà reçues : `venue` (nom, capacité), `officials` (arbitre), `hasPreviousMeetings`, `hasRecentMatches`, `hasMissingPlayers`, votes « Qui va gagner ? », drapeau `hasBets` (faux dans les deux réponses conservées) | API web non documentée, sans clé ; l'app envoie `User-Agent`, `Referer` et `Origin` de navigateur (`config/scores365-http.ts`), sans quoi elle répond 403 *(précision du 2026-11-20 : en-têtes retirés par L267, l'app envoie désormais un `User-Agent` qui la nomme, et 365scores répond 200)* | **Non lue** : la page des conditions (`365scores.info/pages/terms`) est une appli JavaScript, aucun texte servi à `curl` le 2026-11-20 | **À clarifier (P0)**. Les en-têtes imitant un navigateur ressemblent à ce que la consigne « aucun contournement anti-robot » exclut ; c'est l'état actuel de l'app, que l'étude ne peut ni valider ni écarter |
| **football-data.org** (déjà utilisée) | Ligue 1, Ligue des champions, horaires fixés ou non | API documentée, clé gratuite, 10 appels/min, 12 compétitions gratuites | CGU de 2018 : attribution obligatoire « Football data provided by the Football-Data.org API » [^fd] | Utilisable. Pas de compétition féminine dans l'offre gratuite (liste relevée sur des sites tiers, non confirmée sur la page des tarifs) |
| **openfootball** (`football.json`, dépôt `france`) | Résultats historiques de Ligue 1 (`fr.1`) en JSON, sans clé | Fichiers bruts GitHub | Domaine public d'après le dépôt [^openfootball] ; fichier LICENSE non relu | Bonne piste pour l'historique et le face-à-face sur plusieurs saisons. Profondeur historique à mesurer |
| **Wikidata** | Faits structurés : palmarès, saisons, joueurs, stades, dates | SPARQL public, sans clé | CC0 (domaine public) | Utilisable, attribution non exigée mais polie |
| **Wikipédia FR** (déjà utilisée pour les images) | Textes et tableaux d'histoire, saisons, records, OL Lyonnes | API MediaWiki | Textes en CC BY-SA 4.0 : attribution et partage dans les mêmes conditions ; chaque image a sa propre licence | Utilisable en citant l'article ; ne pas recopier de longs textes |
| **Open-Meteo** | Prévision à l'heure du coup d'envoi, aux coordonnées du stade | API sans clé | Données CC BY 4.0, API gratuite **non commerciale**, 10 000 appels/jour [^openmeteo] | Utilisable (site perso non commercial), attribution obligatoire |
| **Data Grand Lyon** (TCL) | Prochains passages des trams et bus, parcs relais en temps réel | Compte gratuit requis | « Licence de réutilisation des données d'intérêt général » ou Licence Mobilité selon le jeu de données [^grandlyon] ; licence exacte des prochains passages **non lue** | Possible, avec un compte et la lecture de la licence ; valeur seulement pour les matchs à Décines |
| **Flux RSS** (déjà utilisés) et **flux YouTube** des chaînes | Actu, vidéos récentes | RSS public | Titres et liens repris, contenu chez l'éditeur ; lecteur YouTube intégré permis par YouTube | Flux YouTube **non mesuré** : les chaînes de l'app sont des liens, sans leur identifiant `UC…` |
| Sofascore | Notes, heatmaps, compos | 403 à tout accès automatisé (L236) | Conditions illisibles | **Exclu** |
| Transfermarkt | Valeurs, transferts, historique | Pages web | Les conditions interdiraient tout accès automatisé (texte cité par un tiers, page d'origine non lue) [^tm] | **Exclu** |
| Billetterie OL | Places, prix | Aucune API publique | CGV de la billetterie | Un lien vers billetterie.ol.fr, rien d'autre |
| Diffuseurs TV | Chaîne de chaque match | Aucune source libre structurée trouvée | — | Table tenue à la main, ou rien (idée 7) |

## 5. Idées classées

Valeur : ★★★ forte (sert presque chaque match ou un public entier), ★★ moyenne, ★ faible. Effort : **S** (un lot court, données déjà là), **M** (un lot, un module ou une source neuve), **L** (plusieurs lots ou de l'infrastructure). Classement : valeur d'abord, puis effort croissant, puis risque sur la source.

| # | Idée | Valeur | Effort | Données | Source et licence |
|---|---|---|---|---|---|
| 1 | Fiche d'avant-match | ★★★ | M | Déjà reçues en partie | 365scores (P0), openfootball (domaine public) |
| 2 | Abonnement au calendrier (.ics) | ★★★ | S | Déjà là | Données de l'app |
| 3 | « Ce que ça change » après le match | ★★★ | S | Déjà là | Données de l'app |
| 4 | Notifications hors de l'onglet (Web Push) | ★★★ | L | Déjà là | Standard Web Push, sans tiers payant |
| 5 | OL Lyonnes | ★★★ | M | À mesurer | 365scores (couverture à vérifier, P0), Wikipédia |
| 6 | Bilan historique contre l'adversaire | ★★ | M | Source neuve | openfootball (domaine public), Wikidata (CC0) |
| 7 | Où regarder le match | ★★★ | S à M | Aucune source libre | Table tenue à la main |
| 8 | Jour de match au stade (accès, météo) | ★★ | M | Sources neuves | Open-Meteo (CC BY 4.0), Data Grand Lyon (licence à lire) |
| 9 | Histoire : éphéméride et palmarès | ★★ | M | Source neuve | Wikidata (CC0), Wikipédia (CC BY-SA 4.0) |
| 10 | Fil mercato | ★★ | S | Déjà là | Flux RSS déjà lus |
| 11 | Dernières vidéos des chaînes | ★★ | S | Flux à mesurer | Flux RSS YouTube |
| 12 | Course au classement (fin de saison) | ★★ | M | Déjà là | Données de l'app |
| 13 | Groupe lyonnais (réserve, U19, formés au club) | ★ | M | À mesurer | 365scores (couverture inconnue), Wikipédia |
| 14 | Page Tribunes | ★ | S | Aucune | Liens seulement |

### 1. Fiche d'avant-match (★★★, M)

**Pour le supporter** : la page d'un match à venir est la page qu'il ouvre la veille. Aujourd'hui elle montre la compo probable et des « Joueurs en vue » : il lui manque tout ce qui fait un avant-match (FotMob et les sites de supporters en font la base).

**Contenu** : forme des deux équipes (5 derniers matchs, toutes compétitions), absents et suspendus des deux côtés, dernières confrontations, arbitre, stade et capacité.

**Données** : `venue` et `officials` sont déjà dans les réponses `/web/game/` reçues (fixtures `365_game_lyon_rennes_live.json` : « Clément Turpin », « Groupama Stadium · 59 186 »). `hasMissingPlayers`, `hasRecentMatches` et `hasPreviousMeetings` sont vrais dans la fixture du match à venir Lyon – Crystal Palace, mais le contenu de ces blocs n'a pas été vu : il faut mesurer l'appel qui les sert. Le backend lit déjà les blessés de l'OL (`lineup.service.ts`, champ `injured`), affichés seulement sur la fiche joueur. Forme de l'OL : `/api/season-matches`. Celle de l'adversaire vient de 365scores ; en repli, football-data donne la forme en Ligue 1 seulement.

**Règles à tenir** : un absent n'est affiché que si la source le dit, avec sa date (jamais « aucun absent » quand le bloc manque : c'est l'invariant « rien de dessiné : on le dit ») ; l'arbitre n'apparaît qu'une fois désigné.

**Risque** : lire davantage 365scores (P0).

### 2. Abonnement au calendrier `.ics` (★★★, S)

**Pour le supporter** : les matchs dans l'agenda du téléphone, mis à jour seuls quand l'heure est fixée. Toutes les applis de score proposent un rappel ; un abonnement est plus simple et ne demande aucun compte.

**Contenu** : un `GET /api/calendar.ics` (toutes compétitions, ou filtré par compétition) et un bouton « S'abonner » sur `/fixtures`.

**Données** : `/api/season-matches` et `timeConfirmed`. Un match à l'heure non fixée devient un événement « journée entière » ou « week-end », marqué à confirmer : jamais l'heure de remplissage de 365scores (règle L39/L47). Le `UID` est stable par match pour que l'agenda mette à jour l'événement au lieu de le dupliquer.

**Risque** : faible. Le site est public, donc rien de personnel n'est exposé.

### 3. « Ce que ça change » après le match (★★★, S)

**Pour le supporter** : après le coup de sifflet, la question est « on est où, et après ? ».

**Contenu** : sur la page d'un match terminé et sur la carte « Dernier résultat », une phrase calculée comme « Lyon passe de 5e à 4e, à 2 points de la 3e place », suivie du prochain match.

**Données** : le tracker de classement (`season-rankings`, L241) et `/api/standings`. Aucune source neuve.

**Règle** : une place n'est annoncée que lorsque la journée est complète, ou sinon marquée provisoire. C'est la même prudence que celle de L245.

### 4. Notifications hors de l'onglet (★★★, L)

**Pour le supporter** : les notifications actuelles (`use-match-notifications.ts`) ne marchent que tant que l'onglet est ouvert. Un supporter au travail ou au stade attend le « But ! » sur un téléphone verrouillé.

**Contenu** : notifications Web Push (VAPID, service worker), opt-in, au choix : composition publiée, coup d'envoi, buts, fin du match.

**Données** : le flux SSE déjà émis (`/api/events`). Il n'y a pas de tiers payant : les services de push des navigateurs sont gratuits.

**Effort** : L. Il faut stocker les abonnements (nouvelle donnée persistante, donc une petite donnée personnelle : un point de terminaison par navigateur), envoyer côté serveur, désabonner les points de terminaison morts et l'expliquer dans À propos. Sur iPhone, le push web exige que le site soit installé sur l'écran d'accueil.

**Risque** : c'est la première écriture de visiteur côté serveur. Il faut la protéger par la limite de débit et la rendre inopérante en mode démo (`DemoWriteGuard`).

### 5. OL Lyonnes (★★★, M)

**Pour le supporter** : l'équipe la plus titrée du club : 19e titre de champion de France le 29 mai 2026 [^fff]. Elle est absente du site alors que l'actu en parle (article du 2026-11-20 sur OL Lyonnes – Arsenal dans `/news`).

**Contenu** : une page (calendrier, résultats, classement Arkema Première Ligue, Ligue des champions féminine), qui reprend les composants du calendrier et du classement.

**Données** : football-data n'a pas de compétition féminine dans son offre gratuite. 365scores couvre probablement l'Arkema Première Ligue, mais ce n'est **pas vérifié** : il faudrait l'identifiant 365scores de l'équipe et de la compétition, mesuré en P0, en même temps que les conditions. À défaut, Wikipédia (saison en cours) donne un classement, mais trop peu frais pour un calendrier.

**Point de vocabulaire** : OL Lyonnes est le nom de l'équipe depuis 2024-2025, et ses couleurs restent celles de l'OL. La règle de palette rouge et bleu s'applique.

### 6. Bilan historique contre l'adversaire (★★, M)

**Pour le supporter** : « on ne gagne jamais à Lille » est un sujet d'avant-match. La carte de la Ligue 1 donne le bilan de la saison ; l'historique sur plusieurs décennies n'existe nulle part sur le site.

**Contenu** : dans la fiche d'avant-match (idée 1) et la fiche d'un club sur `/map` : bilan V/N/D en championnat depuis N saisons, dernière victoire, plus large score.

**Données** : openfootball, dépôt `france`, Ligue 1 (domaine public). La profondeur historique et l'exactitude sont **à mesurer** contre une référence (Wikipédia), sur 3 confrontations tirées au hasard. Les coupes ne sont pas couvertes, ce qu'il faut dire à l'écran (« en championnat »). Ce sont des fichiers statiques, donc il suffit de les relire une fois par saison.

### 7. Où regarder le match (★★★, S à M)

**Pour le supporter** : « c'est sur quelle chaîne ? » est sans doute la question la plus posée avant chaque match. L'Équipe tient un programme TV.

**Données** : aucune source libre et structurée n'a été trouvée. 365scores a peut-être un champ diffuseur (à vérifier en P0). Sinon, une table tenue à la main par compétition et par saison (Ligue 1, coupes d'Europe, Coupe de France), versionnée dans le dépôt, avec sa date de mise à jour affichée.

**Règle** : sans information, rien n'est affiché, jamais une chaîne devinée. Les droits changent d'une saison à l'autre, et ceux de la Ligue 1 ont beaucoup bougé ces dernières saisons.

**Effort** : S pour la table, mais la tenir à jour est un coût récurrent, petit et sûr. À décider par Sylvain.

### 8. Jour de match au stade (★★, M)

**Pour le supporter qui va à Décines** : comment y aller, quand partir, quel temps il fera.

**Contenu** : pour un match à domicile, un bloc « Aller au stade » : tram T3 et navettes (lien vers TCL), parcs relais disponibles en temps réel le jour J, ouverture des portes (lien vers le règlement intérieur [^reglement]), et météo prévue à l'heure du coup d'envoi.

**Données** : météo par Open-Meteo, aux coordonnées du stade, que la carte de la Ligue 1 connaît déjà ; utile aussi à l'extérieur. Transports par Data Grand Lyon (compte gratuit, licence à lire).

**Valeur** : réelle pour les abonnés, mais une minorité des visiteurs va au stade. La météo seule est en S et pourrait passer en premier.

### 9. Histoire : éphéméride et palmarès (★★, M)

**Pour le supporter** : fierté et culture du club, avec un contenu qui change tous les jours.

**Contenu** : « Il y a N ans, ce jour-là » sur l'accueil (match marquant, but, titre), plus une page Palmarès (7 titres de champion 2002-2008, coupes, OL Lyonnes) et saisons passées (classement final).

**Données** : Wikidata (CC0) pour les faits structurés, Wikipédia FR (CC BY-SA 4.0, article cité) pour les saisons ; openfootball pour les matchs datés.

**Règle** : chaque fait affiché porte sa source. Une éphéméride vide un jour donné ne s'affiche pas.

### 10. Fil mercato (★★, S)

**Pour le supporter** : en juillet-août et en janvier, c'est le premier sujet.

**Contenu** : un filtre « Mercato » sur `/news`, par mots-clés (transfert, prêt, signe, rumeur…) sur les flux déjà lus, qui ne s'affiche que pendant les fenêtres de transfert.

**Données** : flux RSS déjà lus, sans source neuve. Un tableau des arrivées et départs confirmés demanderait Transfermarkt (exclu) ou une saisie à la main. Ce n'est pas proposé.

**Règle** : une rumeur reste un titre d'article avec sa source, jamais un fait affiché par le site.

### 11. Dernières vidéos des chaînes (★★, S)

**Pour le supporter** : le résumé et les réactions d'après-match sont des vidéos (chaîne officielle, Olympique-et-Lyonnais, créateurs). Aujourd'hui `/news` ne donne que des liens vers 6 chaînes.

**Contenu** : les 3 dernières vidéos de chaque chaîne retenue, avec titre, date et vignette, et la lecture chez YouTube.

**Données** : flux RSS publics de YouTube par identifiant de chaîne `UC…`. Les identifiants sont à relever (`youtube-channels.json` ne contient que des noms), puis le flux est à mesurer.

### 12. Course au classement en fin de saison (★★, M)

**Pour le supporter** : en avril-mai, la question est « que faut-il pour la Ligue des champions ? ». Aujourd'hui le classement et le tracker regardent en arrière.

**Contenu** : à partir de J28, pour les places qualificatives, l'écart, le calendrier restant des concurrents et le nombre de points nécessaires au mieux et au pire.

**Données** : classement et calendrier de toute la Ligue 1 (football-data, déjà lu, `limit=100`). Pas de probabilités inventées : seulement des calculs certains.

### 13. Groupe lyonnais : réserve, U19, formés au club (★, M)

Sert un public plus restreint. La couverture de la réserve (National 3) et des U19 par 365scores est inconnue. Une version légère, un badge « formé au club » sur les fiches joueurs à partir de Wikidata (CC0), coûterait moins cher. Pas proposé en lot tant que la source n'est pas mesurée.

### 14. Page Tribunes (★, S)

Liens vers les sites et réseaux officiels des groupes (Bad Gones au Virage Nord, Lyon 1950…) et vers le règlement du stade. Il n'y a aucune donnée à afficher, et le sujet est sensible (tensions entre groupes et violences rapportées par la presse [^tribunes]) : un site perso n'a pas à arbitrer. Pas proposé en lot : à reprendre seulement si Sylvain le souhaite.

### Écartées

| Idée | Pourquoi |
|---|---|
| Notes Sofascore, heatmaps | 403, conditions illisibles (L236) |
| Valeurs marchandes, historique des transferts | Transfermarkt interdit l'accès automatisé |
| Billetterie dans l'app | Pas d'API ; l'achat passe par l'appli officielle « Stade ». Un lien suffit |
| Vote « Qui va gagner ? » | 365scores fournit les votes de ses propres utilisateurs, peu pertinents. Un vote local demande de stocker des écritures de visiteurs et de les protéger contre les abus, pour peu de valeur |
| Cotes et paris | 365scores en a le drapeau (`hasBets`) ; contraire à l'esprit d'un site de supporter public |
| xG de la saison | Déjà renvoyé à une étude de sources (FBref, Understat : conditions à mesurer) par L236 |

## 6. Lots proposés

Le lead décide ; aucun n'est créé. Les ids sont provisoires. « Visible » veut dire revue UX obligatoire (règle du 2026-09-28).

| Lot | Titre proposé | Visible | Dépend de | Critère de réussite |
|---|---|---|---|---|
| **P0** | Étude : conditions d'utilisation de 365scores (lues dans un navigateur), en-têtes envoyés par l'app au regard de la règle « aucun contournement anti-robot », couverture d'OL Lyonnes, champ diffuseur et contenu des blocs `previousMeetings` / `recentMatches` / `missingPlayers` | non | — | Un verdict sourcé par question, dans `docs/etudes/` |
| P1 | Page d'un match à venir : forme des deux équipes, absents et suspendus, dernières confrontations, arbitre, stade (idée 1) | oui | P0 | Sur un match à venir réel, chaque bloc s'affiche ou dit qu'il n'y a pas de donnée ; aucun « aucun absent » sans source |
| P2 | Abonnement au calendrier `.ics` depuis `/fixtures` (idée 2) | oui | — | Un agenda (Google, Apple) importe la saison ; un match à l'heure non fixée n'a pas d'heure ; un changement d'heure met à jour l'événement sans le dupliquer |
| P3 | « Ce que ça change » sur un match terminé et sur « Dernier résultat » (idée 3) | oui | — | Pour J1 à J10, la phrase correspond au tracker ; journée incomplète marquée provisoire |
| P4 | Où regarder : table des diffuseurs par compétition, tenue à la main et datée (idée 7) | oui | P0 (champ diffuseur) | Aucune chaîne affichée sans entrée dans la table ; date de mise à jour visible |
| P5 | Météo prévue au coup d'envoi sur la page d'un match à venir, Open-Meteo avec attribution (première moitié de l'idée 8) | oui | — | Prévision affichée dans la fenêtre de prévision seulement, avec heure de mise à jour et attribution ; erreur visible, jamais un bloc vide |
| P6 | OL Lyonnes : calendrier, résultats, classement (idée 5) | oui | P0 | Les matchs de la saison 2026-27 en cours correspondent à une référence (FFF) |
| P7 | Bilan historique en championnat contre l'adversaire (idée 6), après mesure d'openfootball | oui | — | 3 bilans tirés au hasard égaux à Wikipédia ; « en championnat » écrit à l'écran |
| P8 | Filtre Mercato sur `/news` pendant les fenêtres de transfert (idée 10) | oui | — | Le filtre n'existe qu'en fenêtre ; les rumeurs gardent titre et source |
| P9 | Dernières vidéos des chaînes YouTube sur `/news` (idée 11) | oui | — | Les identifiants `UC…` sont relevés, le flux mesuré, 3 vidéos par chaîne avec date |
| P10 | Notifications Web Push hors de l'onglet (idée 4) — à découper | oui | — | Notification reçue téléphone verrouillé (Android) pour un but ; désabonnement ; écriture refusée en mode démo |
| P11 | Histoire : éphéméride sur l'accueil et page Palmarès (idée 9) | oui | — | Chaque fait cite sa source ; pas de bloc vide les jours sans fait |
| P12 | Course au classement à partir de J28 (idée 12) | oui | — | Calculs vérifiés sur une fin de saison passée |

Ordre conseillé : P0, P2 et P3 d'abord (sans dépendance et peu chers), puis P1 et P5, puis le reste selon le goût de Sylvain. P10 est le plus cher et se découpe avant de commencer.

## 7. Questions pour Sylvain

1. **OL Lyonnes** a-t-elle sa place sur ce site, qui s'appelle « OL Companion » mais ne suit aujourd'hui que l'équipe masculine ?
2. **Où regarder** : d'accord pour une table tenue à la main, avec la petite charge de la mettre à jour à chaque changement de droits ?
3. **Notifications push** : acceptes-tu de stocker côté serveur les abonnements des visiteurs (première donnée de visiteur gardée par l'app) ?
4. Si P0 conclut que les conditions de 365scores interdisent l'usage actuel, on cherche une autre source pour **toute l'app** : c'est une décision qui dépasse cette étude.

## Sources

[^appli]: Appli officielle « Stade » (ex-Groupama Stadium) et billetterie : [App Store](https://apps.apple.com/app/id1061547016), [CGV billetterie juin 2025](https://billetterie.ol.fr/media/cgv_billetterie_b2b_juin2025.pdf), [Lyon Capitale](https://www.lyoncapitale.fr/?p=516800), [Foot01](https://www.foot01.com/equipe/ol/l-ol-ferme-ses-guichets-plus-de-tickets-en-vente-au-groupama-stadium-450070).
[^olplay]: [OLPLAY sur l'App Store](https://apps.apple.com/FR/app/id1376038376) : direct, vidéo à la demande, équipes masculine, féminine et académie.
[^fotmob]: [FotMob, articles d'avant-match](https://latest.fotmob.com/tag/preview/page/5/) (nouvelles des équipes, face-à-face, composition construite par les fans) et [fiche App Store](https://apps.apple.com/gb/app/id488575683).
[^flash]: [Flashscore introduit les compositions probables](https://www.flashscore.fi/news/pre-match-football-content-boost-flashscore-introduces-predicted-line-ups/OzeY15aT/).
[^reglement]: [Règlement intérieur du Groupama Stadium](https://www.olvallee.fr/wp-content/uploads/2025/10/Reglement-interieur-du-Groupama-Stadium-Pictos.pdf).
[^fff]: FFF, [« Indomptable OL Lyonnes »](https://www.fff.fr/article/16892-indomptable-ol-lyonnes.html) et [2e journée 2026-27](https://www.fff.fr/article/17309-tout-sur-la-2e-journee.html) ; [19e titre](https://dicodusport.fr/blog/indetronable-lol-lyonnes-soffre-un-19eme-titre-de-champion-de-france/).
[^tribunes]: [Lyon Capitale, banderole des Bad Gones](https://www.lyoncapitale.fr/?p=441985), [LyonMag, 30 ans des Bad Gones](https://www.lyonmag.com/article/92721/ambiance-bouillante-pour-les-30-ans-des-bad-gones), [LyonMag, violences après OL – Nantes](https://www.lyonmag.com/article/138654/de-violents-affrontements-entre-supporters-apres-ol-nantes-la-police-intervient).
[^fd]: [football-data.org, conditions générales](https://api.football-data.org/register) ; offre gratuite d'après [thestatsapi.com](https://www.thestatsapi.com/blog/football-data-org-free-tier-limits-2026) (source tierce).
[^openfootball]: [openfootball/football.json](https://github.com/openfootball/football.json), [openfootball/france](https://github.com/openfootball/france).
[^openmeteo]: [Open-Meteo, conditions](https://open-meteo.com/en/terms), [licence des données](https://open-meteo.com/en/licence), [tarifs](https://open-meteo.com/en/pricing).
[^grandlyon]: [Data Grand Lyon, horaires TCL (licence Mobilité, compte requis)](https://data.grandlyon.com/geonetwork/srv/api/records/acbeb1b9-ce82-480b-802f-9133f361ce46), [licence de réutilisation des données d'intérêt général](https://download.data.grandlyon.com/files/grandlyon/Licence_Reutilisation_Donnees_Interet_General.pdf), [parcs relais en temps réel](https://www.data.gouv.fr/datasets/6116206df78fd0933c5b838e).
[^tm]: Clause citée par un tiers ([freedom251.com](https://freedom251.com/?p=888167)) et [message de 2018 sur R-pkg-devel](https://stat.ethz.ch/pipermail/r-package-devel/2018q1/002405.html) ; page d'origine non lue.
