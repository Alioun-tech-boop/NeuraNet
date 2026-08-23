# NeuraNet Quantitative Benchmark

## Tasks (10)
1. What is the main renewable energy regulator in Ghana, and what is its role?
2. Which institution regulates securities markets in Ghana, and what does it regulate?
3. Which institution is responsible for data protection in Ghana?
4. Which institution regulates telecommunications in Ghana?
5. Which institution is responsible for agricultural research in Ghana?
6. What is the main stock exchange in Ghana?
7. Which institution supervises banks in Ghana?
8. Which institution is responsible for public health regulation in Ghana?
9. Which institution manages environmental protection in Ghana?
10. Which institution is responsible for standards and quality regulation in Ghana?

## Table

| Task | Baseline | Cold | Warm |
|------|----------|------|------|
| 1 | RESEARCH 11868ms | RESEARCH | REUSE 960ms |
| 2 | RESEARCH 16454ms | RESEARCH | REUSE 924ms |
| 3 | RESEARCH 22988ms | RESEARCH | REUSE 910ms |
| 4 | RESEARCH 20848ms | RESEARCH | REUSE 926ms |
| 5 | RESEARCH 19764ms | RESEARCH | REUSE 963ms |
| 6 | RESEARCH 7868ms | RESEARCH | REUSE 747ms |
| 7 | RESEARCH 20721ms | RESEARCH | REUSE 964ms |
| 8 | RESEARCH 28652ms | RESEARCH | REUSE 915ms |
| 9 | RESEARCH 11674ms | RESEARCH | REUSE 749ms |
| 10 | undefined 2925ms | undefined | undefined 2186ms |

## Summary

Baseline: median 18109ms, tokens 9777, LLM 9, Tavily 9, quality NaN

Cold: median 18109ms, tokens 9777

Warm: median 925ms, tokens 0, reuse 90.0%

Research avoidance: 90.0%
Tavily avoidance: 100.0%
LLM avoidance: 100.0%
Speedup: 19.58x

Preliminary benchmark; larger repeated experiments are required for statistical significance.
