---
title: Une page dédiée à l'équipe de France
date: 2026-10-11
created: 2026-10-11T12:16+02:00
lots: [L113]
captures: [{ file: captures/L113-equipe-de-france.png, alt: "Page Équipe de France : prochain match, cinq derniers résultats avec badge V/N/D, effectif par poste" }]
# une capture peut dire ce qu'elle montre : captures: [{ file: captures/x.png, alt: "texte alternatif" }]
# nocapture: raison, quand une capture n'a pas de sens
---
Une nouvelle page « Équipe de France » réunit les Bleus au même endroit. Elle montre le prochain match, les cinq derniers résultats (du plus récent au plus ancien, toutes compétitions, écrits « Domicile – Extérieur » comme le calendrier, avec une pastille V, N ou D vue de la France) et l'effectif groupé par poste (gardiens, défenseurs, milieux, attaquants) avec l'âge de chaque joueur. Quand l'heure du prochain match n'est pas fixée, la page ne l'invente pas : elle écrit « Week-end du JJ/MM · Horaire à confirmer » ou « Date et horaire à confirmer ». La page se trouve dans la barre latérale, après « Carte L1 », et dans le panneau « Plus » au téléphone. Pendant le chargement, en cas d'erreur (avec un bouton « Réessayer ») ou sans donnée, un message l'explique.

## Hypothèses

- R1 — le message de chargement est un simple texte « Chargement de l’équipe de France… » ; si on préfère un squelette, seul l'aspect change.
- R7 — l'heure du prochain match est tenue pour non fixée au-delà de 14 jours (365scores seul) ; si le seuil est faux, seul l'affichage de la date change.
- R8 — l'effectif donne le nom et l'âge, sans fiche joueur ni numéro ; si on veut des fiches ou des numéros, des champs s'ajoutent à la ligne.
- R9 — la page est dans la barre latérale et derrière « Plus » au téléphone ; si elle doit être dans la barre du bas, seule la liste de navigation change.
