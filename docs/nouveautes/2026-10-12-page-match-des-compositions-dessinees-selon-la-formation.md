---
title: "Page match : des compositions dessinées selon la formation"
date: 2026-10-12
created: 2026-10-12T08:43+02:00
lots: [L43]
nocapture: la page Match exige un match 365scores réel (réseau) ; les captures de référence sont celles de la maquette, docs/specs/composition-match/
# une capture peut dire ce qu'elle montre : captures: [{ file: captures/x.png, alt: "texte alternatif" }]
# nocapture: raison, quand une capture n'a pas de sens
---
Sur la page d'un match, les blocs « Composition » suivent maintenant la formation annoncée : un 4-2-3-1 se dessine en cinq rangées (1, 4, 2, 3, 1) et un 4-1-4-1 aussi (1, 4, 1, 4, 1), au lieu de six ou sept rangées. Les rangées sont centrées, comme le terrain de la page Joueurs : l'attaquant seul et le gardien sont au milieu, et toutes les pastilles ont la même largeur. Chaque pastille met le numéro de maillot au-dessus du nom, et un nom ne se coupe plus qu'après un tiret (« Maitland-Niles » passe sur deux lignes, « Frankowski » reste entier). Le numéro des joueurs adverses est plus clair, donc plus lisible. Quand la formation n'est pas annoncée, le bloc garde le regroupement par position et l'écrit dans une note.

## Hypothèses

- R5 — sans formation annoncée (ou si elle ne compte pas 10 joueurs de champ), le bloc regroupe les joueurs par position, sans pastille de formation, avec la note « Formation inconnue : rangées lues d’après les positions annoncées. » ; si ce n'est pas le comportement voulu, le bloc devrait plutôt rester masqué ou afficher une liste simple.
