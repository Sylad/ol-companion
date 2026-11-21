# FC Noobz : lire les sauvegardes Football Manager (L120)

Étude sans code, 2026-11-21. Question : l'app peut-elle lire les sauvegardes Football Manager de
Sylvain (`E:\Documents\Sports Interactive`, sous WSL `/mnt/e/Documents/Sports Interactive`), ou à
défaut les exports du jeu, pour publier un résumé sur `/fcnoobz` (lot L121) ?

## Verdict : partiel

| Édition | Sauvegardes `.fm` | Verdict | Pourquoi |
|---|---|---|---|
| **FM26** (26.1.2) | 27 fichiers, 104 à 234 Mo | **Oui, avec réserves** | `fmsave` (MIT) lit club géré, effectif complet (218 champs par joueur), stats de saison, historique des joueurs saison par saison, finances, classements. Build non vérifié par l'outil : compétitions non nommées, calendrier vide (0 match), tactiques et entraînement illisibles. |
| **FM27** (27.0.1) | 4 fichiers, 70 à 77 Mo | **Oui, avec réserves** | Les 33 lecteurs de `fmsave` passent (statut `ok`), calendrier et classement de la division du club géré compris. Build « non vérifié » : 27 champs confirmés en jeu sur 838, le reste « non confirmé ». |
| **FM24** (24.3) | même conteneur que FM26/27 | **Non** (sans rétro-ingénierie) | La décompression marche (300 Mo lisibles, noms de joueurs en clair) mais aucun outil libre ne connaît la disposition des enregistrements ; `fmsave` : « no game version found ». |
| **FM21 à FM23** (21.1, 23.0) | conteneur à trames préfixées | **Non** (sans rétro-ingénierie) | Décompression possible (FM23 : 305 Mo, noms en clair, répertoire des sections lu), aucune disposition connue ; `fmsave` refuse (« save directory could not be decompressed »). |
| Exports `exported teams` (`.fmf`) | FM23, FM24, FM26 | **Non utile** | Ce sont des équipes du mode « Versus » (`VERSUS_TEAM_TYPE_HANDLER`) : un effectif figé, au format binaire à étiquettes, sans résultat ni classement. Aucun lecteur libre. |
| Exports HTML / texte (« imprimer → page web ») | **aucun** dans le dossier | — | Aucun `.html`, `.htm`, `.rtf` ni `.csv` produit par le jeu n'existe (recherche limitée à 3 niveaux, hors `graphics`). Le seul `.txt` utile est `FM21.txt`, des notes de Sylvain. |

**Ce qui ne se lit nulle part, même en FM26/27 :** le palmarès et l'historique des classements du
club saison par saison (sections `tc_league_history_ls`, `tc_cup_history_ls`,
`tc_manager_history_ls` présentes dans le répertoire de la sauvegarde, mais aucun lecteur de
`fmsave` ne les décode). Pour L121 (« saisons, divisions, titres »), on n'a donc que la saison en
cours de chaque sauvegarde, plus `last_league_position` du club. Les saisons passées se
reconstituent en lisant plusieurs sauvegardes successives d'une carrière (une par saison), ou se
saisissent à la main pour FM21 à FM24.

## 1. Méthode et garde-fous

- **Lecture seule.** Les sauvegardes n'ont été qu'ouvertes en lecture (`head`, `tail`, Python
  `open(…, 'rb')`, `fmsave` qui ouvre en `"rb"` — `_container.py:232` — et dit « never modifies a
  save »). Date de modification et taille des deux sauvegardes FM26 et FM27 relevées avant et
  après : identiques. Rien n'a été copié hors du scratchpad de la session ; les flux décompressés
  et les CSV d'essai y sont restés. **Aucune donnée de sauvegarde n'est dans ce dépôt** : ce
  document ne cite que des tailles, des comptes, des noms de champs et des numéros de build.
