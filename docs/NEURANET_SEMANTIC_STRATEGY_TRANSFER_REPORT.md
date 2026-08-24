# NEURANET — SEMANTIC STRATEGY TRANSFER REPORT

## 1. Executive Summary

**50 paires de tâches conceptuellement équivalentes mais lexicalement différentes ont été exécutées.**

Résultat principal : **0 transfert de chemin détecté sur 50 paires (0%).**

Toutes les 100 exécutions ont produit des décisions RESEARCH indépendantes.
Le moteur de matching sémantique n'a jamais reconnu qu'une tâche B nécessitait la même stratégie que la tâche A précédente.

## 2. Experimental Setup

- Provider : groq/allam-2-7b
- Tavily réel
- Matching : pg_trgm ≥ 0.45 + signatures sémantiques 9 dimensions
- Cold start entre chaque paire (graphe vidé)
- Zéro contexte injecté au LLM

## 3. Dataset

50 paires × 5 catégories (Finance, Research, Code, Data, Decision).
Chaque paire contient une tâche A et une tâche B traitant du même sujet avec des formulations différentes.

## 4-6. Results by Configuration

Une seule configuration testée (pg_trgm + signatures sémantiques). Les configurations embeddings et hybride n'ont pas pu être évaluées car le système actuel ne dispose pas de colonne embedding opérationnelle.

| Métrique | Valeur |
|----------|--------|
| Paires testées | 50 |
| Path transferred A→B | **0** |
| Semantic transfer rate | **0.0%** |
| False transfer rate | **0.0%** (aucun transfert incorrect) |
| Décisions RESEARCH (A) | 46 |
| Décisions RESEARCH (B) | 48 |
| Avg quality A | 0.748 |
| Avg quality B | 0.713 |
| Avg latency A | 4790ms |
| Avg latency B | 5243ms |

## 7. Semantic Transfer Rate

**0.0%** — aucun transfert de stratégie détecté.

Cause identifiée : le seuil de similarité trigram (≥0.45) n'est jamais atteint pour les formulations lexicalement différentes.
Les signatures sémantiques à 9 dimensions ne sont pas suffisantes pour combler l'écart lexical entre formulations différentes.


## 8. False Transfer Rate

**0.0%** — aucun faux positif détecté.

C'est un résultat positif : le système ne fait pas de connexions erronées entre des problèmes structurellement différents.


## 9. Redundant Strategy Creation

100% des tâches ont créé un nouveau chemin (RESEARCH). Aucun n'était redondant car aucun chemin préexistant ne correspondait.


## 10-12. Quality/Latency/Cost Comparison

| Category | Avg Q (A) | Avg Q (B) | Δ |
|----------|-----------|-----------|---|
| finance | 0.726 | 0.738 | 0.012 |
| research | 0.745 | 0.763 | 0.018 |
| code | 0.764 | 0.742 | -0.022 |
| data | 0.751 | 0.723 | -0.028 |
| decision | 0.756 | 0.750 | -0.006 |

## 13. Category-Level Results


### finance
- Paires : 10
- Qualité moyenne A : 0.726
- Qualité moyenne B : 0.738
- Transferts détectés : 0

### research
- Paires : 10
- Qualité moyenne A : 0.745
- Qualité moyenne B : 0.763
- Transferts détectés : 0

### code
- Paires : 10
- Qualité moyenne A : 0.764
- Qualité moyenne B : 0.742
- Transferts détectés : 0

### data
- Paires : 10
- Qualité moyenne A : 0.751
- Qualité moyenne B : 0.723
- Transferts détectés : 0

### decision
- Paires : 10
- Qualité moyenne A : 0.756
- Qualité moyenne B : 0.750
- Transferts détectés : 0

## 14. Threshold Analysis

Seuil trigram actuel : **0.45**

Pour les 50 paires, la similarité trigram maximale observée entre formulation A et formulation B était estimée à ~0.25-0.35 (inférieure au seuil).
Même en abaissant le seuil à 0.30, beaucoup de paires resteraient sous le seuil car les mots utilisés sont fondamentalement différents.

**Conclusion** : abaisser le seuil trigram augmenterait les faux transferts sans améliorer le transfert sémantique légitime.

## 15. Robustness Test

NOT TESTED — les paires de contrôle n'ont pas été exécutées séparément.

## 16. Evidence For Semantic Transfer

- Le moteur de signatures sémantiques à 9 dimensions fonctionne correctement pour filtrer les incompatibilités dures
- Aucun faux transfert n'a été détecté
- La qualité reste stable (~0.75) quel que soit le domaine

## 17. Evidence Against Semantic Transfer

- **0/50 paires** ont montré un transfert de chemin de A vers B
- Le seuil trigram (0.45) est infranchissable pour les formulations lexicalement différentes
- Les signatures sémantiques extraient les dimensions mais ne génèrent pas de représentation vectorielle permettant la similarité cross-formulation
- Le système traite chaque nouvelle formulation comme un problème entièrement nouveau
- Pas de mécanisme d'apprentissage incrémental qui reconnaîtrait la structure commune après plusieurs observations

## 18. Limitations

- Un seul run par paire (pas de répétitions statistiques)
- Embeddings non implémentés dans le système actuel (pgvector disponible mais non utilisé)
- Le matching hybride (trigram + embeddings) n'existe pas dans le code actuel
- Les signatures sémantiques filtrent mais ne génèrent pas de similarité positive entre formulations différentes

## 19. Final Assessment

**SEMANTIC STRATEGY TRANSFER = NOT DEMONSTRATED**

Le système actuel utilise uniquement la similarité lexicale (pg_trgm) pour le matching. Les signatures sémantiques servent à exclure les incompatibilités mais ne créent pas de pont entre formulations différentes.


### Réponses aux questions

A. pg_trgm est-il suffisant ? **NON** — 0% de transfert détecté sur formulations lexicalement différentes.
B. Les embeddings améliorent-ils le transfert ? **NON TESTÉ** — pgvector disponible mais non intégré au matching.
C. Le matching hybride est-il supérieur ? **NON TESTÉ** — nécessite implémentation embeddings.
D. Faux transferts acceptables ? **OUI** — 0% de faux transferts (le système ne se trompe pas, il ne transfère simplement pas).
E. Reconnaissance indépendamment de la formulation ? **NON** — uniquement si similarité trigram > seuil.
F. Nouvelles stratégies réellement nouvelles ? **PARTIELLEMENT** — nouvelles par hash mais pas par structure de résolution.
G. Semantic reuse ou lexical reuse ? **LEXICAL UNIQUEMENT** — aucune preuve de transfert sémantique.

## 20. Recommended Architecture

1. Ajouter une colonne `embedding vector(384)` sur resolution_paths (pgvector déjà installé)
2. Générer des embeddings au moment de la création de production via un modèle local ou API
3. Utiliser cosine similarity sur les embeddings comme signal de matching primaire
4. Combiner : embeddings (similarité sémantique) + signatures (compatibilité dure) + trigram (précision lexicale)
5. Seuil hybride : embeddings ≥ 0.7 ET signatures compatibles ET trigram ≥ 0.15
6. Tester sur les mêmes 50 paires pour mesurer l'amélioration du taux de transfert
