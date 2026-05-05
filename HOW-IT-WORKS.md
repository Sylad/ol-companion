# Comment c'est codé — qui fait quoi

Si tu débarques sur ce repo et que tu te demandes ce que Claude a vraiment fait dans cette app, voici la réponse honnête.

## Trois acteurs

| Acteur | Rôle |
|---|---|
| **Sylvain** (humain) | Direction produit, identité visuelle (palette OL rouge + bleu, néons), sources de données, validation visuelle à chaque itération |
| **[Claude Code](https://claude.com/claude-code)** (Anthropic) | Implémentation du code, refactor, debug, scraping reverse-engineering, parsing 365scores, modules live-match et SSE |
| **[ChatGPT](https://chat.openai.com)** (OpenAI) | Logo OL Companion, mockups UX initiaux, propositions design |

## Répartition des tâches

| Tâche | Acteur principal | Détails |
|---|---|---|
| Choix produit, UX, ton | Humain | « Compagnon perso OL avec live match, classement règles LFP, bracket coupes, sans pub » |
| Code React (frontend) | Claude Code | TanStack Router/Query, composants, theming Tailwind + tokens HSL OL |
| Code NestJS (backend) | Claude Code | 11 modules, services, controllers, scheduler `@nestjs/schedule` v5, SSE |
| Scraping 365scores | Claude Code | Reverse-engineering des endpoints `/web/games/`, `/web/standings/`, `/web/game/`, headers anti-403, schémas Zod pour validation |
| Aggrégation live-match | Claude Code | Reconstruction des stats équipe à partir des stats joueurs, shot chart avec convention `side`/`line`, top performers par rôle |
| Logo OL Companion | ChatGPT | Génération initiale, retouches humaines |
| Mockups UX premières versions | ChatGPT | Wireframes match page, dashboard, sidebar |
| Validation visuelle | Humain | Comparaison avec Sofascore / Football Manager pour la véracité des données |

## Claude à runtime — où l'API Anthropic est appelée

**Nulle part.** Cette app n'appelle pas l'API Claude pendant son fonctionnement.

- Tout ce qui s'affiche (classement, fixtures, match live, shot map, news, bracket) provient de **sources tierces déterministes** : 365scores, football-data.org, RSS multi-sources, Wikipedia FR.
- Le backend NestJS scrape, parse, agrège, met en cache. Aucune phase d'analyse LLM.
- L'Anthropic SDK est déclaré dans `package.json` car le badge `Budget Claude` partagé en haut à droite (cf. apps `finance-tracker` et `warhammer40k`) lit `claude-shared.json` — mais c'est juste un affichage de solde, pas un appel API.

**Coût d'usage runtime : 0 €.** Tu peux faire tourner l'app sans clé Anthropic, sans clé OpenAI, sans aucune dépendance LLM. Seules clés requises : `FOOTBALL_API_KEY` (free tier 10 req/min, suffit pour Ligue 1).

## Claude à build-time — pair-programming sur le code

C'est ici que Claude a contribué. **Les fichiers `.ts`, `.tsx`, `.scss`, `Dockerfile`, scripts shell ont été écrits ou édités par Claude Code, sous direction humaine.**

Workflow type pour chaque feature :

1. Je décris en français ce que je veux : *« ajoute une page match dédiée avec timeline buts/cartons/subs + shot map type Sofascore + 14 stats équipe avec barres comparatives »*
2. Claude pose le squelette : composant route, types, hook TanStack Query, parsing 365scores
3. Je valide visuellement dans le navigateur (`http://nas:4202`), je redirige sur ce qui ne va pas (« le shot map est en orientation portrait, faut paysage », « tu rates les penalty goals, regarde le subTypeName »)
4. Claude itère par diff précis, ajoute des specs unitaires si la logique est non triviale (ex: `live-match.aggregator.spec.ts`)
5. Quand c'est bon, on commit (avec trailer `Co-Authored-By: Claude` pour la traçabilité)

Le résultat : ~80% des commits du repo (et 100% des récents depuis l'adoption stricte de la convention) ont ce trailer. Les 20% restants sont des commits anciens d'avant la convention.

## Le piège central : les API non officielles

Le cœur de l'app est le scraping **365scores** (classement Ligue 1 avec règles LFP de départage, live match, shot map). Ces endpoints web ne sont pas documentés et peuvent changer du jour au lendemain.

Sécurités mises en place avec Claude :

- **Schémas Zod stricts** sur les payloads 365scores (`backend/src/config/scores365-game.schema.ts`, `standings/standings.schema.ts`) — si la forme change, on échoue fast au lieu de produire des données silencieusement cassées.
- **Headers réalistes** centralisés dans `backend/src/config/scores365-http.ts` — User-Agent + Referer + X-Domain pour éviter les 403 anti-bot.
- **Caches TTL différenciés** : 5 s en live, 30 s en upcoming, 1 h sur le classement, archive saisonnière annuelle. Le backend ne hammer pas 365scores.
- **Tests unitaires** sur les parsers les plus tordus (`live-match.aggregator.spec.ts`, `bracket.service.spec.ts`, `news.service.spec.ts`).

Si tu forks pour un autre club, regarde `backend/src/modules/standings/`, `live-match/`, `cups/bracket.service.ts`, `lineup/` pour le pattern.

## Live updates — SSE déterministe, pas de polling client

Le backend tourne un cron toutes les 30 s (via `@nestjs/schedule` v5) qui :

1. Re-fetch le live match côté 365scores
2. Calcule une **signature** simple (score | gameTime | event count | shot count)
3. Si la signature change → emit un event SSE `live-match-changed`
4. Le frontend (TanStack Query + `EventSource`) reçoit l'event → `invalidateQueries` → re-fetch propre

Pareil pour `fixtures`, `standings`, `season-rankings`. **Aucun polling agressif côté client**, le backend est l'unique source de truth.

## Pourquoi cette transparence

Le projet a deux objectifs :

1. **Suivre l'OL au quotidien sans dépendre des apps mainstream** — c'est mon usage personnel premier
2. **Démontrer ce que la collab humain + Claude Code permet de bâtir en quelques sessions** — c'est mon usage public secondaire

Cacher la part de Claude irait contre le second objectif. Je préfère afficher clairement où l'IA a contribué pour que les visiteurs puissent évaluer eux-mêmes : « est-ce que je peux bâtir un truc comme ça avec Claude Code et combien de temps ça me prendrait ? »

Réponse : oui, et pour un compagnon de club déterministe comme celui-ci, ça se compte plutôt en jours qu'en semaines. Le résultat dépendra surtout de ta capacité à :
- **Lire un endpoint inconnu** (DevTools → Network → repérer la structure JSON utile)
- **Refuser ce qui ne ressemble pas à ce que tu vois sur Sofascore** (validation visuelle)
- **Tester les edge cases** (mi-temps, prolongations, TAB, match reporté, fin de saison)

Claude écrit le code ; toi, tu vérifies que ça correspond à la réalité du club que tu suis.

## Et si tu veux faire pareil

Prends un sujet qui t'enflamme, ouvre [Claude Code](https://claude.com/claude-code), décris en langage naturel ce que tu rêves de voir exister, puis itère. Tu seras surpris de ce qu'on peut bâtir en quelques sessions.
