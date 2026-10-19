---
title: "Match : tout l'essentiel sur un écran"
date: 2026-10-19
created: 2026-10-19T08:28+02:00
lots: [L186]
captures: [{ file: captures/L186-match-1440.png, alt: "Page d'un match à 1440 px : statistiques et Momentum côte à côte sous les faits du match, carte des tirs et joueurs en vue en dessous" }, { file: captures/L186-match-390.png, alt: "Page d'un match à 390 px : tous les blocs empilés dans l'ordre de lecture" }]
---
Sur la page d'un match, les blocs sont regroupés pour voir plus de choses sans faire défiler la page.

- Les **statistiques** et le **Momentum** sont côte à côte, à la même hauteur, sous les faits du match. Le Momentum est moins haut.
- La **carte des tirs** est plus petite, avec le terrain à la verticale (un but en haut, un but en bas). On y voit les mêmes tirs des deux équipes ; le club à domicile attaque vers le haut, ce que disent les libellés « ↓ Visiteur attaque » et « Domicile attaque ↑ ».
- À droite de la carte, **Joueurs en vue** et **Classement en direct** sont empilés.
- Sur un écran étroit, tout reste empilé dans l'ordre de lecture : faits, statistiques, Momentum, carte des tirs, joueurs en vue, classement, puis les compositions.

Aucune donnée ni animation n'est retirée.

## Hypothèses

- R7 — le terrain des compositions fait 360 px de haut à toute largeur ; si ce n'est pas la bonne hauteur, seule cette valeur change.
- R9 — les statistiques d'équipe de chaque côté listent leurs valeurs seules, les quatre mesures comparées restant au centre ; si le partage est autre, seuls les libellés déplacés changent de bloc.
- R10 — sous 1024 px les compositions viennent après le classement ; si on les préfère plus haut, c'est l'ordre des blocs qui change.
