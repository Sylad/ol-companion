# Carte d'ol-companion (écrans, workflows, décisions)

## Accueil (`/`)
- Bloc « OL en chiffres — saison en cours » (`components/season-summary.tsx`, `/api/season-matches/team-stats`) :
  4 tuiles, graphique Recharts « Évolution diff. de buts cumulée » (`data-testid="graphique-diff-buts"`), puces par compétition.
- **L256** : marge gauche du graphique à 0, jamais négative (à -12, « -4 » partait à x = -3 px et se lisait « 4 »,
  « 12 » se lisait « I2 »). `YAxis width={28}` suffit jusqu'aux étiquettes de 3 caractères (« -40 » mesuré à x ≥ 0).
  Test Chromium `frontend/tests-navigateur/accueil-axe-diff-buts.test.ts` : chaque étiquette dans le SVG et à gauche
  de la grille, à 320, 390, 768, 1024 et 1440 px, axes -4…12 et -24…36 (`npm run test:navigateur`).

## Workflows
- Une mise en page de graphique se mesure dans Chromium (`tests-navigateur/`), jamais dans jsdom (aucune mesure de texte).

## Accueil — tuile « Bilan championnat » (L257, ex-« Forme »)
- `components/dashboard-stats.tsx` : le gros chiffre (« 5V ») est le bilan de Ligue 1 de la saison ; sous-texte
  « 2N · 3D en 10 matchs ». La bande de pastilles a son propre libellé visible « Forme · N derniers matchs »
  (« Forme · dernier match » pour 1) et un groupe nommé « … de Ligue 1, du plus ancien au plus récent ».
  Avant, « 5V » sous « Forme » au-dessus de D V D V D se lisait « 5 victoires de suite » (revue UX L255, M2).
- Décision : libellé sans chiffre (« Bilan championnat », pas « Bilan Ligue 1 ») car l'acceptation L85 interdit tout
  chiffre et « Ligue 1 » dans une tuile en chargement ; `data-testid="stat-forme"` gardé.
- Tests : `dashboard-stats.test.tsx` (L257 R1–R4), Chromium `tests-navigateur/accueil-tuile-forme.test.ts`
  (320, 390, 1440 : textes dans la tuile, sans recouvrement ; `CAPTURES_DIR` enregistre les captures).

