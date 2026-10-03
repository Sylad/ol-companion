# Attendus QA — ol-companion

Ce que l'utilisateur doit trouver sur chaque page de https://ol.sladoire.dev. Lu par l'agent
`qa-reviewer` de cadence après chaque livraison. Les comptes datent du 03-10-2026 ; une ligne suivie
de « à décider » attend une décision de Sylvain.

## *
- shows: un titre de page (h1) non vide ; la navigation — barre latérale à 1440, barre du bas à 5 entrées à 390
- never: « Erreur de chargement », « Too Many Requests », un indicateur de chargement encore là après 8 s
- api: /api/demo/status
- api: /api/events — flux SSE, sans taille
- api: /api/live-match/current — may be empty when aucun match n'est en cours ou proche

## /
- shows: « Prochain rendez-vous » avec deux clubs et une date ; les tuiles Position, Points, Différence de buts, Forme, chacune avec une valeur ; « Dernier résultat » avec un score ; « OL en chiffres » ; le tracker de classement avec un point par journée jouée
- never: « Aucun match programmé. » ; « Aucun match joué cette saison. » ; « Aucune donnée d'évolution disponible. » ; une heure « 01h00 »
- api: /api/standings
- api: /api/fixtures
- api: /api/standings/season-rankings
- api: /api/season-matches/team-stats

## /standings
- shows: 18 lignes dans le tableau, chacune avec un nom de club et un écusson chargé ; positions de 1 à 18 ; la ligne de l'OL mise en avant
- shows: la colonne Pts visible sans défilement horizontal — 390 only
- never: « Aucune donnée disponible. » ; « Impossible de récupérer les données 365scores. » ; une ligne sans nom de club ; moins de 18 lignes
- api: /api/standings — `table` de 18 entrées
- api: /api/standings/season-rankings
- api: /api/wiki-image — 200 pour chaque club, aucun 429

## /players
- shows: « Dernier match » avec un score ; 11 titulaires sur le terrain ; un banc non vide ; onglet Effectif : au moins 18 liens vers une fiche joueur ; onglet Stats saison : au moins 18 lignes
- never: « Aucune compo récente trouvée. » ; « Erreur de chargement des stats. »
- api: /api/lineup — `starters` de 11
- api: /api/players/season-stats — sur l'onglet Stats saison

## /player/$athleteId
Visiter 2185, ou n'importe quel lien de l'onglet Effectif de /players.
- shows: le nom du joueur en titre ; les tuiles Buts, Passes déc., Minutes ; au moins une ligne dans le tableau des matchs joués
- never: « Aucune statistique trouvée pour ce joueur. »
- api: /api/players/<id>/season-stats

## /match/$gameId
Visiter le lien de la carte du direct sur / quand elle existe ; sinon
/match/<gameId de /api/lineup>?matchupId=<homeId>-<awayId>-<gameId> (OL = 465).
- shows: l'en-tête du score avec deux clubs ; « Faits du match » avec au moins un événement pour un match terminé ; « Statistiques » ; deux blocs « Composition » de 11 ; « Classement en direct » avec 5 lignes dont Lyon
- never: « Match introuvable » ; « Lien incomplet »
- api: /api/live-match/<gameId>/stats

## /fixtures
- shows: tous les matchs de la saison, toutes compétitions où l'OL joue (Ligue 1, Ligue des champions et ses qualifications, Ligue Europa, coupes) : autant de lignes que /api/season-matches en renvoie (46 le 03-10) ; « Matchs listés » égal à ce total ; les pastilles par compétition, dont la somme égale « Toutes »
- shows: un score sur chaque match joué ; une heure ou « Horaire à confirmer » sur chaque match à venir, jamais les deux
- never: « Aucun match dans cette catégorie. » sur le filtre Tout ; une heure « 01:00 »
- api: /api/season-matches
- api: /api/fixtures

## /news
- shows: « Chaînes YouTube recommandées » avec au moins une carte ; « À la une » avec au moins 10 liens d'articles
- never: « Erreur de chargement. » ; « Aucun article pour la source »
- api: /api/news
- api: /api/youtube-channels

## /cups
- shows: un bloc par coupe que l'OL joue cette saison, avec ses matchs et un statut fidèle à la compétition
- never: « Erreur de chargement des données coupes. » ; « ÉLIMINÉ » tant que la compétition continue pour l'OL
- api: /api/cups — may be empty when aucune coupe n'a commencé (à décider)

## /map
- shows: 18 marqueurs sur la carte ; les tuiles de la carte chargées ; la légende « Aller / Retour »
- never: « Chargement de la carte… » après 8 s

## /fcnoobz
- shows: le titre « FC NOOBZ » ; 3 cartes ; l'image du club

## /about
- shows: le titre « Vibe coded with Claude Code » ; les sections de la pile technique

## /nouveautes
- shows: le titre « Ce qui a changé » ; au moins 5 entrées, chacune avec une date, un titre et sa capture chargée
- never: « Aucune nouveauté publiée pour l'instant. »
- api: /nouveautes-data/nouveautes.json

## /plan
- shows: le titre « Ce qui se prépare » ; les sections « En cours (n) », « Prévu (n) », « Récemment livré (n) », n égal au nombre de cartes
- never: « Aucun plan publié pour l'instant. » ; « Vérifiez la connexion, puis réessayez. »
- api: /plan-data/plan.json
