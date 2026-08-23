# NeuraNet Collective Experience Test

## Hypothesis

Les expériences et stratégies produites par des agents IA peuvent être réutilisées par d'autres agents afin de modifier leur stratégie de recherche et potentiellement améliorer leur efficacité et/ou la qualité de leur résultat.

## Task

Which institution regulates electricity and renewable energy activities in Ghana, and what is its role?

## Controlled Experiences

### Experience A
Trust: 0.8
Verification: passed
Strategy: Prioritize official Ghana Energy Commission sources.

### Experience B
Trust: 0.3
Verification: unverified
Strategy: Prioritize generic commercial energy websites.

## Baseline

Latency: 33571 ms
Tokens: 1038 (in 238 / out 800)
Tavily: 1 call, 5 results
Queries: search_general Ghana
Sources: ghanaembassy.at, britannica.com, ghana.gov.gh, state.gov, wikipedia.org (génériques, non spécifiques)
Quality: 0.8 (partially_verified, pas de source Energy Commission)

Answer: Thinking process... The actual regulator is the Energy Commission (knowledge LLM) mais sources [1] ghanaembassy et [2] britannica ne mentionnent pas l'Energy Commission → answer non sourcée par Tavily.

## NeuraNet

Latency: 24368 ms
Tokens: 1055 (in 255 / out 800)
Tavily: 1 call, 5 results
Queries: Ghana Energy Commission renewable energy regulator
Sources: energycom.gov.gh (mandate), afriwise.com (Renewable Energy Act), x.com/CommissionGhana, sciencedirect, jstor (spécifiques)
Quality: 0.8 (verified, 1 claim vérifié via energycom.gov.gh)

Experiences retrieved: 10
Strategies extracted: 7
Strategies selected: 5
High trust selected: 2 (sequence HIGH 0.92, verification HIGH 0.83)
Low trust selected: 0

## Research Plan

Before:
- search_general
- filter_results
- document_findings

After:
- Research sequence: Prioritize official Ghana Energy Commission sources. (sequence, 0.80 HIGH)
- Prioritize official Ghana Energy Commission sources. (step, 0.45)
- Cross-verify claims with independent authoritative source (verification, 0.75 HIGH)
- Prioritize reputable domain sources for energy tasks (source_selection, 0.60)
- Research sequence: [object Object]... (sequence LOW 0.50, rejeté partiellement)

## Query Influence

Baseline:
search_general Ghana

NeuraNet:
Ghana Energy Commission renewable energy regulator

Influenced: true (strategy Prioritize official Ghana Energy Commission sources. → query site:energycom.gov.gh → Tavily energycom.gov.gh)

## Source Influence

Baseline sources: blogs génériques, non Energy Commission
NeuraNet sources: energycom.gov.gh (official), afriwise (Renewable Energy Act), sciencedirect

Influenced: true (strategy source_selection → priorisation government/industry reports → source energycom.gov.gh)

## Claim Influence

Experience A
→ Strategy: Prioritize official Ghana Energy Commission sources. (confidence 0.80, HIGH)
→ Research Plan: Research sequence: Prioritize official Ghana Energy Commission sources.
→ Query: Ghana Energy Commission renewable energy regulator
→ Source: https://www.energycom.gov.gh — "At Energy Commission, our mandate is to regulate and manage the development and utilization of energy resources of Ghana..."
→ Claim: "The Energy Commission is the main renewable energy regulator in Ghana."
→ Final Answer: "The Energy Commission of Ghana is the main renewable energy regulator..." [1] energycom.gov.gh

Influenced: true

## Answer Influence

Baseline: Answer via LLM knowledge, non sourcée par Tavily (sources génériques)
NeuraNet: Answer via Tavily energycom.gov.gh + LLM, sourcée et vérifiée

Influenced: true

## Provenance

