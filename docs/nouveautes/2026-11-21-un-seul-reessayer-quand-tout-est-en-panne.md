---
title: "Un seul « Réessayer » quand tout est en panne, et une appli plus lisible au lecteur d'écran"
date: 2026-11-21
created: 2026-11-21T16:10+01:00
lots: [L260]
captures:
  - { file: captures/L260-un-seul-reessayer-1440.png, alt: "Accueil à 1440 px pendant une panne du serveur : un seul bouton Réessayer, sous le prochain match, avec la phrase « Impossible aussi de charger le classement, le dernier résultat, les statistiques de la saison et l'évolution du classement. « Réessayer » relance tout. » ; les autres blocs gardent leur message seul" }
  - { file: captures/L260-un-seul-reessayer-390.png, alt: "La même panne à 390 px (téléphone) : un seul bouton Réessayer en haut de page, les autres blocs disent seulement ce qui n'a pas pu être chargé" }
---
Quand le serveur ne répond plus, l'accueil affichait cinq boutons « Réessayer », un par bloc. Il n'y en a plus qu'un, sur le premier bloc de la page : il dit ce qui a échoué ailleurs et relance tout d'un coup. Un lecteur d'écran l'annonce en une seule fois, ce qui a échoué ailleurs compris, au lieu de ne lire que le premier message. Les messages disent aussi ce qui manque : « Impossible de charger le calendrier » au lieu de « Erreur de chargement ».

D'autres retouches, surtout utiles avec un lecteur d'écran ou au doigt :

- les titres de pages se suivent dans l'ordre (le calendrier et À propos sautaient un niveau) ;
- les écussons posés à côté du nom du club ne le répètent plus à voix haute, et les émojis décoratifs (⚽, 🟨, ↔…) ne sont plus lus : un remplacement se lit « Kana remplace Romeo » ;
- la page introuvable porte le titre « Page introuvable » dans l'onglet ;
- les derniers mots anglais sont traduits : « Accueil » au lieu de « Dashboard », « Évolution du classement », la pile technique d'À propos, « © les contributeurs d'OpenStreetMap », et le lien de la barre latérale vers le site des supporters porte son nom, « Olympique et Lyonnais », au lieu de « OL News » ;
- la carte dit « Choisissez un club » plutôt que « Cliquez », qui ne va pas au téléphone ;
- sur la page Actu, « Voir les autres chaînes » est plus facile à toucher, et toute la carte d'un article répond au clic, pied compris ;
- les liens de retour des pages de match et de joueur sont plus faciles à toucher.
