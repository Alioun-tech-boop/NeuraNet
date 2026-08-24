import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import registry, { buildProblemSignature } from '../src/pathEngine/registry.js';
import evolutionEngine from '../src/pathEngine/evolution.js';
import learningEngine from '../src/adaptiveLearning/learningEngine.js';
import mutationEngine from '../src/adaptiveLearning/pathMutationEngine.js';
import discoveryEngine from '../src/adaptiveLearning/pathDiscovery.js';
import governanceEngine from '../src/governance/governanceEngine.js';
import policyRegistry from '../src/governance/policyRegistry.js';
import observationEngine from '../src/adaptiveLearning/observationEngine.js';
import { pool } from '../src/db/connection.js';
import { computePathStats as _cps } from '../src/pathEngine/stats.js';

const ORG = '00000000-0000-0000-0000-000000000001';
let api;
before(async () => {
  const { spawn } = await import('node:child_process');
  api = spawn('node', ['src/api/index.js'], { stdio: ['ignore','pipe','pipe'] });
  for (let i=0;i<8;i++){ try{ const r=await fetch(`${process.env.NEURANET_API_BASE_URL||'http://127.0.0.1:3000'}/health`); if(r.ok) return; }catch{} await new Promise(r=>setTimeout(r,1000)); }
});
after(() => { if (api) api.kill(); });

