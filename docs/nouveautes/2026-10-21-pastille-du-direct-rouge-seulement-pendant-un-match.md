---
title: "Pastille du direct : rouge seulement pendant un match"
date: 2026-10-21
created: 2026-10-21T19:16+02:00
lots: [L208]
captures: []
nocapture: la pastille est un petit élément d'état (point, libellé), sans écran dédié ; le backend n'étant pas lancé dans cette session, aucun match en cours n'est reproductible pour une capture fidèle
# une capture peut dire ce qu'elle montre : captures: [{ file: captures/x.png, alt: "texte alternatif" }]
# nocapture: raison, quand une capture n'a pas de sens
---
La pastille du flux temps réel (barre latérale au bureau, en haut de page sur téléphone) n'est plus rouge en permanence. Elle écrit maintenant l'état de la connexion : « Temps réel · connecté », « Temps réel · reconnexion… » ou « Temps réel · en attente ».

Le point rouge qui pulse n'apparaît que pendant un match en cours ; le reste du temps, le point est gris et immobile. Les lecteurs d'écran annoncent le changement d'état, par exemple une reconnexion.
