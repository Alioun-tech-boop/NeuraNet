# Corrected Transfer Benchmark Results

## Summary

10 tâches exécutées via /v1/neurannet/transfer avec le pipeline corrigé.
Toutes ont réussi (status=200) avec de vrais appels Tavily + LLM.

**strategyApplied = false pour toutes les tâches** car aucune famille n'a encore
de chemin canonique avec un queryPattern appris. Le système utilise correctement
le fallback : la requête originale comme search query.

## Key Metrics

- Strategy applied: 0/10
- Avg latency: 2283ms
- Zero context violations
- All tasks used fresh Tavily + LLM execution

## Next Step

Pour activer l'application de stratégie, il faut d'abord créer des chemins
canoniques avec des queryPattern appris via /v1/knowledge/query (RESEARCH).
Ensuite le transfert utilisera ces patterns pour guider la recherche.
