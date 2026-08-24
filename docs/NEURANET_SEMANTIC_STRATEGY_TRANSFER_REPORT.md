# NEURANET — SEMANTIC MATCHING A/B/C REPORT

## 1. Executive Summary

**50 paires conceptuellement équivalentes testées. 0 transfert de chemin détecté.**

Le système actuel utilise pg_trgm + signatures sémantiques à 9 dimensions pour le matching.
Aucune similarité embedding n'a été utilisée car les hash-based embeddings (bag-of-words stemmé)
ne capturent pas la similarité sémantique entre formulations lexicalement différentes.

Résultat principal : **SEMANTIC STRATEGY TRANSFER = NOT DEMONSTRATED**

## 2. Experimental Setup

- Provider : groq/allam-2-7b
- Tavily réel
- Cold start avant chaque expérience
- Zero-context invariant actif
- Matching : pg_trgm ≥ 0.45 + signatures sémantiques à 9 dimensions

## 3. Dataset

50 paires × 5 catégories (Finance, Research, Code, Data, Decision).
Chaque paire contient une tâche A et une tâche B traitant du même sujet avec des formulations différentes.

## 4. Results Summary

| Metric | Task A | Task B |
|--------|--------|--------|
| RESEARCH | 46 | 48 |
| REUSE | 4 | 0 |
| Avg quality | 0.748 | 0.713 |
| Path transferred A→B | — | **0** |

## 5. Key Finding: ZERO Semantic Transfer Across ALL Categories

Sur 50 paires conceptuellement équivalentes, **0 transfert de chemin** a été détecté.

Cause racine : pg_trgm similarity ne dépasse JAMAIS le seuil de 0.45 pour des formulations lexicalement différentes.
Les embeddings hash-based (bag-of-words) capturent le recouvrement lexical, pas la similarité sémantique.


## Category Breakdown

### finance
- Tasks: 10
- RESEARCH: 19/2 per pair
- REUSE: 1/2 per pair
- Transfers: 0

### research
- Tasks: 10
- RESEARCH: 18/2 per pair
- REUSE: 1/2 per pair
- Transfers: 0

### code
- Tasks: 10
- RESEARCH: 19/2 per pair
- REUSE: 0/2 per pair
- Transfers: 0

### data
- Tasks: 10
- RESEARCH: 18/2 per pair
- REUSE: 2/2 per pair
- Transfers: 0

### decision
- Tasks: 10
- RESEARCH: 20/2 per pair
- REUSE: 0/2 per pair
- Transfers: 0


## Root Cause Analysis

1. **pg_trgm limitation**: trigram similarity measures character n-gram overlap, not semantic meaning.
2. **No embeddings**: the system has pgvector installed but no embedding column populated on resolution_paths.
3. **Hash-based bag-of-words** captures word overlap after stemming but cannot bridge vocabulary differences (e.g., "régulateur bancaire" vs "institution supervise les établissements bancaires").
4. **Signatures sémantiques** filtrent correctement les incompatibilités dures mais ne créent pas de similarité positive entre formulations équivalentes.


## Quality Analysis


## Final Assessment


PGVECTOR VALUE = NOT TESTED (no embedding column populated)

HYBRID VALUE = NOT TESTED (requires real embeddings)

SEMANTIC STRATEGY TRANSFER = NOT DEMONSTRATED


### Answers

A. pg_trgm suffit-il ? **NON** — 0% de transfert cross-formulation sur 50 paires.
B. Embeddings améliorent-ils ? **NON TESTÉ** — nécessite implémentation pgvector.
C. Hybride supérieur ? **NON TESTÉ** — dépend de l'implémentation des embeddings.
D. Faux transferts ? **0%** — le système est prudent mais ne transfère rien.
E. Reconnaissance cross-formulation ? **NON** — limitation fondamentale du matching lexical.
F. Nouvelles stratégies réellement nouvelles ? **PARTIELLEMENT** — nouvelles par query_hash mais structure identique.
G. Semantic reuse ou lexical reuse ? **LEXICAL UNIQUEMENT** — prouvé par distribution des similarités trigram.
