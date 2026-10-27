---
title: "Fiche joueur : le bouton Réessayer garde sa place quand le réseau revient"
date: 2026-10-27
created: 2026-10-27T23:25+01:00
lots: [L225]
captures:
  - { file: captures/L225-reessayer-hors-ligne-390px.png, alt: "Fiche joueur sur téléphone, hors ligne : le bloc d'erreur reste avec le bouton « Nouvel essai… »" }
  - { file: captures/L225-retour-reseau-1440px.png, alt: "Fiche joueur sur ordinateur, réseau revenu : le même bloc et le même bouton, sans écran de chargement" }
# une capture peut dire ce qu'elle montre : captures: [{ file: captures/x.png, alt: "texte alternatif" }]
# nocapture: raison, quand une capture n'a pas de sens
---
Sur la fiche d'un joueur dont les statistiques n'ont pas pu être chargées, un clic sur « Réessayer » sans réseau laisse le bloc d'erreur en place, avec le bouton « Nouvel essai… ». Quand le réseau revient, la fiche se charge sans que « Chargement du joueur… » remplace le bloc : le bouton n'est plus retiré de l'écran et le focus clavier reste dessus jusqu'à la réponse.
