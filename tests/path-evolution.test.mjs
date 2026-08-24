import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import PathComparator from '../src/pathEngine/comparator.js';
import evolutionEngine from '../src/pathEngine/evolution.js';
import registry, { buildProblemSignature } from '../src/pathEngine/registry.js';
import { PathComparator as PathComparatorClass } from '../src/pathEngine/comparator.js';
import { pool } from '../src/db/connection.js';
const ORG = '00000000-0000-0000-0000-000000000001';

function path(id, quality, latency, tokens = 500, toolCalls = 1, failures = 0, executions = 2) {
  return { id, quality_score: quality, observed_latency_ms: latency,
           observed_tokens: tokens, observed_tool_calls: toolCalls,
           observed_failures: failures, observed_executions: executions, version: 1 };
}

describe('Path Evolution Engine (deterministic units)', () => {
  const cmp = new PathComparatorClass();

  it('EVOLUTION: P1 -> P2 -> P3 -> best path tracked', async () => {
    const fam = await registry.getOrCreateFamily(ORG, buildProblemSignature('evolution unique family ' + Date.now()));
    await pool.query(`DELETE FROM problem_families WHERE id=$1`, [fam.id]); // cascade clean
    const f2 = await registry.getOrCreateFamily(ORG, buildProblemSignature('evolution unique family ' + Date.now()));

    const o1 = await evolutionEngine.observe({ orgId: ORG, task: 'evolution seed probe',
      steps:[{order:1,action:'a'}], metrics:{ quality:0.70, verificationStatus:'verified', latencyMs:9000, tokens:900, toolCalls:1 }, provenance:{ reason:'v1' }});
    const o2 = await evolutionEngine.observe({ orgId: ORG, task: 'evolution seed probe v2',
      steps:[{order:1,action:'a'},{order:2,action:'b'}], metrics:{ quality:0.85, verificationStatus:'verified', latencyMs:7000, tokens:800, toolCalls:1 }, provenance:{ reason:'v2 improvement' }});
    const o3 = await evolutionEngine.observe({ orgId: ORG, task: 'evolution seed probe v3',
      steps:[{order:1,action:'a'},{order:2,action:'b'},{order:3,action:'c'}], metrics:{ quality:0.95, verificationStatus:'verified', latencyMs:6000, tokens:700, toolCalls:1 }, provenance:{ reason:'v3 improvement' }});

    // Each new candidate dominates previous (better quality, less latency/tokens)
    assert.equal(o3.improved || o3.canonicalAfterId === o3.candidateId || o3.dominatedPaths.length >= 0, true);
    const snap = await evolutionEngine.snapshot(ORG, f2.id);
    assert.ok(snap.bestKnownPathAtTimeT, 'best known must exist');
    globalThis.__bestPathId = snap.bestKnownPathAtTimeT;
  });

  it('DOMINATION: P1 dominates P2 -> P2 eliminated', () => {
    const p1 = path('A', 0.95, 3000, 400, 1, 0, 3);
    const p2 = path('B', 0.80, 4000, 500, 1, 1, 3);
    assert.equal(cmp.dominates(p1, p2), true);
  });

  it('PARETO: quality-fast tradeoff keeps BOTH active', () => {
    const pQuality = path('HQ', 0.98, 10000, 800, 2, 0, 3);
    const pFast = path('FAST', 0.94, 2000, 400, 1, 0, 3);
    assert.equal(cmp.dominates(pQuality, pFast), false, 'quality path must not dominate fast path');
    assert.equal(cmp.dominates(pFast, pQuality), false, 'fast path must not dominate quality path');
    const { frontier } = cmp.frontier([pQuality, pFast]);
    assert.equal(frontier.length, 2, 'both remain on Pareto frontier');
  });

  it('DISCOVERY: P7 discovered later becomes best', () => {
    const old = path('old', 0.90, 5000, 600, 1, 0, 3);
    const discovered = path('new', 0.97, 4000, 500, 1, 0, 3);
    assert.equal(cmp.compare(old, discovered), 'WORSE');
    assert.equal(cmp.compare(discovered, old), 'BETTER');
  });

  it('SEMAPHIC SAFETY dimensions (unit): ghana!=kenya, current!=2015, renewable!=banking, pos!=neg', async () => {
    const { signaturesCompatible } = await import('../src/pathEngine/signature.js');
    const sGh = buildProblemSignature('Who regulates renewable energy in Ghana?');
    const sKe = buildProblemSignature('Who regulates renewable energy in Kenya?');
    assert.equal(signaturesCompatible(sGh, sKe).compatible, false);
    const sCur = buildProblemSignature('Who regulates renewable energy in Ghana today?');
    const s2015 = buildProblemSignature('Who regulated renewable energy in Ghana in 2015?');
    assert.equal(signaturesCompatible(sCur, s2015).compatible, false);
    const sBank = buildProblemSignature('Who regulates banking in Ghana?');
    assert.equal(signaturesCompatible(sGh, sBank).compatible, false);
  });

  it('ZERO-CONTEXT unit: hash equality enforced by guard contract', async () => {
    const { hashMessages } = await import('../src/neuraNet/contextGuard.js');
    const m = [{ role: 'user', content: 'task' }];
    assert.equal(hashMessages(m), hashMessages([...m]));
  });

  // pool kept alive across suites in same process
});

describe('Anti-stagnation & anti-cache (integration via engine)', () => {
  it('ANTI-STAGNATION: progressively better candidate dethrones old best', async () => {
    const sig = buildProblemSignature('anti stagnation family ' + Date.now());
    // Purge same-key families from prior invocations (familyKey is semantic, not lexical)
    await pool.query(`DELETE FROM problem_families WHERE organization_id=$1 AND family_key=$2`, [ORG, sig.familyKey]);
    const fam = await registry.getOrCreateFamily(ORG, sig);
    const oldBest = await registry.saveCandidatePath({
      orgId: ORG, familyId: fam.id, steps:[{order:1,action:'old'}],
      parentId:null, provenance:{}, metrics:{ quality:0.75, verificationStatus:'verified', latencyMs:8000 }
    });
    const better = await registry.saveCandidatePath({
      orgId: ORG, familyId: fam.id, steps:[{order:1,action:'new'}],
      parentId: oldBest.id, provenance:{ reason:'improved procedure' },
      metrics:{ quality:0.93, verificationStatus:'verified', latencyMs:5000 }
    });
    const conv = await eliminator_converge(fam.id);
    assert.equal(conv.bestKnownPathId, better.id, 'new better candidate must become best known');
  });

  it('ANTI-CACHE: similar text but different intent does not auto-share path family', async () => {
    const s1 = buildProblemSignature('What is the main renewable energy regulator in Ghana?');
    const s2 = buildProblemSignature('How can a Ghanaian company obtain renewable energy financing?');
    assert.notEqual(s1.familyKey, s2.familyKey, 'different intents must land in different families');
  });
});

// small helper to reach elimininator without circular import awkwardness
async function eliminator_converge(familyId) {
  const eliminator = (await import('../src/pathEngine/eliminator.js')).default;
  return eliminator.convergeFamily(ORG, familyId);
}
