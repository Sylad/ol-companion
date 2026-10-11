---
title: "Calendrier : une liste plus compacte, regroupée par mois"
date: 2026-10-11
created: 2026-10-11T21:04+02:00
lots: [L50]
captures: [{ file: captures/L50-calendrier-390.png, alt: "Calendrier au téléphone après défilement : les filtres restent collés en haut, la liste est découpée en blocs par mois, chaque ligne porte sa compétition (L1 · J7, C3 · J3)" }]
# une capture peut dire ce qu'elle montre : captures: [{ file: captures/x.png, alt: "texte alternatif" }]
# nocapture: raison, quand une capture n'a pas de sens
---
Le Calendrier est plus court à parcourir. La liste est découpée en un bloc par mois (« Octobre 2026 », avec le nombre de matchs du mois) : la colonne de date ne donne plus que le jour et le quantième, et chaque ligne indique sa compétition à droite (« L1 · J6 », « C3 · J2 »), les qualifications montrant leur tour et leur manche sous les équipes. Au téléphone, les filtres de compétition et de statut restent collés en haut de l'écran pendant le défilement, la légende des sigles reste lisible sous la barre, et la vue rapide tient sur une ligne pour que le premier match apparaisse dès l'ouverture. Les cartes « Prochain » et « Dernier résultat » sont cliquables sur toute leur surface, un chevron le signale. Les filtres retirent aussi les mois sans match, et le nombre affiché sur chaque pastille tient compte de l'autre filtre, pour voir qu'un choix ne donne rien avant de cliquer.

## Hypothèses

- R9 — au téléphone, la vue rapide tient sur une ligne et les deux cartes sont resserrées ; si elle doit garder son format actuel, seul le style de ce bloc change.
- R10 — un match dont le jour n'est pas fixé est rangé dans le mois de sa date de remplissage, et les nombres des pastilles suivent l'autre filtre ; si un week-end à cheval sur deux mois doit aller dans l'autre, ou si les nombres doivent rester ceux de toute la saison, seul le calcul de regroupement ou de comptage change.