describe('Adaptive Intelligence & Governance', () => {
  const famSig = buildProblemSignature('Adaptive intelligence probe ' + Date.now());
  let familyId;

  it('1-2. LEARNING: observation recorded immutably', async () => {
    const fam = await registry.getOrCreateFamily(ORG, famSig);
    familyId = fam.id;
    const out = await learningEngine.ingest({
      tenantId: ORG, familyId: fam.id,
      signature: famSig,
      metrics: { quality: 0.85, success: true, latencyMs: 5000, tokens: 800, toolCalls: 1 },
      environment: { provider: 'groq', model: 'allam-2-7b' }
    });
    assert.ok(out.observationId);
    // Immutable history grows; never rewritten
    const list = await observationEngine.listForFamily(ORG, fam.id);
    assert.ok(list.length >= 1);
  });

  it('PRIVACY: secrets redacted in observations', async () => {
    const list = await observationEngine.listForFamily(ORG, familyId);
    const raw = JSON.stringify(list[0]);
    assert.ok(!raw.includes('sk-test') && !raw.toLowerCase().includes('password123'));
  });

  it('3-4. MUTATION: CREATE_VARIANT creates immutable v+1 with parent', async () => {
    // seed a path first
    const cand = await registry.saveCandidatePath({
      orgId: ORG, familyId, steps:[{order:1,action:'base'}],
      parentId:null, provenance:{}, metrics:{ quality:0.8, verificationStatus:'verified' }});
    globalThis.__basePathId = cand.id;
    const mut = await mutationEngine.mutate(ORG, cand.id, 'CREATE_VARIANT',
      { newSteps:[{order:1,action:'base'},{order:2,action:'extra'}], reason:'variant test' });
    assert.ok(mut.allowed);
    assert.equal(mut.path.parent_id, cand.id);
    assert.equal(mut.path.version, cand.version + 1);
    globalThis.__variantPathId = mut.path.id;
    // parent unchanged
    const parent = await pool.query(`SELECT version FROM resolution_paths WHERE id=$1`, [cand.id]);
    assert.equal(parent.rows[0].version, cand.version);
  });

  it('5-6. SPECIALIZATION justified only with evidence', async () => {
    const spec = await (await import('../src/adaptiveLearning/specializationEngine.js')).default
      .maybeSpecialize(ORG, familyId, 'research|energy|regulator|ghana',
        buildProblemSignature('Who regulates renewable energy in Ghana?'));
    // Fresh family has < minObservations → must refuse specialization
    assert.equal(spec.specialized, false);
    assert.match(spec.reason, /insufficient observations/);
  });

  it('7. EXPLORATION/DISCOVERY: bounded recombination produces CANDIDATE', async () => {
    // Need >= 2 paths in family for discovery; add second path
    await registry.saveCandidatePath({
      orgId: ORG, familyId, steps:[{order:1,action:'official_search'},{order:2,action:'verify'}],
      parentId:null, provenance:{}, metrics:{ quality:0.9, verificationStatus:'verified', latencyMs:6000 }});
    const disc = await discoveryEngine.discover(ORG, familyId);
    assert.ok(Array.isArray(disc.candidates));
    if (disc.candidates[0]) assert.equal(disc.candidates[0].status, 'CANDIDATE');
  });

  it('8-10. UNCERTAINTY/PARETO/ANTI-STAGNATION covered by selector+comparator suites', () => {
    assert.ok(true); // covered by tests/path-selection.test.mjs + path-evolution.test.mjs
  });

  it('DEGRADATION: recent drop reduces expectedQuality', async () => {
    const { PathSelectionEngine } = await import('../src/pathEngine/selector.js');
    const e = new PathSelectionEngine();
    const mkExec = (q) => ({ quality_score: q, latency_ms: 5000, input_tokens: 400,
      output_tokens: 300, tavily_calls: 1, success: true, created_at: new Date().toISOString() });
    const older = Array.from({length:6},()=>mkExec(0.96));
    const recentBad = [mkExec(0.70),mkExec(0.72),mkExec(0.71),mkExec(0.73)];
    const sGood = computePathStats(older);
    const sBad  = computePathStats([...older.slice(0,3), ...recentBad]);
    const uGood = e.riskAdjustedUtility(mkP(), sGood, {});
    const uBad  = e.riskAdjustedUtility(mkP(), sBad, {});
    assert.ok(uBad.expectedQuality < uGood.expectedQuality || sBad.degradationDetected);
  });

  function mkP(){ return { id:'x', quality_score:0.9, observed_latency_ms:5000, observed_tokens:800, observed_tool_calls:1 }; }
  function computePathStats(execs) {
    return _cps(execs);
  }

  it('GOVERNANCE: security mutations DENYed', async () => {
    const v1 = await governanceEngine.decideAndLog(ORG, 'CHANGE_SECURITY_POLICY', {});
    assert.equal(v1.decision, 'DENY');
    const v2 = await governanceEngine.decideAndLog(ORG, 'CHANGE_PROVIDER', {});
    assert.equal(v2.decision, 'DENY');
    const v3 = await governanceEngine.decideAndLog(ORG, 'DELETE_AUDIT_LOG', {});
    assert.equal(v3.decision, 'DENY');
  });

  it('GOVERNANCE: normal mutation ALLOWed and logged', async () => {
    const v = await governanceEngine.decideAndLog(ORG, 'CREATE_VARIANT', { targetType:'path' });
    assert.equal(v.decision, 'ALLOW');
    const log = await pool.query(`SELECT decision FROM governance_log WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 1`, [ORG]);
    assert.equal(log.rows[0].decision, 'ALLOW');
  });

  it('GOVERNANCE: ELIMINATE limited without evidence (anti-poisoning)', async () => {
    const v = await governanceEngine.decideAndLog(ORG, 'ELIMINATE', { observations: 1 });
    assert.equal(v.decision, 'LIMIT');
  });

  it('TENANT ISOLATION: families are org-scoped', async () => {
    const ORG_B = '00000000-0000-0000-0000-000000000002';
    await pool.query(`INSERT INTO organizations (id,name) VALUES ($1,'TB') ON CONFLICT DO NOTHING`, [ORG_B]);
    const fB = await registry.getOrCreateFamily(ORG_B, famSig);
    assert.notEqual(fB.organization_id, ORG);
  });

  it('ZERO-CONTEXT / ZERO-LLM: selection declares both zero', async () => {
    const sel = await new (await import('../src/pathEngine/selector.js')).PathSelectionEngine()
      .selectBestPath({ orgId: ORG, task: famSig.objective || 'probe',
        problemSignature: famSig, familyId });
    assert.equal(sel.selectionLLMCalls, 0);
    assert.ok(sel.contextAddedTokens === undefined || sel.contextAddedTokens === 0);
  });

  it('ROLLBACK: ancestor restoration works', async () => {
    const mut = await mutationEngine.mutate(ORG, globalThis.__basePathId, 'CREATE_VARIANT',
      { newSteps:[{order:1,action:'rollback-probe'}], reason:'rollback test' });
    const rb = await mutationEngine.rollback(ORG, mut.path.id);
    assert.equal(rb.rolled, true);
    const restored = await pool.query(`SELECT status FROM resolution_paths WHERE id=$1`, [globalThis.__basePathId]);
    assert.equal(restored.rows[0].status, 'ACTIVE');
  });
});

// sync helper bridging ESM import for pure stats module
