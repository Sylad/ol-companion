# Review 2026-08-14 — findings reportés

Revue 8 angles backend + frontend, ~36 candidats, 22 corrigés (commit associé).

## Correctness
1. **isEliminated coupes : faux positif** — « joué + rien de programmé » = éliminé,
   même après une qualification dont le tour suivant n'est pas encore planifié
   (et une finale GAGNÉE = éliminé). Décision produit : exiger une défaite au
   dernier match joué (et gérer aller-retour/TAB).
2. **Refs notifications/burst non mises à jour quand l'onglet est visible** —
   but notifié 35 min en retard au passage en arrière-plan ; refs jamais reset
   au changement de gameId (bursts fantômes en naviguant de match en match).
   Fix : toujours alimenter seenRef, ne conditionner que l'émission ; keyer les
   refs par gameId.
3. **bracket-tie : agrégat 2 matchs** — un aller reporté compte 0-0 ; TAB non
   gérés (aucun vainqueur surligné). Exiger les 2 legs FINISHED à scores non
   nuls.
4. **match-clock statusGroup 2** — un match suspendu/reporté tombe dans la
   branche live (horloge active).
5. **live-match aggregate** — somme aveugle des stats par joueur : les % et les
   ratios x/y sont faux (900 « % de passes » d'équipe). Whitelist des stats
   sommables.
6. **shot-map** — l'orientation side/line est peut-être transposée (non tranché,
   vérifier contre le chart 365scores pendant un vrai match).
7. **matchupId requis par le backend** — le lien /match/:gameId nu affiche
   désormais un message honnête, mais idéalement le backend dériverait le
   matchupId depuis gameId (lookup dans le cache courant/saison).

## Perf
8. **player-stats rebuild séquentiel** — ~50 fetches × RTT ; chunks de 5 via
   Promise.allSettled.
9. **readCache disque+parse par requête** — garder le payload parsé en mémoire
   (pattern live-match), disque = hydratation au boot. Concerne standings,
   fixtures, season-matches, cups, news + team-stats recalculé par requête.
10. **wiki-image sans Cache-Control** — max-age=86400 → le navigateur absorbe
    les reloads (18 logos par F5) ; persister le Map sur disque.
11. **ligue1-map** — 18 markers × rescans O(clubs×fixtures×clubs) ; précalculer
    une Map id365→matchs en un passage useMemo.
12. **claude-shared.json cross-process** — lost updates entre les 3 apps NAS
    (même finding partout ; lockfile ou accepter).

## Refactors
13. **Cache TTL {ts,data} copié ×7** → JsonTtlCache<T> en common/ (news a déjà
    drifté avec son check de validité).
14. **Mapping statusGroup→status ×4** → scores365StatusToMatchStatus() partagé.
15. **matchesChanged/fixturesChanged + readCacheRaw dupliqués** → helper commun.
16. **Calcul vainqueur ×5-6 côté front** (déjà incohérent live entre bracket et
    rows) → matchOutcome() partagé, ou olResult calculé côté backend.
17. **Identité clubs en 3-4 tables parallèles** (coords, aliases, wiki, OL_ID
    ×2) → une table unique id365/idFD/noms/coords/wiki.
18. **Params 365scores incohérents** (langId=15/userCountryId=5 vs
    langId=1/userCountryId=75) → constantes partagées dans scores365-http.
19. **Formatters de dates dupliqués ×4-6** → lib/format-date.ts.
20. **8 hooks useQuery boilerplate** → factory createApiQuery (clé+path co-localisés).
21. **eventSignature/diff/score-jump dupliqués** entre notifications et burst →
    lib/live-events.ts.
22. **Dead code restant** — route GET /standings/history sans consommateur,
    type HistoryEntry, export findClubById365, unused export resolveOpponentClub.
