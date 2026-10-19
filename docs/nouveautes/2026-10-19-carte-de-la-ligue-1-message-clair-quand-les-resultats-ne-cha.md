---
title: "Carte de la Ligue 1 : message clair quand les résultats ne chargent pas"
date: 2026-10-19
created: 2026-10-19T16:20+02:00
lots: [L194]
captures:
  - { file: captures/carte-l1-erreur-L194-1440.png, alt: "Page Carte Ligue 1 à 1440 px quand les résultats ne chargent pas : le message « Impossible de charger les résultats de la saison. » et le bouton Réessayer à la place de la carte" }
  - { file: captures/carte-l1-erreur-L194-390.png, alt: "Page Carte Ligue 1 à 390 px quand les résultats ne chargent pas : le message « Impossible de charger les résultats de la saison. » et le bouton Réessayer à la place de la carte" }
---
Quand les résultats de la saison ne se chargent pas, la carte de la Ligue 1 le dit au lieu d'afficher des informations fausses.

- Pendant l'attente, la page affiche « Chargement de la carte… ».
- Si le chargement échoue, un message « Impossible de charger les résultats de la saison. » et un bouton « Réessayer » remplacent la carte.
- Plus de marqueurs tous marqués « Pas encore joué », ni de fiches de club qui annoncent « Pas de match OL recensé », alors que les matchs existent simplement sans avoir pu être lus.
- Si un rafraîchissement échoue alors que la carte est déjà affichée, elle reste telle quelle.
