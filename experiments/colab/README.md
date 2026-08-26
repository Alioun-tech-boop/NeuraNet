# NeuraNet — Colab Experimental Lab

## Séparation des responsabilités

| Environnement | Contenu |
|---------------|---------|
| **Local / GitHub** | Code source principal, API/backend, PostgreSQL dev, architecture NeuraNet, tests unitaires, développement quotidien |
| **Colab** (`neuranet_capability_ladder.ipynb`) | Benchmarks lourds (200+ tâches), expériences reproductibles, embeddings GPU E5, comparaison multi-modèles, bootstrap/CI95, graphiques, rapports |

Ne pas migrer le backend vers Colab : c'est un **laboratoire expérimental**, pas l'infrastructure produit.

## Utilisation

1. Ouvrir [colab.research.google.com](https://colab.research.google.com) → *Upload* du notebook
2. Runtime → *Change runtime type* → **GPU T4** (accélère E5)
3. Exécuter les cellules dans l'ordre :
   - Cell 1 — config (clé API demandée via `getpass`, jamais loguée)
   - Cell 2 — génération dataset (200 tâches : 120 train / 80 test, ordre temporel vérifié)
   - Cell 3 — embeddings E5 GPU + retrieval + hard filters
   - Cell 4 — clients LLM 429-aware + juge déterministe
   - Cell 5 — runner A/E/F × modèles (~480 appels subject + 240 judge pour 2 modèles)
   - Cell 6 — statistiques (bootstrap CI95 B=5000, Cohen's d, taux pos/neg)
   - Cell 7 — graphiques (lift vs capacité, lift par workflow)
   - Cell 8 — rapport Markdown + téléchargement des artefacts

## Garanties méthodologiques intégrées

- Ordre temporel strict : `strategy.created_at < target.execution_time` (assert)
- Contrôle shuffled à seed fixe par tâche (reproductible)
- Sources identiques entre modèles (requêtes déterministes par tâche)
- Réponses vides comptées et exclues avec n rapporté (pas de score fantôme)
- Juge indépendant des subjects, temperature=0, fallback heuristique tracé
- Workflows balancés (aucun masqué dans une moyenne globale)

## Prochain benchmark recommandé

N=200 tâches × 5 workflows × 3 conditions × 2–4 modèles ≈ **1 200–2 400 exécutions**
— réalisable en une session Colab GPU là où l'environnement local était bridé par les quotas API.
