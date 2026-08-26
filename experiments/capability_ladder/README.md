# NEURANET — CAPABILITY LADDER EXPERIMENT (MODEL × GUIDANCE)

## 1. Hypothèse testée

> Le gain NeuraNet décroît lorsque les capacités intrinsèques du modèle augmentent.

Motivation : dans la validation finale (45 tâches), allam-2-7b montre un lift
significatif (+0.059) alors que gpt-oss-20b est inconstant. Si le guidance
compense les capacités internes, sa valeur marginal doit décroître avec la taille.

## 2. Design

- **Subjects** (axe de capacité) :
  - allam-2-7b (7B)
  - openai/gpt-oss-20b (20B, raisonnement caché)
  - qwen/qwen3.6-27b (27B, balises `<think>` stripped)
- **Juge indépendant** : gpt-oss-120b, temperature 0 (aucun subject ne s'auto-juge)
- **Conditions** par task × model : A (baseline), E (strategy-guided search), F (shuffled)
- **Dataset** : même test set verrouillé que final_validation (45 tasks, 9/workflow)
- **Search cache partagé** → mêmes sources pour tous les modèles (contrôle strict)
- Métriques : lift E−A par modèle + IC95 bootstrap ; baselineQ par modèle
  (validation de l'axe de capacité) ; corrélation capacité ↔ lift

## 3. Statut : INFRASTRUCTURE READY — RUN BLOCKED ON API QUOTA

Trois tentatives d'exécution ont échoué pour des causes identifiées et corrigées :

| Run | Symptôme | Cause racine | Fix appliqué |
|-----|----------|--------------|--------------|
| ladder v1 | Tous les lifts = 0 | Juge 120b en TPD épuisé → retournait 0 partout | Retry + fallback heuristique |
| ladder v2 | m20b: 45/45 réponses vides | 429 traités comme contenu vide ; budget reasoning | Backoff long 429-aware (jusqu'à 60s), budgets tokens par modèle |
| ladder v3 | Rythme ~9 min/task, vides résiduels | Quotas org globalement drainés (cumul de la journée) | **Run arrêté — relancer après reset du quota** |

## 4. Données préliminaires (run v1, research workflow uniquement — À NE PAS CITER)

Sur les 9 tâches research avant détection du bug juge :
- 7B : lifts majoritairement forts (+0.81, +0.70, +0.80…)
- 20B : lifts négatifs ou nuls
- 27B : quasi-nuls

Pattern directionnellement compatible avec l'hypothèse (décroissance du gain
avec la capacité) mais **non exploitable scientifiquement** à cause des biais
infrastructure. Ne pas utiliser ces chiffres.

## 5. Relance

```bash
# Après reset du quota Groq (fenêtre TPD)
N_PER_WF=5 node experiments/capability_ladder/benchmark.mjs   # smoke test ~25 tâches
# si 0 empty sur stderr :
N_PER_WF=9 node experiments/capability_ladder/benchmark.mjs   # run complet ~90 min
```

Analyse :
```bash
node -e "... stats identiques à final_validation/statistics.mjs, par clé de modèle"
```

## 6. Critères de succès

| Résultat | Interprétation |
|----------|----------------|
| lift(7B) > lift(20B) > lift(27B) ≥ 0 | H confirmée : NeuraNet = guidance pour modèles légers |
| lift constant > 0 partout | Guidance universelle |
| lift ≈ 0 partout | Effet spécifique au setup précédent |

Quel que soit le résultat : segmenter la valeur produit (agents légers vs lourds).
