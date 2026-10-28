---
title: "Calendrier : des messages plus clairs quand il n'y a rien à afficher"
date: 2026-10-28
created: 2026-10-28T08:02+01:00
lots: [L51]
captures:
  - { file: captures/calendrier-erreur-L51-390.png, alt: "Calendrier sur téléphone : « Erreur de chargement. » en rouge lisible avec un bouton « Réessayer »" }
  - { file: captures/calendrier-vide-L51.png, alt: "Calendrier sur téléphone : un filtre sans match affiche « Aucun match dans cette catégorie. » et un bouton « Afficher tous les matchs »" }
  - { file: captures/calendrier-cumul-L51.png, alt: "Calendrier sur téléphone : le match retour du 3e tour de qualification affiche « Cumul 4-2 » sous « Terminé »" }
---
Quand un filtre du calendrier ne laisse aucun match, un bouton « Afficher tous les matchs » remet « Toutes » et « Tout » d'un clic, et le lecteur d'écran annonce le message « Aucun match dans cette catégorie. ». Le message d'erreur de chargement est lu à voix haute dès qu'il apparaît, son rouge est plus lisible et un bouton « Réessayer » relance le chargement. Sur le match retour d'une qualification, la ligne indique le score cumulé des deux manches (« Cumul 4-2 ») sous « Terminé ».
