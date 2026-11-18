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
