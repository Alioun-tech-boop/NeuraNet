# NeuraNet Knowledge Evolution Test

## Hypothesis

NeuraNet peut apprendre continuellement : une nouvelle production de meilleure qualité remplace la canonique et est automatiquement réutilisée.

## Task

What is the main renewable energy regulator in Ghana, and what is its role?

## Run 1 — Initial Research

Decision: RESEARCH
Production: 9553aafb quality 0.97 verification verified sources 5 (energycom.gov.gh, afriwise, etc.)
Tavily: 1, LLM: 1, productionCreated: true
Canonical: 9553aafb is_canonical=true

## Run 2 — Direct Reuse

Decision: REUSE
Production reused: 9553aafb (A)
Tavily: 0, LLM: 0, reused: true
Latency: ~1.2s vs 26s RESEARCH

## Run 3 — Knowledge Improvement

Production A: 9553aafb quality 0.97 verified 5 sources
Production B: a8df17f4 quality 1.0 verified 6 sources (World Bank, IRENA, 3 claims)
Comparison: BETTER (1.0 > 0.97 +0.01)
Canonical before: 9553aafb
Canonical after: a8df17f4
A is_canonical=false superseded, B is_canonical=true, A still exists: true

## Run 4 — Reuse Improved Knowledge

Decision: REUSE
Production reused: a8df17f4 (B) — plus A
Tavily: 0, LLM: 0

## Knowledge Evolution

```
INITIAL canonical = A 9553aafb (0.97)
  ↓ NEW PRODUCTION B a8df17f4 (1.0, 6 sources)
COMPARISON B > A => BETTER
  ↓ KNOWLEDGE UPDATE canonical = B
FUTURE AGENT D → REUSE B (0 Tavily)
```

knowledgeEvolution: true, canonicalUpdated: true, improvementScore: +0.03

## Research Avoidance

Potential research: 2 (B and D)
Actual research: 0
Avoided: 2, rate: 1.0 (100%)

REUSE = 0 Tavily, 0 LLM, 0 strategy extraction — direct canonical.

## Provenance

Agent A → Research → Production A → Canonical A → Agent B REUSE A → Agent C Production B → Compare A vs B → B BETTER → Canonical B → Agent D REUSE B

Provenance conservée: productionId, canonicalId, sourceIds, verification, confidence, freshness, originalAgentId.

## Conclusion

1. Première production peut devenir canonique ? Oui (A 9553aafb)
2. Agent suivant peut la réutiliser directement ? Oui (B REUSE A, 0 Tavily)
3. Meilleure production peut remplacer l'ancienne ? Oui (B 1.0 > A 0.97 → BETTER → B canonical)
4. Ancienne conservée ? Oui (A is_canonical false, status superseded, still exists)
5. Nouvel agent récupère automatiquement la meilleure ? Oui (D REUSE B)
6. Recherches inutiles évitées ? Oui, 2 évitées sur 2 possibles (100%)
7. Provenance complète ? Oui
8. Limites ? 1 task, 4 runs, pas de test CONFLICTING/FRESHNESS massif, pas d'économie d'énergie
