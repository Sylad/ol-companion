# Étude de faisabilité — sources de statistiques (Sofascore, DataScout)

Lot L236, demande de Sylvain du 2026-11-01. Étude rédigée le 2026-11-02. Aucun code de l'app, aucun compte, aucun achat, aucune démarche auprès d'un éditeur.

## Verdict

| Source | Utilisable par l'app ? | Pourquoi |
|---|---|---|
| Sofascore | **Non** | API non publique, 403 renouvelé le 2026-11-02 depuis Big-Blue ; aucune licence d'usage relevée ; contourner le blocage est exclu |
| DataScout | **Non** (rien à intégrer) | Pas un fournisseur de données : compte X d'un analyste, sans API, sans site ni licence connus |

Aucune des deux ne remplace ni ne complète 365scores dans l'app. Pour des xG/npxG gratuits, les pistes à étudier sont listées en fin de document (non mesurées).

## Sofascore

**Données en plus de 365scores** (d'après ce qu'affiche le site, non mesuré ici) : notes de joueurs, xG, heatmaps, statistiques détaillées par joueur. L'app s'est déjà posé la question : les règles du projet gardent Sofascore comme source de repli pour des stats que 365scores n'a pas.

**Accès réel mesuré — 2026-11-02, depuis Big-Blue (WSL), `curl` avec un User-Agent de navigateur, sans en-tête falsifié :**

| URL | Statut | Réponse |
|---|---|---|
| `https://api.sofascore.com/api/v1/team/1649` | 403 | `{"error": {"code": 403, "reason": "Forbidden" }}` (`server: Varnish`) |
| `https://www.sofascore.com/api/v1/team/1649` | 403 | idem |
| `https://api.sofascore.com/api/v1/unique-tournament/34/seasons` | 403 | idem |
| `https://www.sofascore.com/robots.txt` | 403 | idem |
| `https://www.sofascore.com/terms-and-conditions` | 403 | idem |

Échantillon de données : aucun, pas une ligne obtenue. Le blocage touche même `robots.txt` et les conditions : il n'est pas propre à l'API. Il est donc toujours en vigueur, et plus large que le « Cloudflare » noté le 2026-05-10 (l'en-tête de réponse annonce Varnish).

**Non mesuré (à dire franchement) :**
- *Depuis dark-blue* : l'accès SSH n'est pas ouvert à cette session (`Permission denied (publickey,password)`), et `kubectl` pointe sur la production ; aucune sonde n'y a été lancée. Une IP résidentielle (Big-Blue) étant déjà refusée, un serveur domestique a peu de chances de faire mieux.
- *Depuis un navigateur* : pas de navigateur piloté disponible dans cette session. Des essais avec des en-têtes `Referer`/`Origin` imitant un navigateur ont été écartés : ils reviendraient à contourner un contrôle anti-robot, hors du périmètre « sans démarche ».

**Conditions d'utilisation** : illisibles (la page des conditions répond 403 à `curl`). Non vérifiées ; l'API n'étant pas documentée ni publiée, on ne peut supposer aucun droit de réutilisation. Un site public qui ré-expose ces données est un risque juridique et technique.

**Coût** : aucune offre gratuite publique d'API relevée.

**Conclusion** : rejet confirmé. Rouvrir seulement si Sofascore publie une API officielle.

## DataScout

**Qui ?** L'identification est partielle.
- `datascout.com` (200, 2026-11-02) est « Datascout Consulting », cabinet d'Excel pour la finance, page encore remplie de lorem ipsum : **sans rapport avec le football**. Les pages `/pricing` et `/terms-and-conditions` y répondent 404.
- La seule référence football trouvée : l'article [Foot01 « OL : Lacazette plus efficace que Mbappé, la stat qui tue »](https://www.foot01.com/equipe/ol/ol-lacazette-plus-efficace-que-mbappe-la-stat-qui-tue-436112) (10 avril, année non affichée, probablement 2024) écrit « étude réalisée par Datascout » et renvoie à un compte X **Data'Scout (@DataScout_)**, post du 2024-04-09 : les 6 joueurs de L1 qui sur- et sous-performent le plus leurs npxG.
- Une recherche web standard ne trouve ni site, ni API, ni chaîne YouTube de ce nom pour le football. Rien ne prouve que ce compte soit celui cité dans les vidéos vues par Sylvain : à confirmer par Sylvain (nom de la vidéo ou de la chaîne).

**Données** : des analyses publiées en images/posts (npxG, buts au-dessus ou en dessous de l'attendu), pas un jeu de données. Cités dans l'article : Lacazette 13 buts pour 7,10 npxG, Mbappé 18 pour 13.

**Accès réel mesuré** : aucun point d'accès à tester (pas d'API, pas de fichier). La page X n'a pas été lue : X exige un compte. Aucune requête de scraping tentée.

**Conditions** : non applicables / non publiées. Reprendre les chiffres d'un compte tiers demande son accord et la source de ses propres données (probablement un fournisseur payant ou FBref) n'est pas connue.

**Coût** : inconnu. Aucun achat envisagé.

**Conclusion** : pas une source intégrable. Le chiffre dont il parle, le npxG, existe ailleurs.

## Pistes pour avoir des xG gratuits (non mesurées, hors périmètre de ce lot)

Relevées par recherche web, à étudier dans un autre lot avec le même protocole (statut HTTP, échantillon, conditions) : FBref (colonnes « Expected » des pages d'équipe), One Versus One (xG par joueur de Ligue 1), Understat. Aucune n'est validée : leurs conditions d'utilisation et leur accès par programme sont à mesurer.

## Questions ouvertes pour Sylvain

1. De quelle vidéo ou chaîne viennent « Sofascore » et « DataScout » ? Cela confirmerait que DataScout est bien @DataScout_.
2. Veut-on un lot de suivi mesurant FBref / Understat pour les xG ?