- **Fichiers examinés** : une sauvegarde par édition (FM21, FM22, FM23, FM24, FM26, FM27), un
  `.fmf` d'équipe exportée FM23 et FM26, un `.fmf` de vue FM21.
- **Outils** : `xxd`, `strings`, `zstd` 1.5.5, un parcoureur de trames zstd écrit pour l'étude
  (lit les en-têtes de bloc sans décompresser), `fmsave` 0.14.2 installé dans un venv jetable
  (paquet lu avant exécution : aucun module réseau).
- **Non vérifié** : la justesse des valeurs contre l'écran du jeu (FM n'est pas lancé sur
  Big-Blue) ; FM22 au-delà de l'en-tête ; les conditions d'utilisation (EULA) de Sports
  Interactive sur la lecture des sauvegardes ; l'export « imprimer en page web » du jeu, faute
  d'exemple dans le dossier.

## 2. Le conteneur `.fm` : zstd, pas un format propriétaire

Tous les fichiers commencent par le même en-tête de 26 octets :

```
02 01 66 6d 66 2e  08 00 00  <4 octets>  00 00 00 00 00 11 00 00 00 00 00 00 00 03
      "fmf."
```

Les octets 9 à 12 pointent la fin des données (début de la remorque). Ensuite :

| Édition | Après l'en-tête | Mesure |
|---|---|---|
| FM24, FM26, FM27 | trames **Zstandard** (magie `28 b5 2f fd`) collées les unes aux autres | FM27 (74,8 Mo) : 1 232 trames contiguës de l'octet 26 à 74 796 681, puis la remorque ; FM24 (75,1 Mo) : 1 119 trames |
| FM21, FM22, FM23 | chaque trame zstd **précédée de sa longueur** (u32 petit-boutiste) | FM23 (90,9 Mo) : 3 299 trames préfixées, longueurs toutes exactes, jusqu'à 90 873 422 |

La **remorque** est un second en-tête `fmf.` suivi d'une trame zstd : le **répertoire des
sections**, en clair une fois décompressé (79 Ko en FM27) : `game_info`, `save_game_summary`,
`game_db`, `pl_hist_ls`, `humans`, `transfer_man`, `tc_league_history_ls`, `tc_cup_history_ls`,
`tc_manager_history_ls`, `tactics_man`… (76 sections en FM27, 81 en FM26 selon `fmsave info`).

