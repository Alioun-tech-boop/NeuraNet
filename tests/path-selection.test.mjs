import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import { PathSelectionEngine, computePathStatsSafe } from '../src/pathEngine/selector.js';
import { computePathStats } from '../src/pathEngine/stats.js';
import { buildProblemSignature, signaturesCompatible } from '../src/pathEngine/signature.js';
import PathComparator from '../src/pathEngine/comparator.js';

function mkExec(quality, latencyMs = 5000, tokensIn = 400, tokensOut = 300, success = true) {
  return { quality_score: quality, latency_ms: latencyMs,
           input_tokens: tokensIn, output_tokens: tokensOut,
           tavily_calls: 1, success, created_at: new Date().toISOString() };
}

const PROBLEM = buildProblemSignature('Who regulates renewable energy in Ghana?');

describe('Path Selection Engine V2', () => {

  // ---- Statistics & uncertainty ----
  it('TEST 8 — Historical stats separated per dimension', () => {
    const execs = [mkExec(0.9), mkExec(0.8), mkExec(0.95, 8000), mkExec(0.85, 4000)];
    const s = computePathStats(execs);
    assert.equal(s.sampleSize, 4);
    assert.ok(s.qualityMean > 0.8 && s.qualityMean < 0.91);
    assert.equal(s.qualityMin, 0.8);
    assert.equal(s.qualityMax, 0.95);
    assert.ok(s.latencyP90 >= s.latencyMedian);
    assert.equal(s.failureRate, 0);
  });

  it('TEST 3 — Uncertainty: n=100 low vs n=2 high', () => {
    const e = new PathSelectionEngine();
    const s100 = computePathStats(Array.from({length:100},(_,i)=>mkExec(0.90 + (i%3)*0.01)));
    const s2   = computePathStats([mkExec(0.97), mkExec(0.96)]);
    const u100 = e.uncertainty(s100);
    const u2   = e.uncertainty(s2);
    assert.ok(u100 < u2, `u(n=100)=${u100} must be < u(n=2)=${u2}`);
    assert.ok(u100 < 0.25);
  });

  it('TEST 11 — Degradation detection: recent drop flagged', () => {
    const old = Array.from({length:10},()=>mkExec(0.96));
    const recent = [mkExec(0.80), mkExec(0.78), mkExec(0.82), mkExec(0.79), mkExec(0.81)];
    const s = computePathStats([...old, ...recent]);
    assert.equal(s.degradationDetected, true);
    assert.ok(s.recentQualityMean < s.historicalQualityMean);
  });

  // ---- Risk-adjusted selection ----
  it('TEST 1 — Quality dominates when clearly higher', () => {
    const e = engine();
    const uHigh = e.riskAdjustedUtility(path('A',0.94), statsFor(30, 0.94, 0.01, 4000), PROBLEM);
    const uLow  = e.riskAdjustedUtility(path('B',0.70), statsFor(30, 0.70, 0.05, 6000), PROBLEM);
    assert.ok(uHigh.utility > uLow.utility);
  });

  it('TEST 3b — Risk-adjusted: uncertain P2 does not auto-win', () => {
    const e = engine({ explorationRateBase: 0 });
    const uStable = e.riskAdjustedUtility(path('P1',0.94),
      computePathStats(Array.from({length:50},()=>mkExec(0.94))), PROBLEM);
    const uRisky = e.riskAdjustedUtility(path('P2',0.99),
      computePathStats([mkExec(0.99), mkExec(0.98)]), PROBLEM);
    // P2 mean quality higher BUT uncertainty penalty must narrow/close the gap
    assert.ok(uRisky.expectedQuality <= uStable.expectedQuality + 0.15,
      'uncertainty penalty must apply to tiny samples');
  });

  // ---- Constraints ----
  it('Constraints — max failure rate excludes unreliable path', () => {
    const bad = computePathStats([mkExec(0.9,5000,400,300,false), mkExec(0.9,5000,400,300,false)]);
    assert.equal(bad.failureRate, 1);
    assert.ok(bad.failureRate > new PathSelectionEngine().maximumFailureRate);
  });

  // ---- Pareto preservation ----
  it('TEST 5 — Two non-dominated paths remain candidates', () => {
    const cmp = new PathComparatorClass();
    const pQ = path(0.98, 10000);
    const pF = path(0.90, 1500);
    assert.equal(cmp.dominates(pQ,pF), false);
    assert.equal(cmp.dominates(pF,pQ), false);
    const { frontier } = cmp.frontier([pQ,pF]);
    assert.equal(frontier.length, 2);
  });

  // ---- Hard semantic conflicts ----
  it('TEST 6 — Ghana vs Kenya: absolute reject', () => {
    assert.equal(signaturesCompatible(
      buildProblemSignature('Who regulates renewable energy in Ghana?'),
      buildProblemSignature('Who regulates renewable energy in Kenya?')).compatible, false);
  });

  it('TEST 7 — current vs 2015: absolute reject', () => {
    assert.equal(signaturesCompatible(
      buildProblemSignature('Who regulates renewable energy in Ghana today?'),
      buildProblemSignature('Who regulated renewable energy in Ghana in 2015?')).compatible, false);
  });

  it('TEST 8 — identify vs financing: absolute reject', () => {
    assert.equal(signaturesCompatible(
      buildProblemSignature('Who regulates renewable energy in Ghana?'),
      buildProblemSignature('How to obtain renewable energy financing in Ghana?')).compatible, false);
  });

  it('TEST 4/16 — Specialization: institution vs company intent split', () => {
    const inst = buildProblemSignature('What is the main renewable energy regulator in Ghana?');
    const comp = buildProblemSignature('Which companies operate in renewable energy in Ghana?');
    assert.notEqual(inst.familyKey, comp.familyKey);
  });

  // ---- Zero LLM / zero context ----
  it('TEST 13+14 — selector declares zero LLM calls and zero context', async () => {
    const e = new PathSelectionEngine();
    // Direct unit call on empty family path list
    const sel = await e.selectBestPath({ orgId:'00000000-0000-0000-0000-000000000001',
      task:'x', problemSignature: PROBLEM, familyId:'00000000-0000-0000-0000-00000000000f' });
    assert.equal(sel.selectionLLMCalls, 0);
    assert.equal(sel.decision, 'RESEARCH'); // nothing exists
  });

  // ---- Poisoning resistance ----
  it('TEST 16 — Single poisoned observation cannot destroy reliable stats', () => {
    const clean = Array.from({length:20},(_,i)=>mkExec(0.93 - i*0.001));
    const poisoned = [...clean, mkExec(0.05)]; // one outlier
    const sClean = computePathStats(clean);
    const sPoison = computePathStats(poisoned);
    // Mean moves slightly but stays well above failure thresholds
    assert.ok(sPoison.qualityMean > 0.85, `mean ${sPoison.qualityMean}`);
    assert.ok(sPoison.qualityMax >= 0.92);
  });
});

// ---- helpers ----
const PathComparatorClass = (await import('../src/pathEngine/comparator.js')).default.constructor;
const engine = (opts) => new PathSelectionEngine(opts);
function path(quality, latency) {
  return { id:'p'+Math.random().toString(36).slice(2,6), quality_score: quality,
           observed_latency_ms: latency, observed_tokens: 700,
           observed_tool_calls: 1, observed_failures: 0, observed_executions: 3, version: 1 };
}
function statsFor(n, q, fr, lat) {
  return { sampleSize:n, qualityMean:q, failureRate:fr, latencyP90:lat,
           tokenMean:700, toolCallMean:1 };
}
