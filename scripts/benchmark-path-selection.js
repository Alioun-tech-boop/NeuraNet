import 'dotenv/config';
import { PathSelectionEngine } from '../src/pathEngine/selector.js';
import { computePathStats } from '../src/pathEngine/stats.js';
import { PathComparator } from '../src/pathEngine/comparator.js';

/**
 * Benchmark: OLD selector (weighted best-known, no uncertainty/degradation)
 * vs V2 Path Selection Engine (uncertainty + risk + degradation + Pareto).
 *
 * Deterministic simulation — no DB, no LLM. Pure selection-behavior comparison.
 */

const e = new PathSelectionEngine({ explorationRateBase: 0 });
const cmp = new PathComparator();

function mkExec(q, latency = 5000) {
  return { quality_score: q, latency_ms: latency, input_tokens: 400,
           output_tokens: 300, tavily_calls: 1, success: true,
           created_at: new Date().toISOString() };
}
function mkPath(id, q, l, execs = 20, toks = 700) {
  return { id, quality_score: q, observed_latency_ms: l, observed_tokens: toks,
           observed_tool_calls: 1, observed_failures: 0,
           observed_executions: execs, version: 1 };
}

function oldUtility(p) {
  // Old selector: weighted quality+speed only, no uncertainty/degradation
  return (p.quality_score||0.5)*0.7 + (1 - Math.min((p.observed_latency_ms||0)/30000,1))*0.3;
}

console.log('=== PATH SELECTION BENCHMARK: OLD vs V2 ===\n');

let v2Score = 0;

// --- Scenario 1: Uncertainty discrimination ---
console.log('--- S1. Uncertainty discrimination ---');
const stable = mkPath('stable-0.94', 0.94, 4000);
const risky = mkPath('risky-0.97', 0.97, 3500, undefined, undefined, 2);
risky.observed_tokens = 550;
const sStable = computePathStats(Array.from({length:50},(_,i)=>mkExec(0.94 - i*0.0005)));
const sRisky = computePathStats([mkExec(0.97), mkExec(0.96)]);
const uStable = e.riskAdjustedUtility(stable, sStable, {});
const uRisky = e.riskAdjustedUtility(risky, sRisky, {});
const oldPick = oldUtility(risky) > oldUtility(stable) ? 'risky' : 'stable';
const v2Pick = uStable.utility >= uRisky.utility ? 'stable' : 'risky';
console.log(`OLD picks: ${oldPick} | V2 picks: ${v2Pick}`);
console.log(`V2 uncertainty: stable=${uStable.uncertainty} risky=${uRisky.uncertainty} → penalizes tiny-sample champion`);
if (v2Pick === 'stable') v2Score++;

// --- Scenario 2: Degradation detection ---
console.log('\n--- S2. Degradation detection ---');
const execsStable = Array.from({length:20},()=>mkExec(0.92));
const execsDegrading = [...Array.from({length:15},()=>mkExec(0.96)),
                        ...Array.from({length:8},()=>mkExec(0.78))];
const pS = mkPath('stable-0.92', 0.92); const pD = mkPath('degrading-0.96avg', 0.90);
const sS = computePathStats(execsStable); const sD = computePathStats(execsDegrading);
const uS = e.riskAdjustedUtility(pS, sS, {});
const uD = e.riskAdjustedUtility(pD, sD, {});
console.log(`OLD picks: ${oldUtility(pD) > oldUtility(pS) ? 'degrading' : 'stable'} (blind to degradation)`);
console.log(`V2: stable utility=${uS.utility}, degrading utility=${uD.utility} (degradationDetected=${sD.degradationDetected})`);
if (uS.utility > uD.utility || sD.degradationDetected) v2Score++;

// --- Scenario 3: Pareto preserved ---
console.log('\n--- S3. Pareto preservation ---');
const pQ = mkPath('quality-path', 0.98, 12000, 900, 2);
const pF = mkPath('fast-path', 0.93, 1500, 500, 1);
const dQF = cmp.dominates(pQ, pF), dFQ = cmp.dominates(pF, pQ);
const bothActive = !dQF && !dFQ;
const oldEliminatedFast = oldUtility(pQ) > oldUtility(pF);
console.log(`OLD would eliminate fast-path: ${oldEliminatedFast}`);
console.log(`V2 Pareto: both remain active=${bothActive} (quality path and fast path coexist)`);
if (bothActive) v2Score++;

// --- Scenario 4: Statistical requirement blocks hairline domination ---
console.log('\n--- S4. No single-observation domination ---');
const veteran = mkPath('veteran', 0.90, 4000, 600, 1, 0, 30);
const rookie = mkPath('rookie-once', 0.93, 3800, 550, 1, 0, 1);
rookie.observed_executions = 1; veteran.observed_executions = 30;
const rookieDominates = cmp.dominates(rookie, veteran);
console.log(`Single-observation rookie dominates 30x veteran: ${rookieDominates} (must be false)`);
if (!rookieDominates) v2Score++;

console.log('\n=== RESULTS ===');
console.log(`V2 correct behavior: ${v2Score}/4 scenarios`);
console.log('Observation benchmark — no statistical significance claim.');
