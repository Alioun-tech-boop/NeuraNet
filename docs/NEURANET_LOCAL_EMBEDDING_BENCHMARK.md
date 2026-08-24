# Local Semantic Embedding Benchmark

## 1. Objective

Déterminer si intfloat/multilingual-e5-small (384d, local, offline) peut
remplacer gemini-embedding-001 (768d, API) pour le matching sémantique.

## 2. Model

| Property | E5 Local | Gemini |
|----------|----------|--------|
| Model | multilingual-e5-small | gemini-embedding-001 |
| Dimension | 384 | 768 |
| Provider | local (ONNX) | API |
| Multilingual | FR/EN ✓ | FR/EN ✓ |
| Offline | ✓ après téléchargement | ✗ |
| Cost per query | 0 | 0 (free tier) ou payant |

## 3. Key Results

### Positive pairs (conceptually equivalent)
mean similarity: **0.8794**

### Hard negatives (lexically close, strategically different)
mean similarity: **0.9467** — PLUS ÉLEVÉ que les positives !

### Separation gap
**-0.0673** — NÉGATIF : le modèle ne distingue PAS les paires positives des hard negatives.

### Cross-language FR→EN
similarity: **0.9225** pour "régulateur bancaire Ghana" ↔ "banking regulator Ghana" ✓

## 4. Analysis

E5 capture la similarité TEXTUELLE mais pas la COMPATIBILITÉ STRATÉGIQUE :
- Deux questions sur "moyenne" et "médiane" ont une similarité de 0.98 (très proches textuellement)
  mais nécessitent des stratégies différentes
- C'est exactement la limitation prédite par §26 du spec précédent

Le modèle a besoin d'un fine-tuning sur des paires stratégie-compatible/strategy-incompatible
pour apprendre à distinguer les deux, OU une couche de compatibilité dure supplémentaire est nécessaire.

## 5. Recommendation

Utiliser E5 comme signal PRIMAIRE de similarité textuelle + les signatures sémantiques à 9 dimensions comme filtre de COMPATIBILITÉ STRATÉGIQUE. Le système hybride combine :
1. E5 pour la similarité générale (recall élevé)
2. Signatures pour filtrer les incompatibilités dures (précision)

C'est l'architecture actuelle qui fait déjà cela via findSimilarProductions.
