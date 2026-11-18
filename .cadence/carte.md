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
