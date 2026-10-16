---
title: "Page du match : chaque équipe de son côté, le match au centre"
date: 2026-10-16
created: 2026-10-16T10:25+02:00
lots: [L160]
captures: [{ file: captures/match-ecran-fm-L160.png, alt: "Page du match à 1440 px : la composition et les statistiques de Lyon à gauche, celles de Lens à droite, et au centre les faits, le Momentum, la carte des tirs et les statistiques comparées" }]
---
La page d'un match se lit désormais comme un écran de match de Football Manager. Sur un grand écran (à partir de 1440 px), l'équipe qui joue à domicile a sa colonne à gauche, avec sa composition puis ses statistiques, et l'équipe visiteuse a la sienne à droite. Le centre rassemble l'en-tête du score, les faits du match, le Momentum, la carte des tirs, les statistiques comparées, les joueurs en vue et le classement en direct. Les deux terrains de composition ont la même hauteur, quelle que soit la formation, et les statistiques d'équipe commencent au même niveau des deux côtés. Un bloc sans donnée disparaît sans laisser de trou. Sur un écran plus étroit, tout s'empile en une colonne, dans le même ordre de lecture.

Les couleurs suivent le club, pas le côté : l'OL est toujours en rouge et l'adversaire toujours en bleu, à domicile comme à l'extérieur, dans les barres, le Momentum et la carte des tirs, avec un contraste plus net. Un match à venir affiche les deux compositions probables chacune sur son côté.

## Hypothèses

- R7 — Le terrain de composition fait 360 px de haut à toute largeur ; si c'est trop ou trop peu, la hauteur change, pas la disposition.
- R9 — Les statistiques d'équipe latérales listent les mesures hors possession, tirs, tirs cadrés et xG ; si une autre répartition est préférée, ces lignes changent de bloc.
- R10 — Sous 1440 px, l'ordre d'empilement est : en-tête, faits, Momentum, tirs, statistiques comparées, équipe à domicile, équipe visiteuse, joueurs en vue, classement.
- R15 — Le xG garde le point décimal (« 1.87 ») ; le passage à la virgule n'est pas fait ici.
