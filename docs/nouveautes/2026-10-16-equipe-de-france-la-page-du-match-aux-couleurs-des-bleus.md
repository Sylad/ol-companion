---
title: "Équipe de France : la page du match aux couleurs des Bleus"
date: 2026-10-16
created: 2026-10-16T22:00+02:00
lots: [L167]
captures: [{ file: captures/match-bleus-1440.png, alt: "Page d'un match des Bleus : la France en bleu, l'adversaire en blanc, bordure bleu-blanc-rouge sur les faits du match" }, { file: captures/match-bleus-390.png, alt: "La même page sur téléphone" }]
---
Depuis la page Équipe de France, chaque match de la liste « Derniers résultats » s'ouvre maintenant sur sa page : score, faits du match, Momentum, carte des tirs, statistiques, compositions et joueurs en vue, comme pour un match de l'OL.

Cette page prend les couleurs des Bleus : la France en bleu, son adversaire en blanc, le rouge réservé aux accents (pastille « Live », bordure du bas). Les faits du match ont une bordure bleu-blanc-rouge, et la barre de défilement reprend le thème des Bleus. Il n'y a pas de classement en direct, puisque le match n'est pas de Ligue 1.

Le jour d'un match, le bloc « Prochain match » affiche un bouton « Voir le match », de minuit jusqu'à 3 h après le coup d'envoi. Une fois le match commencé, une pastille « En direct » remplace la date. Un match à venir annonce sa date et son heure en haut de la page, et dit que les statistiques apparaîtront au coup d'envoi.

Les noms d'équipe de l'en-tête, même longs (« Bosnie-Herzégovine »), restent lisibles sur un petit écran.

## Hypothèses

- R3 — la page est aux couleurs des Bleus dès que la France figure dans l'adresse du match ; si ce choix est faux, un match des Bleus s'ouvrirait d'abord aux couleurs de l'OL.
- R4 — le bleu et le blanc des équipes sont assez contrastés sur le fond sombre ; si ce n'est pas le cas, les teintes sont à ajuster.
- R8 — le lien de retour s'appelle « Équipe de France » et ramène à cette page.
- R10 — en cas d'erreur, le lien dit « Retour à l'équipe de France ».
- R11 — un match à venir affiche sa date et son heure dans l'en-tête, sans les blocs Faits, Momentum et tirs.
