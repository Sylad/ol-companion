---
title: "Page du match : une panne n'est plus « introuvable »"
date: 2026-10-18
created: 2026-10-18T19:34+02:00
lots: [L181]
captures:
  - { file: captures/L181-match-panne-390.png, alt: "Page d'un match sur téléphone quand le serveur ne répond pas : message « Impossible de charger le match », boutons « Réessayer » et « Retour à l'accueil »" }
---
Sur la page d'un match, une panne n'est plus confondue avec un match qui n'existe pas. Quand le serveur ne répond pas ou que vous êtes hors ligne, la page écrit « Impossible de charger le match » et propose un bouton « Réessayer » à côté du retour à l'accueil. « Match introuvable » n'apparaît plus que pour une adresse qui ne mène vraiment à aucun match. Un chargement qui ne reçoit aucune réponse ne tourne plus indéfiniment : au bout de 15 secondes, la page passe elle aussi à « Impossible de charger le match ».

Si le rafraîchissement automatique échoue alors qu'un match est déjà affiché, la page garde le match à l'écran au lieu de l'effacer. Chaque état de la page (chargement, panne, introuvable) a maintenant son titre, pour les lecteurs d'écran.
