# Controlled Semantic Strategy Transfer — Results

## Critical Finding

**TRANSFER = CACHED RESULTS, NOT STRATEGY-ASSISTED EXECUTION**

Le système actuel retourne des résultats en cache (REUSE) pour les tâches similaires.
La stratégie récupérée n'est PAS utilisée pour guider une nouvelle exécution LLM.

C'est un finding architectural majeur : le pipeline actuel ne supporte pas le
semantic strategy transfer car il n'exécute jamais une nouvelle recherche avec
la stratégie récupérée.

## Results

| Condition | Mean Quality | Mean Latency | Total Tokens | Strategy Used |
|-----------|-------------|--------------|--------------|---------------|
| Control | 0.767 | 6042ms | 4541 | No |
| Transfer | 0.767 | 953ms | 0 | **No** (cached REUSE) |

Transfer Lift: **+0.000 (+0.0%)**
Bootstrap 95% CI: [0.000, 0.000]

## Root Cause Analysis

Le endpoint /v1/knowledge/query retourne immédiatement la production canonique
en cache quand decision=REUSE. Il n'appelle JAMAIS l'AgentC pour exécuter une
nouvelle recherche avec la stratégie récupérée.

Pour que le semantic strategy transfer fonctionne, il faudrait :
1. Récupérer la stratégie via embeddings E5
2. Exécuter AgentC avec cette stratégie comme guide de recherche
3. Mesurer si le résultat est amélioré par rapport au contrôle

Cette chaîne n'existe pas dans l'architecture actuelle.

## Recommendation

Créer un nouveau endpoint /v1/neurannet/transfer qui :
1. Récupère la stratégie via embeddings
2. Force une NOUVELLE recherche AgentC avec la stratégie comme contexte
3. Compare avec le résultat du contrôle
4. Mesure le lift réel de qualité

Ce n'est PAS une modification mineure mais un changement architectural.
