# Attendus QA — ol-companion

Ce que l'utilisateur doit trouver sur chaque page de https://ol.sladoire.dev. Lu par l'agent
`qa-reviewer` de cadence après chaque livraison. Chaque compte porte sa date ; une ligne suivie
de « à décider » attend une décision de Sylvain. Les textes se comparent sans tenir compte de la casse
(l'écran met certains libellés en capitales).

## *
- shows: un h1 non vide — le bandeau du club ou le titre propre de la page ; la navigation — barre latérale à 1440, barre du bas à 5 entrées (4 liens + bouton « Plus ») à 390
- shows: le bundle chargé par la page (script[src]) est celui que référence /index.html relu sans cache
- never: « Erreur de chargement », « Too Many Requests », un élément .animate-spin ou .animate-pulse visible, ou un texte d'état « Chargement… », « Chargement de … », « Chargement du … » ou « Chargement des … » (jamais le mot seul : la prose de /about, « chargement progressif des routes », le titre ou le corps d'une entrée de /nouveautes le contiennent — 7 entrées citent « Chargement… » ou « Chargement de … » dans leur texte, L157), 8 s après le chargement ; sur /nouveautes, ne compter que les textes hors de tout `<article>`
- api: /api/demo/status
- api: /api/events — flux SSE, sans taille
- api: /api/live-match/current — may be empty when aucun match n'est en cours ou proche ; « proche » = la fenêtre du backend (`live-match.service.ts`) : coup d'envoi dans les 24 h à venir, ou de 15 min avant à 3 h après le coup d'envoi, ou match fini depuis moins de 2 h. Au-delà de 24 h la réponse est vide (null mesuré ~32 h avant OL – Nice pendant que / annonçait « dans 1 jour » : conforme) ; ne la réclamer qu'à moins de 24 h
- shows: les textes secondaires (jeton fg-dim) posés sur une photo, un halo ou un panneau semi-transparent (bandeau de /, légende de /map, surtitre de /about, le premier `<p>` de son `<header>` : aucun `.eyebrow` sur cette page) à ≥ 4,5:1 mesuré sur les pixels réels, à 1440 comme à 390
- shows: scrollWidth = clientWidth de la page, à 1440 comme à 390 (aucun défilement horizontal ; L156 : une table `sr-only` hors d'un `div.sr-only` gardait sa largeur de contenu, 480 px, et poussait la page à 520 px sur / et /standings)

## /
- shows: le bandeau titré « Prochain rendez-vous », ou « Approche du coup d'envoi » (match à moins de 36 h), ou « Jour de match » (match le jour même, L157 complète L73), ou « Match en direct » ; avec deux clubs et une date ; les tuiles Position, Points, Différence de buts, Forme, chacune avec une valeur ; « Dernier résultat » avec un score ; « OL en chiffres » ; le tracker de classement avec autant de points que d'entrées dans /api/standings/season-rankings (6 le 10-10) ; le lieu du prochain match est un nom de stade, ou rien
- never: « Aucun match programmé. » ; « Aucun match joué cette saison. » ; « Aucune donnée d'évolution disponible. » ; une heure « 01h00 » ou « 02h00 » (minuit UTC)
- api: /api/standings
- api: /api/season-matches — lu par le bandeau « Prochain rendez-vous » et par « Dernier résultat » (toutes compétitions) ; `/api/fixtures` n'est plus appelé par `/`
- api: /api/standings/season-rankings
- api: /api/season-matches/team-stats

## /standings
- shows: 18 lignes dans le tableau, chacune avec un nom de club et un écusson chargé ; positions de 1 à 18 ; la ligne de l'OL mise en avant
- shows: la colonne Pts visible sans défilement horizontal — 390 only
- never: « Aucune donnée disponible. » ; « Impossible de récupérer les données 365scores. » ; une ligne sans nom de club ; moins de 18 lignes
- api: /api/standings — `table` de 18 entrées
- api: /api/standings/season-rankings
- api: imagecache.365scores.com — 18 écussons chargés, 200, aucun 429 (le classement prend ses écussons au CDN 365scores, plus à `/api/wiki-image`)

## /players
- shows: « Dernier match » avec un score ; 11 titulaires sur le terrain ; un banc non vide, qui compte autant de joueurs que le banc de la page du même match ; onglet Effectif : au moins 18 liens vers une fiche joueur ; onglet Stats saison : au moins 18 lignes
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
/match/<gameId de /api/lineup>?matchupId=<homeId>-<awayId>-<gameId> : 465 (l'OL) et opponentId de /api/lineup,
dans l'ordre que donne isHome. Pour un match des Bleus : un lien de /equipe-de-france (5061 dans le matchupId).
- shows: l'en-tête du score avec deux clubs ; « Faits du match » avec au moins un événement pour un match terminé ; « Statistiques » ; deux blocs « Composition » de 11 (sauf sur un match à venir dont 365scores n'a publié aucune composition, ex. Hoffenheim – Lyon : `lineups` absent de la réponse, donc ni colonnes ni bloc « Composition », mais « Statistiques » et « Joueurs en vue » restent affichés — L162) ; sur un match de Ligue 1 seulement, « Classement en direct » avec 5 lignes dont Lyon (sur un match de coupe ou d'Europe, le bloc est absent : la réponse de /api/live-match/<gameId>/stats n'a pas de clé `standings`, undefined et non null, vu sur Lyon – Crystal Palace le 16-10, L158)
- never: « Match introuvable » ; « Lien incomplet »
- shows: sur un match des Bleus (5061 dans le matchupId, L167) : `body.theme-bleus` ; le lien de retour [data-testid=lien-retour-equipe] « Équipe de France » (le lien « Équipe de France » de la barre latérale existe sur toutes les pages, il ne compte pas) ; texte de la France hsl(224 90% 75%) dans l'en-tête et les repères de sens « ← X attaque » de la Carte des tirs ; pastilles, points et courbes de la France hsl(224 80% 58%) (Momentum, Carte des tirs et leurs légendes), adversaire hsl(0 0% 96%) ; une bordure néon bleu-blanc-rouge sur `.faits-bloc` ; des noms d'équipe sur 2 lignes au plus, sans rognage, à 390
- never: sur un match de l'OL (sans 5061 dans le matchupId), `body.theme-bleus`, [data-testid=lien-retour-equipe] ou une couleur des Bleus : rien ne change
- shows: « Faits du match » avec le compte « N faits » (« 1 fait » au singulier) égal au nombre d'`events` de /api/live-match/<gameId>/stats (L161)
- shows: sur un match terminé de plus de 5 faits, [data-testid=liste-faits] = 5 lignes de 44 px (clientHeight 220, scrollHeight > 220) à 1440 et à 390, ouverte sur les 5 faits les plus récents (scrollTop 0, DOM en ordre chronologique) ; liste focalisable (tabindex=0, role=region) ; bouton [data-testid=repere-faits-anciens] « ↑ N faits plus anciens » (N = faits − 5, « 1 fait plus ancien » au singulier) ; une fois la liste remontée, le repère devient « Début du match », aria-disabled=true ; 32 px de haut
- shows: à 5 faits ou moins, ni repère ni tabindex sur la liste ; sans fait (match pas commencé), pas de bloc « Faits du match » — may be absent
- shows: « Momentum » (may be absent tant que `momentum` est vide : match à venir) visible sans défiler trop loin : bottom < 900 à 1440 × 900 et top < 786 à 390 × 844 ; à 1440 seulement, le titre « Carte des tirs » (may be absent tant que `shots` est vide) aussi au-dessus de 900
- never: dans la liste des faits, un bouton fléché (::-webkit-scrollbar-button avec display ≠ none) ou une teinte verte ; un libellé tronqué sous 390 px (389 px et moins ; à 390 px et au-delà, un libellé long clampé à deux lignes par une ellipse est conforme)
- never: « Classement en direct » sur un match qui n'est pas de Ligue 1
- never: à 320 px, une formation de la pastille « Composition » coupée sur 2 lignes (« 4-4-/2 », « 4-2-/3-1 »), même avec un nom de club long (Anderlecht, Fenerbahçe SK)
- never: sur un match à venir, une composition non « Confirmé » par 365scores sans l'étiquette « Composition probable » ; un numéro de maillot « 0 » (titulaire ou banc)
- shows: sur un match à venir, un numéro de maillot sur chaque titulaire et chaque remplaçant des deux compositions, y compris quand 365scores envoie 0 (reprise du numéro des 5 derniers matchs du club, le plus récent d'abord, L133) — tolérance : un joueur absent de ces 5 matchs (recrue, blessé de longue durée) peut rester sans numéro
- shows: sur un match de Ligue 1 à venir à plus de 14 jours dont l'heure est fixée côté `/api/season-matches` (`timeConfirmed` vrai, ex. Lyon – Angers du 31/10 à J+14,3), l'en-tête affiche l'heure et non « Horaire à confirmer » : `timeConfirmed` de `/api/live-match/<gameId>/stats` égale celui du même match dans `/api/season-matches` (L170)
- shows: même égalité hors Ligue 1 : un match de Ligue Europa, de Ligue des champions ou de Coupe de France à plus de 14 jours (ex. Lyon – Lillestrom, Ligue Europa, jeu. 22/10) a `timeConfirmed` vrai dans `/api/live-match/<gameId>/stats` comme dans `/api/season-matches` (L172)
- api: /api/live-match/<gameId>/stats

## /fixtures
- shows: tous les matchs de la saison, toutes compétitions où l'OL joue (Ligue 1, Ligue des champions et ses qualifications, Ligue Europa, coupes) : autant de lignes que /api/season-matches en renvoie (46 le 03-10) ; « Matchs listés » égal au nombre de lignes affichées, quel que soit le filtre de statut ou de compétition (au total, sans filtre) ; les pastilles par compétition, dont la somme égale « Toutes »
- shows: un score sur chaque match joué ; une heure ou « Horaire à confirmer » sur chaque match à venir, jamais les deux
- never: « Aucun match dans cette catégorie. » quand la pastille choisie annonce au moins 1 match ; une heure « 01:00 » ou « 02:00 » (minuit UTC)
- api: /api/season-matches

## /news
- shows: « Chaînes YouTube recommandées » avec au moins une carte ; « À la une » avec au moins 10 liens d'articles
- never: « Erreur de chargement. » ; « Aucun article pour la source » ; sur une carte d'article, une description qui commence par le titre de la carte (Google News groupé : « Titre… 20 MinutesTitre2 Le Figaro… », L171)
- api: /api/news
- api: /api/youtube-channels

## /cups
- shows: un bloc par compétition hors Ligue 1 de /api/season-matches (Ligue Europa le 03-10 ; qualifications de Ligue des champions : à décider) ; chaque bloc liste ses matchs joués
- never: « Erreur de chargement des données coupes. » ; « éliminé » tant que /api/season-matches a un match à venir dans cette compétition
- api: /api/cups — may be empty when aucune coupe n'a commencé (à décider)

## /map
- shows: 18 marqueurs sur la carte ; les tuiles de la carte chargées ; la légende « Aller / Retour »
- never: « Chargement de la carte… » après 8 s

## /equipe-de-france
- shows: le titre « Équipe de France » ; trois blocs « Prochain match », « Derniers résultats » (5 lignes, « Domicile – Extérieur », chacune un lien [data-testid=lien-resultat-match] vers /match/<id>?matchupId=<home>-<away>-<id>, L167) et « Effectif » (Gardiens, Défenseurs, Milieux, Attaquants avec leur nombre) ; le prochain match donne toujours son jour (« Jeu. 12/11 ») puis l'heure ou « Horaire à confirmer » ; au téléphone, le bouton « Plus » actif
- never: « Impossible de charger l’équipe de France. » ; « Aucune donnée sur l’équipe de France pour le moment. » ; une heure de coup d'envoi présentée comme sûre quand elle est « à confirmer » ; « Date et horaire à confirmer » ou « Week-end du … » pour le prochain match des Bleus (le jour est connu)
- api: /api/france

## /fcnoobz
- shows: le titre « FC NOOBZ » ; 3 cartes (Lecteur de sauvegarde FM, Histoire du club, Palmarès virtuel) ; l'image du club

## /about
- shows: le titre « Vibe coded with Claude Code » ; les sections Frontend, Backend, Infra (titres h3, pas h2), chacune non vide ; chaque lien de « Mes autres sites » répond 2xx

## /nouveautes
- shows: le titre « Ce qui a changé » ; au moins 5 entrées, chacune avec une date, un titre et sa capture chargée
- never: « Aucune nouveauté publiée pour l'instant. »
- api: /nouveautes-data/nouveautes.json

## /plan
- shows: le titre « Ce qui se prépare » ; les sections « En cours (n) », « Prévu (n) », « Récemment livré (n) », n égal au nombre de cartes
- never: « Aucun plan publié pour l'instant. » ; « Vérifiez la connexion, puis réessayez. »
- api: /plan-data/plan.json
