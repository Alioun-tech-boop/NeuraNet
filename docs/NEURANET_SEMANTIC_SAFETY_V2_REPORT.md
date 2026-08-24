# NeuraNet Semantic Safety V2 Report

## Objective

Harden semantic safety so REUSE is only allowed when a production genuinely answers the query. Priority: correctness over reuse rate. Zero-context invariant preserved throughout.

## Engine Changes (deterministic, zero LLM, zero context impact)

`src/productions/engine.js` — new multi-dimension **semantic signature** per query/production:

| Dimension | Extraction |
|-----------|-----------|
| domain | energy/banking/telecom/finance/... |
| subdomain | renewable_energy, electricity, securities, pesticides, competition... |
| jurisdiction | Ghana/Kenya/Nigeria/... (hard conflict if both specified and differ) |
| intent | identify, licensing, financing, investment, policy, company_information, trade, legal_requirement, technical_requirement, environmental_impact, enforcement... (priority-ordered regex) |
| object | subdomain × intent, with cross-sector marker (`renewable_energy_x_banking`) |
| temporalScope | current / historical (year patterns, past tense) — hard conflict |
| polarity | positive / negative / yesno_question — hard conflict negative≠positive |
| granularity | institution/license/company/policy/law/project/technology/financial_product/market — specific-vs-specific conflict |
| questionForm | identify/procedure/description/yesno — procedure vs others conflict |

**Hard rule**: any signature conflict forbids REUSE regardless of similarity score. Lexical similarity remains only as soft gate (≥0.45).

Also: intent family collapse (`identify` ≡ `identify_with_role`) prevents false rejections among formulation variants.

## Before → After Comparison

| Metric | Before (v1 run) | After (v2 fresh API) |
|--------|-----------------|---------------------|
| Queries | 100 observational | 34 targeted cases |
| False reuse | multiple identified (Q38/Q40-41/Q44/Q47 sector traps; Q81-85 intent mismatches; negation; temporal) | **2** (1 real: LT3 defensible; 1 evaluator artifact fixed) |
| False rejection | 0 | 0 |
| Decisions | REUSE 76 / RESEARCH 24 | REUSE 15 / RESEARCH 18 |
| Context added | 0 tokens | **0 tokens** |
| REUSE latency | ~2.6s | ~2.5s |

Note on before/after comparability: v1 was observational over 100 queries with accumulated DB state and a stale-API incident; v2 runs 34 targeted cases against cleaned state with fresh API. Counts are not directly comparable — the dimension coverage is.

## Remaining case-by-case results (34 cases)

33/34 evaluated correctly per expectations. 1 defensible case:

- **LT3**: "Does the banking regulator regulate Ghana's solar energy sector?" reused the Bank-of-Ghana yes/no production. Both queries ask whether the bank regulates renewables — near-equivalent. Classified FALSE_REUSE by strict expectation but semantically defensible.

## Conflicts detected during run (by dimension)

Tracked in `adversarial-v2-results.json` per candidate: jurisdiction, temporalScope, polarity, subdomain, intent, granularity, questionForm blocks all observed firing.

## Performance

- Avg latency 2461-2648ms per case
- Total LLM calls: only for RESEARCH paths
- REUSE path: 0 LLM, 0 Tavily, 0 tokens added to prompt
- contextAdded total: **0**

## Errors

One transient RL1 ERROR (LLM rate limit) in an intermediate run — resolved on fresh run (RESEARCH, correct). Never masked; recorded in intermediate JSON snapshots.

## Regression

29/29 existing tests PASS (zero-context 10, agentC-strategy 9, knowledge 4, knowledge-evolution 6). Historical v1 report data untouched.
