# NeuraNet Path Selection Engine V2

## Architecture avant → après

**Avant** : `Problem → Paths → bestKnownPath` (score pondéré unique, pas d'incertitude, pas d'exploration adaptative, bestKnown quasi-permanent)

**Après** :
```
Problem → ProblemSignature → hard compatibility filter (rejet absolu)
  → CandidatePaths → Pareto frontier (jamais détruits)
  → Contextual Fitness (signature × spécialisation du path)
  → Uncertainty (1/√n) → Risk-Adjusted Utility
    = expectedQuality(−uncertainty −degradation) ×w_quality
      + speed + tokenCost + toolCost + reliability
      − failureRisk×0.30
  → Constraints gate (minQuality, maxFailureRate, maxLatency)
  → Exploration adaptative (UCB sur candidats prometteurs sous-échantillonnés)
  → bestPathFor(problem, time, evidence)
```

## Composant : `src/pathEngine/selector.js`

Coefficients configurables et documentés :

| Paramètre | Défaut | Rôle |
|-----------|--------|------|
| weights.expectedQuality/speed/tokenCost/toolCost/reliability | .55/.15/.10/.05/.15 | utilité composite |
| uncertaintyPenaltyCoef | 0.20 | pénalité 1/√n |
| failureRiskPenaltyCoef | 0.30 | pénalité taux d'échec |
| minimumQualityThreshold | 0.55 | contrainte qualité |
| maximumFailureRate / maximumLatencyMs | 0.6 / 45000 | contraintes |
| explorationRateBase/Max | 0.08 / 0.30 | bornes d'exploration |
| ucbCoefficient | 0.4 | UCB pour candidats sous-échantillonnés |
| recentWindow | 5 | fenêtre de non-stationnarité |

## Fonctions clés

- `computePathStats(executions)` — n, success/failureRate, qualityMean/Min/Max, latencyMean/Median/P90, tokenMean, toolCallMean, **recentQuality vs historicalQuality → degradationDetected**
- `uncertainty(stats)` = min(1, 1/√n)
- `riskAdjustedUtility(path, stats, sig)` — utility documentée composante par composante
- `adaptiveExplorationRate(...)` — croît avec candidats sous-échantillonnés, décroît avec maturité famille
- `selectBestPath(...)` — pipeline complet §24, retourne selectedPath/candidates/rejected/paretoFrontier/reason/explorationDecision/confidence/**estimatedRegret**/selectionLLMCalls=0

## Spécialisation hiérarchique

`registry.findFamilyWithFallback(orgId, sig)` : clé exacte → sans juridiction → sans granularité → sans subdomain. Les paths généraux restent utilisables tant qu'aucune spécialisation prouvée n'existe ; les familles spécialisées prennent le relais dès qu'elles sont prouvées.

## Invariants vérifiés

- selectionLLMCalls = 0 (matching 100% déterministe : SQL + signatures + Pareto + stats)
- contextAddedTokens = 0 (aucune donnée NeuraNet dans un prompt)
- Provider/model : metadata uniquement, jamais réécrits

## Benchmark (`scripts/benchmark-path-selection.js`)

| Scénario | OLD | V2 |
|----------|-----|-----|
| S1 Incertitude (0.94/n=50 vs 0.97/n=2) | prend 0.97 aveuglément | prend stable-0.94 (uncertainty 0.14 vs 0.71) ✓ |
| S2 Dégradation (champion 0.96→0.78) | aveugle à la dégradation | détecte degradationDetected=true, utility 0.879 > 0.813 ✓ |
| S3 Pareto (qualité 0.98/12s vs rapide 0.93/1.5s) | éliminerait fast-path | les deux restent Pareto-actifs ✓ |
| S4 Domination single-observation | possible | bloquée (minExecutions=2) ✓ |

**V2 correct behavior : 4/4 scénarios** — observation expérimentale, pas de signification statistique revendiquée.

## Tests

`tests/path-selection.test.mjs` — 13/13 PASS couvrant : stats séparées, incertitude, dégradation, domination qualité, Pareto, conflits durs (Ghana/Kenya, current/2015, identify/financing), spécialisation intents, zero-LLM/zero-context sur famille vide, résistance au poisoning (outlier unique n'affecte pas la moyenne au-delà des seuils).

Régression complète : 59/59 PASS (toutes suites existantes).
