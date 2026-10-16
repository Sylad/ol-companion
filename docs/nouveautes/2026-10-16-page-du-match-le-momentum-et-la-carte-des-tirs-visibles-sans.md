---
title: "Page du match : le momentum et la carte des tirs visibles sans défiler"
date: 2026-10-16
created: 2026-10-16T13:10+02:00
lots: [L161]
captures: [{ file: captures/match-faits-bornes-L161.png, alt: "Page du match à 1440 px : le bloc Faits du match n'affiche que cinq faits, avec le repère « 13 faits plus anciens » et une fine barre de défilement à piste bordée de bleu et curseur bleu foncé bordé de rouge ; le Momentum est entièrement visible dessous" }]
---
Sur la page d'un match, le bloc « Faits du match » ne prend plus toute la hauteur de l'écran. Il montre les cinq faits les plus récents ; pour lire les plus anciens, on fait défiler la liste dans le bloc. Le Momentum et la carte des tirs remontent ainsi dans l'écran, sans avoir à faire défiler la page, y compris sur un vrai match de 18 à 20 faits.

Le titre du bloc indique le nombre de faits, et une ligne au-dessus de la liste dit combien sont hors de la vue (« 13 faits plus anciens ») ; un clic dessus remonte la liste de cinq faits, et « Début du match » s'affiche une fois en haut. La barre de défilement est fine, sans flèches : piste bordée de bleu néon, curseur bleu foncé bordé de rouge qui s'illumine au survol ; le bloc a la bordure néon rouge et bleu du site. Sur un très petit écran, les noms des joueurs ne sont jamais coupés.

## Hypothèses

- R3 — Le repère « N faits plus anciens » est un bouton au-dessus de la liste ; si ce n'est pas voulu, la liste n'a plus que sa barre de défilement, invisible sur téléphone.
- R5 — Les lignes ont une hauteur fixe (44 px, 60 px sous 390 px) et la liste démarre en bas sans script ; si une autre mise en œuvre est préférée, l'aspect reste le même.
