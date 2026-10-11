---
title: "Accueil : pas de faux « Aucun match » au chargement, Réessayer en cas d'erreur"
date: 2026-10-11
created: 2026-10-11T21:51+02:00
lots: [L85]
captures: [{ file: captures/L85-accueil-erreur.png, alt: "Accueil quand le serveur ne répond pas : messages « Impossible de charger… » avec bouton Réessayer, tuiles à « — »" }]
# une capture peut dire ce qu'elle montre : captures: [{ file: captures/x.png, alt: "texte alternatif" }]
# nocapture: raison, quand une capture n'a pas de sens
---
Sur l'accueil, plus de fausses valeurs pendant le chargement : le prochain match et le dernier résultat sont remplacés par un cadre « Chargement… », et les quatre tuiles (position, points, différence de buts, forme) affichent « — » au lieu de « Points 0 » ou « Forme 0V ». Si le serveur ne répond pas, chaque bloc le dit (« Impossible de charger le prochain match. », « … le dernier résultat. », « … le classement. ») avec un bouton « Réessayer ». Quand il n'y a vraiment aucun match à venir, la carte l'écrit et propose un lien « Voir le calendrier ». Avec les données, l'écran reste comme avant.

## Hypothèses

- R3 — l'erreur du classement ne tient pas compte de la tendance de position ; si elle doit en tenir compte, seule la condition du message change.
- R4 — le dernier résultat a son propre message et son propre « Réessayer » (même appel que le prochain match) ; un seul bouton suffirait, au prix d'un message en moins.
- R7 — sans match terminé, le bloc « Dernier résultat » reste absent sans message ; si un message est voulu, un champ s'ajoute.