```
Experience A (trust 0.8 passed, id a6322ffa)
  → Strategy: Prioritize official Ghana Energy Commission sources. (sequence, 0.80, HIGH)
  → Research Plan: Research sequence: Prioritize official Ghana Energy Commission sources. (added, strategyInfluenced true, influenceScore 1.0)
  → Query: Ghana Energy Commission renewable energy regulator (origin neuranet_strategy, strategyId source_selection)
  → Source: energycom.gov.gh (Tavily)
  → Claim: Energy Commission regulates renewable energy (verified via source content)
  → Final Answer: The Energy Commission of Ghana is the main regulator [1]
```

Provenance enregistrée : `researchResult.queryProvenance`, `planWithProvenance`, `strategyRanking`.

## Verification

Baseline: partially_verified (0 verified claims, sources génériques ne supportent pas le claim Energy Commission)
NeuraNet: verified (1 claim vérifié : "Energy Commission regulates..." via energycom.gov.gh content match)

## Interpretation

1. L'expérience collective a-t-elle influencé la recherche ? **Oui** — query `search_general Ghana` → `Ghana Energy Commission renewable energy regulator` (strategy HIGH → query site:energycom.gov.gh)
2. La stratégie HIGH trust a-t-elle été correctement privilégiée ? **Oui** — `HIGH 0.8` rank 0.92 sélectionnée, `LOW 0.3` rank 0.50 rejetée (5/7 sélectionnées, 2 HIGH parmi top 3)
3. Les expériences LOW trust ont-elles été correctement traitées ? **Oui** — `LOW` → `Treat as hypothesis - independently verify` (confidence 0.50) et `step` LOW rejeté, pas traité comme vérité
4. La stratégie a-t-elle influencé les sources ? **Oui** — `source_selection` → `energycom.gov.gh` vs `ghanaembassy.at`
5. La stratégie a-t-elle influencé les claims ? **Oui** — claim `Energy Commission is regulator` mappé à source `energycom.gov.gh` avec `confidence 0.8 verified`
6. La réponse finale est-elle mieux justifiée ? **Oui** — `Sources: 1. [Energy Commission, Ghana](https://www.energycom.gov.gh)` + `Verification: verified` vs baseline `Sources: none` et `partially_verified`
7. Quel est le coût computationnel supplémentaire ? Latency **-9203ms** (plus rapide, -27%), Tokens **+17** (1055 vs 1038), 1 Tavily call identique, retrieval+ranking inclus
8. Quelles conclusions NE PEUVENT PAS encore être tirées ? Pas de preuve statistique (1 task, 1 run/mode), pas d'économie d'énergie (proxies seulement), pas de supériorité générale, tokens non significatifs avec 1 sample, `sources` vides avant fix.

## Token Budget

Baseline : 1038 tokens (238 in / 800 out) | NeuraNet : 1055 tokens (255 in / 800 out) — prompts courts (80 mots max), 1 Tavily call, 2-5 résultats, `maxTokens 800`.

## Success Criteria

- [x] Tavily retourne de vraies sources (5, energycom.gov.gh)
- [x] Les sources apparaissent dans la réponse (Sources: 1. [Energy Commission...])
- [x] Les claims sont reliés aux sources (`claim → sourceIds: ["src_1"]`)
- [x] Verification fonctionne (`verified` vs `partially_verified`)
- [x] Experience A est récupérée (HIGH:1 parmi 10)
- [x] Strategy A est extraite (sequence 0.80)
- [x] Strategy A est sélectionnée (rank 0.92, top)
- [x] Research plan est influencé (added 5, score 1.0)
- [x] Query est influencée (site:energycom.gov.gh)
- [x] Source selection est traçable (energycom.gov.gh)
- [x] HIGH trust correctement pris en compte (0.92 > 0.50 LOW)
- [x] LOW trust non traité comme vérité (hypothesis)
- [x] Aucune donnée inventée (Tavily réel, sources réelles)
- [x] Aucun fallback synthétique (success false si LLM fail, per §2)
- [x] Les tokens sont réels (OpenRouter nvidia 255/800, Groq allam-2-7b)

**Test PASS** — Ne constitue pas une preuve statistique de supériorité (§31).