Une fois décompressé, le flux commence par `03 01 "tad."` (`.dat` à l'envers) et la version de la
base (`27.0.0+0`, `24.3.0+0`, `23.0.0+0`, `21.1.1-0`). Taille : 287 Mo pour la sauvegarde FM27 de
75 Mo, 305 Mo pour FM23 (91 Mo). Les noms sont en UTF-8 précédés de leur longueur, dans une table
`[id u32][longueur u32][texte]` ; les étiquettes de champs sont des mots de 4 lettres à l'envers
(`mcbc`, `smfs`…).

**Conséquence** : la compression n'est plus un obstacle, pour aucune édition. L'obstacle est la
disposition des enregistrements dans `game_db` (taille et ordre des champs d'un joueur, d'un club,
d'une compétition), non documentée et **changeante d'un build à l'autre** — `fmsave` tient une
table de dispositions par build et prévient quand il emprunte celle d'un autre.

## 3. Ce que `fmsave` lit sur les sauvegardes de Sylvain

**Projet** : `fmsave` (<https://github.com/rhiever/fmsave>, PyPI `fmsave`, doc
<https://rhiever.github.io/fmsave/>), Randal S. Olson, **licence MIT** (fichier `LICENSE` du
paquet). Python ≥ 3.12, dépendance `backports.zstd` (PSF-2.0, inclut la licence BSD de zstd).
Statut « Alpha ». Couverture annoncée : FM26 et FM27 ; build de référence FM27
`27.0.0+2486695`. Lecture seule, rien n'est envoyé sur le réseau (vérifié dans le code : aucun
`urllib`, `requests`, `socket`, `http.client`). Il existe aussi une version navigateur
(dépôt du fichier sur une page, lu localement).

Builds des sauvegardes (commande `fmsave info`) :

| Sauvegarde | Build | Date en jeu | Statut fmsave |
|---|---|---|---|
| FM27, la plus récente | `27.0.1+2494687` | 2026-08-17 | « unverified build, partial coverage » (emprunte les dispositions de `27.0.0+2486695`) |
| FM26, « Ligue 1 2037-09 » | `26.1.2+2255777` | 2037-11-04 | « unknown build » (emprunte celles de `26.3.2+2329565`) |
| FM24 | — | — | refus : « no game version found » |
| FM21 | — | — | refus : « the save directory could not be decompressed » |

Exports essayés (`fmsave export … --format csv`, sorties gardées dans le scratchpad) :

| Table | FM26 | FM27 | Durée / mémoire (FM27) |
|---|---|---|---|
| `managed-clubs` | 1 club | 1 club (nom, manager, solde, budget de recrutement) | 2,4 s / 0,4 Go |
| `players --managed-club` | 45 joueurs | 44 joueurs ; CA/PA plausibles, 218 colonnes (52 attributs, personnalité, postes, contrat) | 18 s / 0,5 Go |
| `player-season-stats --managed-club` | 285 lignes | 97 lignes | 28 s / 0,6 Go |
| `player-season-history --managed-club` | 1 093 lignes, saisons 2025 à 2037 | 2 lignes (début de carrière) | 27 s / 0,5 Go |
| `fixtures --managed-club` | **0** (contrôles échoués : `fixtures_minimum=0`) | 36 matchs | 15 s / 0,4 Go |
| `league-tables --all` | 550 tables, mais **compétitions non résolues** (`table_groups_resolved=0`) | 323 tables ; celle du club géré : 18 clubs, tous nommés, identifiant de compétition présent mais **nom vide** | 17 s / 0,4 Go |
| `finances --managed-club` | 60 lignes | 2 lignes | 6 s / 0,4 Go |

`fmsave validate --json` (rapport sans noms) : FM27 → 33 lecteurs sur 33 en `ok`, 27 champs
« verified » et 811 « unconfirmed » ; FM26 → 27 lecteurs `ok`, 5 en `failed` (`training`,
`mentoring`, `tactics`, `set_pieces`, `selections`), 489 champs « verified » et 349
« unconfirmed ». « Unconfirmed » veut dire décodé et passé les contrôles de cohérence, pas comparé
à l'écran du jeu.

**Lu** : identité et caractéristiques des joueurs, contrats, blessures, suspensions, staff, club
géré, finances (instantanés, monnaie du jeu non convertie), classements de la saison en cours,
calendrier et feuilles de match (FM27), statistiques de saison et historique des joueurs.

**Pas lu** : palmarès et historique du club par saison, historique du manager (sections
`tc_*_history_ls`) ; nom des compétitions (FM26 et FM27 sur ces builds) ; calendrier FM26 de ce
build ; tout FM21 à FM24.

## 4. Les autres pistes, et pourquoi elles ne servent pas

- **Équipes exportées** (`exported teams/*.fmf`, 12 à 115 Ko, une par saison chez Sylvain) : même
  en-tête `fmf.`, contenu étiqueté `moa.` / `VERSUS_TEAM_TYPE_HANDLER` puis des clés de 4 lettres
  (`anfP`, `tanN`…). C'est l'équipe du mode Versus : un effectif à un instant, sans résultats.
  Elles donnent au mieux les noms de l'effectif saison par saison pour FM23 et FM24. Aucun lecteur
  libre ; un décodeur maison serait possible (format étiqueté, plus lisible que `game_db`) mais
  n'apporte pas ce que demande L121.
- **Vues** (`views/*.fmf`) et **tactiques** (`tactics/*.fmf`) : réglages d'affichage et tactiques,
  pas des données de carrière.
- **Impression en page web** du jeu : aucun fichier de ce type dans le dossier. C'est la seule
  piste pour FM21 à FM24 sans rétro-ingénierie, mais elle exige de relancer chaque ancienne
  édition et d'exporter les écrans à la main ; elle n'est pas vérifiée ici.
- **Outils commerciaux ou de mémoire vive** (éditeurs en direct, scouts) : ils lisent le jeu en
  cours d'exécution sur Windows, pas un fichier ; écartés (pas de jeu lancé sur Big-Blue, pas de
  licence libre).
