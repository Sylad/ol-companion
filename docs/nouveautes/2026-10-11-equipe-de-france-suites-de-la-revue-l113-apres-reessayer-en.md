---
title: "Équipe de France : « Réessayer » plus clair, effectif sans « 0 ans »"
date: 2026-10-11
created: 2026-10-11T13:01+02:00
lots: [L118]
captures: []
nocapture: l'état montré (échec puis nouvel essai de 365scores) ne se reproduit pas à volonté en prod, il est couvert par des tests
---
Sur la page Équipe de France, quand le chargement échoue, le message d'erreur remplace toute la page au lieu de s'afficher au-dessus d'anciennes données. Un clic sur « Réessayer » affiche de nouveau « Chargement de l’équipe de France… » le temps du nouvel appel.

Si 365scores ne donne pas l'âge d'un joueur, la ligne n'affiche plus « 0 ans » : l'âge est simplement omis. Quand 365scores répond de façon incomplète ou tombe en panne, la page continue de montrer les dernières données connues, sans relancer la lecture à chaque visite.