## Tailles de texte (L258, revue UX L255 M3)
- Échelle unique en rem : `frontend/src/theme/typographie.ts` (petite 12 / moyenne 14 / grande 16 px + pas d'appoint),
  branchée sur Tailwind et tailwind-merge ; racine à 100 %. `src/theme/typographie.test.ts` refuse toute taille en px dans `src/`.
- Pastilles de forme V/N/D (accueil, classement) : lettre 12 px dans un rond de 1,25 rem (20 px). Notes du terrain (/players) :
  12 px dans une pastille de 1,25 rem de haut, accrochée au rond du joueur (avant : au coin du bloc, qui suit la largeur du nom).
- Terrain de /players : à 12 px deux noms voisins ne tiennent plus à 320 px → `plafondNom` partage la place entre voisins
  (écart 4 px, nom tronqué avec « … » et nom complet en title), en plus du recalage de bord L76.
- Calendrier : colonne de date 56 → 60 px, « Horaire à confirmer » et la compétition en interligne 1 : la densité L124 tient (≤ 54 px).
- Décision : exception unique au plancher, les noms d'un mot trop long des pastilles de composition (/match) descendent
  à la mesure jusqu'à 8 px (règle L43 : jamais coupés ni tronqués ; 52 px de pastille à 320 px).
- Tests Chromium : `tests-navigateur/tailles-texte-L258.test.ts` (390 et 1440 px, et la racine à 20 px fait passer les lettres à 15 px).
- **Corrections après revue (L258)** :
  - Calendrier sous 360 px (colonne de 40 px, jour à 12 px) : un jour ferme passe à la ligne à l'espace (« Sam. » / « 22 ») ;
    « Week-end », qui ne se coupe jamais au trait d'union (L100), s'abrège en « WE » (`abbr` « Week-end ») sur « 05/12 » ;
    formes entières en sr-only. Chromium `calendrier-densite.test.ts` : aucun texte de date sur les équipes à 320/359/360/390/1440.
    Les acceptations L50 lisent le texte exposé (sans `aria-hidden`).
  - Note des joueurs du terrain (/players) : posée sur le haut du rond à partir de son centre, `-top-[0.625rem]`, son bas au-dessus
    de l'encre des chiffres ; nom à 4 px du rond (`gap-1`). Contraintes mesurées à 320 px : à côté du rond elle touche le rond
    voisin (défenseurs à 26 %), plus haute le nom de la ligne du dessus (lignes 4/5 à 14 %). Son dépassement se mesure depuis le
    rond (`placerJoueurDeBord.debord`), pas depuis le bloc du nom. Test Chromium : encre des chiffres via `measureText`.
  - `typographie.test.ts` refuse aussi `fontSize={n}` / `fontSize="n"` (JSX, SVG), `font: … px`, `${n}px`, et rem/em < 0,75.

## Classement (`/standings`) — premier écran au téléphone (L259, revue UX L255 M4)
- Ordre de la page, à toute largeur : bandeau OL **compact** (une ligne sous 1024 px), section « Classement » (H1),
  puis « Tracker de classement » (H2) en dessous. Avant : tracker d'abord, tableau à y = 815 à 320 px, H2 avant H1.
- Lien « Voir l'OL (Ne) ↓ » au-dessus du tableau, sous 768 px seulement (`md:hidden`, 24 px de haut) : centre la ligne
  de l'OL (`tr#ligne-ol`, `tabIndex=-1`) et y pose le focus. Pas dans l'en-tête de section : à 320 px il poussait
  « Actualiser » hors du cadre.
- Bureau 1440 : mêmes blocs, tableau au-dessus du tracker.
- Test Chromium `tests-navigateur/classement-premier-ecran-L259.test.ts` : 320×800 et 390×844, 1re ligne et Lyon 5e
  au-dessus de la barre du bas ; Lyon 17e atteint par le lien, sous l'en-tête collant, focus sur sa ligne ; ordre des
  titres (H1 d'abord, sans saut) et tableau avant tracker à 320, 390, 1440.

## Plancher de 12 px mesuré sur la page (L261, QA du 18-11)
- Test Chromium `tests-navigateur/plancher-12px-L261.test.ts` : les 16 pages des attendus + la 404, à 390 et 1440 px
  (onglets Effectif / Stats saison de /players compris), `getComputedStyle(el).fontSize` de tout élément porteur de texte
  visible ; AUCUNE exception. Données : réponses réelles de l'API de prod du 18-11 (`tests-navigateur/donnees/api-prod-2026-11-18.json`),
  horloge figée au 18-11 13 h 10. Une page ou un endpoint nouveau s'ajoute à `PAGES` / au fichier de données.
- `sup`, `sub`, `small` : `font-size: max(0.75rem, 0.83em)` (`index.css`) — le « e » de « 5e » du tracker était à 9 px.
- Composition de /match (L269, D-1 : le quinconce de L261 coupait la défense à 4 de Lille – Lyon en 2 + 2, refusé par
  Sylvain) : une rangée de la formation = une ligne, toujours ; noms à 12 px, jamais réduits (`TAILLES_NOM_PASTILLE`
  supprimé). Pastille `flex: 0 1 <largeur commune>` sans `min-w-0` : elle ne descend pas sous son mot le plus large, les
  voisines cèdent. Dernier recours (`useNomsCoupes`, `lib/coupure-nom.ts`, `data-coupe`) : si une rangée ne tient pas même
  ainsi, ses noms les plus larges, un à un, reçoivent des césures syllabiques (trait d'union visible). Tests :
  `lib/coupure-nom.test.ts` et le bloc L269 du test Chromium (Lille – Lyon 4-3-3 / 4-2-3-1, Brest – Lyon, France – Turquie,
  320/390/1366/1440 : même haut par rangée à 1 px, 12 px, nom entier, disjointes, dans le terrain).
- README, puce « Classement Ligue 1 » : ordre bandeau → tableau → tracker et lien « Voir l'OL (Ne) » (suite de L259).

## Carte L1 — contraste des marqueurs (L275) et halo de l'OL
- Marqueurs ≥ 3:1 sur les tuiles OSM claires ET sur le fond sombre : contour double (anneau sombre dehors, clair dedans),
  nul à 41 %, défaite `LOSS_RED`, lettre des pastilles de la fiche blanche partout (`lib/ligue1-map-colors.ts`).
- Pastille de l'OL (`olMarkerHtml`, carte et légende) : seul l'anneau sombre de 2 px est plein, puis une lueur floue.
  L'anneau rosé de 3 px ajouté en L275 portait le halo plein à 5 px hors de la boîte, sur « Pas encore joué » à 390/320
  (4 px d'écart) : retiré plutôt que d'écarter les rangées de la légende (même dessin pour la carte et la légende).
- Mesures Chromium : `tests-navigateur/legende-halo-ol-L275.test.ts` (1440, 390, 320 : halo plein hors du libellé et des
  autres rubriques), `carte-contraste-L275.test.ts` (contrastes, légende = carte). README « Carte L1 » à jour.