- **Rétro-ingénierie maison de FM21 à FM24** : faisable en théorie (le flux est décompressé, les
  noms sont en clair), mais c'est un travail de plusieurs jours par édition, sans référence pour
  vérifier, sur des éditions qui ne bougeront plus. **Déconseillé** : une saisie à la main des
  saisons passées (quelques lignes par carrière) coûte bien moins.

## 5. Découpage proposé (non codé)

Contrainte d'architecture : les sauvegardes sont sur le disque `E:` de Big-Blue et pèsent jusqu'à
234 Mo ; le serveur de dark-blue ne les voit pas. Donc **un import local** sur Big-Blue, qui
produit un petit résumé JSON, et c'est ce résumé, jamais la sauvegarde, qui part dans l'app.

| Lot | Contenu | Estimation |
|---|---|---|
| **I1 — Import local** | `scripts/fcnoobz-import/` (Python 3.12, venv, `fmsave==0.14.2` épinglé) : pour chaque dossier `Football Manager 26` / `27`, prend la sauvegarde la plus récente (hors `last save overwrite backup`), lance `fmsave validate` et refuse l'import si un lecteur utilisé n'est pas `ok` ; écrit `fcnoobz-resume.json` avec une **liste blanche** de champs (édition, build, date en jeu, club géré, division et place actuelles, bilan de la saison, meilleurs buteurs/notes, saisons de l'historique des joueurs). Tests sur un JSON d'exemple fabriqué, jamais sur une vraie sauvegarde. | 0,5 j |
| **I2 — Historique saison par saison** | Option A : le résumé de chaque sauvegarde est empilé par saison en jeu (`historique.json`, une entrée par (édition, saison)), ce qui reconstruit divisions et places au fil des sauvegardes déjà faites — dates en jeu à vérifier sur les 27 sauvegardes FM26. Option B : table tenue à la main pour FM21 à FM24 (club, saison, division, place, titre), même schéma. | 0,5 j |
| **I3 — Publication** | Le résumé est versionné dans `frontend/public/fcnoobz-data/` (comme `plan-data/`), commité par Sylvain après relecture : aucun appel réseau, aucune donnée brute. Test qui refuse tout champ hors liste blanche. Le contenu exact suit la fiche d'écran de L121. | 0,25 j |
| **L121** (existant) | L'écran, alimenté par I1 à I3. | (déjà estimé) |
| **I4 — Veille (optionnel)** | Une ligne dans le lot mensuel des technos : version de `fmsave` et build de FM27 couvert ; un patch de FM27 peut casser la lecture jusqu'à la version suivante de `fmsave`. | — |

## 6. Questions pour Sylvain (aucune ne bloque cette étude)

1. **Quels champs sont publics ?** `/fcnoobz` est sur Internet : club, places et titres sans doute ;
   finances, attributs, notes des joueurs, peut-être pas. La liste blanche d'I1 en dépend.
2. **FM21 à FM24** : saisie à la main des saisons (option B), ou rien avant FM26 ?
3. **Rythme** : l'import se lance à la main après une session de jeu, ou par une tâche planifiée
   de Big-Blue ?
4. **Conditions de Sports Interactive** : non lues. Lire sa propre sauvegarde chez soi n'est pas
   publier les données du jeu, mais le résumé publié contient des noms de joueurs réels tirés de
   la base du jeu ; à vérifier avant I3 si on publie plus que le parcours du club.
