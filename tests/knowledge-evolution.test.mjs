import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';

const BASE = process.env.NEURANET_API_BASE_URL || 'http://127.0.0.1:3000';
const KEY = process.env.NEURANET_API_KEY || 'neuranet-dev-key';
let api;

before(async () => {
  const { spawn } = await import('node:child_process');
  api = spawn('node', ['src/api/index.js'], { stdio: 'pipe' });
  for(let i=0;i<10;i++){ try{ const r=await fetch(`${BASE}/health`); if(r.ok) break; }catch{} await new Promise(r=>setTimeout(r,1000)); }
});

after(() => { if(api) api.kill(); });

async function q(query, agentId) {
  const res = await fetch(`${BASE}/v1/knowledge/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    body: JSON.stringify({ query, agentId, llm: { provider: process.env.SEMANTIC_TEST_PROVIDER || 'groq', model: process.env.GROQ_MODEL || 'allam-2-7b' } })
  });
  return { status: res.status, data: await res.json() };
}

describe('Knowledge Evolution', () => {
  const task = `Evolution test ${Date.now()} ${Math.random().toString(36).slice(2,6)}`;

  it('1. initial research', async () => {
    const { status, data } = await q(task, 'agent-a');
    assert.equal(status, 200);
    assert.equal(data.decision, 'RESEARCH');
    globalThis.prodA = data.production.id;
  });

  it('2. direct reuse', async () => {
    const { status, data } = await q(task, 'agent-b');
    assert.equal(status, 200);
    assert.equal(data.decision, 'REUSE');
    assert.equal(data.metrics.tavilyCalls, 0);
  });

  it('3. better production replaces canonical', async () => {
    // Create better manually via engine
    const { default: engine } = await import('../src/productions/engine.js');
    const { pool } = await import('../src/db/connection.js');
    const hash = engine.hashQuery(engine.normalizeQuery(task));
    const org = '00000000-0000-0000-0000-000000000001';
    const cluster = await engine.ensureCluster(org, hash, 'general');
    const prodB = await engine.createProduction({
      organizationId: org, agentId: null, originalQuery: task, normalizedQuery: engine.normalizeQuery(task),
      queryHash: hash, answer: 'Better answer', domain: 'general',
      claims: [{claim:'Better', verificationStatus:'verified'}], sources: [{url:'https://example.com'}],
      verificationStatus: 'verified', confidence: 0.95, qualityScore: 1.0, freshnessScore: 1.0, clusterId: cluster.id
    });
    const prodA = await pool.query(`SELECT * FROM productions WHERE id = $1`, [globalThis.prodA]);
    const cmp = engine.compareProductions(prodA.rows[0], prodB);
    assert.equal(cmp, 'BETTER');
    await engine.updateCanonical(cluster.id, prodB.id);
    const checkB = await pool.query(`SELECT is_canonical FROM productions WHERE id=$1`, [prodB.id]);
    assert.equal(checkB.rows[0].is_canonical, true);
    globalThis.prodB = prodB.id;
  });

  it('4. future agent reuses improved production', async () => {
    const { status, data } = await q(task, 'agent-d');
    assert.equal(status, 200);
    assert.equal(data.decision, 'REUSE');
    assert.equal(data.production.id, globalThis.prodB);
  });

  it('5. old production remains in history', async () => {
    const { pool } = await import('../src/db/connection.js');
    const r = await pool.query(`SELECT is_canonical, status FROM productions WHERE id=$1`, [globalThis.prodA]);
    assert.equal(r.rows[0].is_canonical, false);
    assert.ok(r.rows[0].status === 'superseded' || r.rows[0].status === 'active');
  });

  it('6. provenance remains intact', async () => {
    const { status, data } = await q(task, 'agent-e');
    assert.equal(status, 200);
    assert.ok(data.provenance.productionId);
    assert.ok(data.provenance.canonicalProductionId);
  });
});
