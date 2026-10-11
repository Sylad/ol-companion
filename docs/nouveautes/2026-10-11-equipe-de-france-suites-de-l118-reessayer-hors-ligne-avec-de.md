---
title: "Équipe de France : l'effectif reste affiché si 365scores répond mal"
date: 2026-10-11
created: 2026-10-11T14:54+02:00
lots: [L119]
captures: [{ file: captures/L119-equipe-de-france-effectif.png, alt: "Page Équipe de France : prochain match, derniers résultats et effectif par poste" }]
---
Sur la page Équipe de France, quand 365scores répond sans la liste des joueurs, l'effectif n'est plus vidé pendant 10 minutes et les dernières données connues restent affichées ; la lecture est retentée au bout d'une minute.

Si le serveur vient de redémarrer pendant une panne de 365scores, la page affiche l'erreur et « Réessayer » sans que chaque visite relance toute la lecture : un nouvel essai a lieu au plus une fois par minute.

Hors ligne, « Réessayer » affiche de nouveau « Chargement de l’équipe de France… » même quand des données étaient déjà à l'écran, et le curseur du clavier reste sur la page.
