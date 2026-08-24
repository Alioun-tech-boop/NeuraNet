import 'dotenv/config';
import evolutionEngine from '../src/pathEngine/evolution.js';
import { buildProblemSignature } from '../src/pathEngine/signature.js';
import registry from '../src/pathEngine/registry.js';
import { pool } from '../src/db/connection.js';

// Multi-domain convergence demonstration: research + code + finance families
const ORG = '00000000-0000-0000-0000-000000000001';
const SEQUENCES = [
  { family: 'research_energy', domain: 'research', tasks: [
    { q: 'Who regulates renewable energy in Ghana?', steps: ['classify','official_search','cross_check','verify'], m: { quality: 0.72, verificationStatus: 'partially_verified', latencyMs: 9000, tokens: 950, toolCalls: 2 } },
    { q: 'Which authority oversees renewable energy in Ghana?', steps: ['classify','official_search','verify'], m: { quality: 0.85, verificationStatus: 'verified', latencyMs: 6500, tokens: 820, toolCalls: 1 } },
    { q: 'What Ghanaian body handles renewable energy matters?', steps: ['classify','official_search','cross_check','verify'], m: { quality: 0.91, verificationStatus: 'verified', latencyMs: 5200, tokens: 780, toolCalls: 1 } }
  ]},
  { family: 'code_api_jwt', domain: 'code', tasks: [
    { q: 'Create secure Express API with JWT', steps: ['analyze','generate','test'], m: { quality: 0.65, verificationStatus: 'unverified', latencyMs: 12000, tokens: 1500, toolCalls: 1 } },
    { q: 'Create secure Express API with JWT and refresh rotation', steps: ['analyze','generate','unit_test','lint'], m: { quality: 0.80, verificationStatus: 'partially_verified', latencyMs: 11000, tokens: 1400, toolCalls: 2 } },
    { q: 'Create hardened Express API with JWT, tests and security scan', steps: ['analyze','generate','unit_test','integration_test','security_scan'], m: { quality: 0.94, verificationStatus: 'verified', latencyMs: 10500, tokens: 1350, toolCalls: 3 } }
  ]},
  { family: 'finance_market', domain: 'finance', tasks: [
    { q: 'Analyze the Ghana stock market performance', steps: ['data','validate','indicators','analysis'], m: { quality: 0.70, verificationStatus: 'partially_verified', latencyMs: 8000, tokens: 1000, toolCalls: 2 } },
    { q: 'Analyze Ghana stock market with validated data sources', steps: ['data','validate_data','validate','indicators','analysis','cross_check'], m: { quality: 0.90, verificationStatus: 'verified', latencyMs: 7500, tokens: 900, toolCalls: 3 } }
  ]}
];

console.log('=== MULTI-DOMAIN CONVERGENCE TEST ===\n');
const report = [];

for (const seq of SEQUENCES) {
  console.log(`--- ${seq.family} (${seq.domain}) ---`);
  const fam = await registry.getOrCreateFamily(ORG,
    buildProblemSignature(seq.tasks[0].q, seq.domain));
  await pool.query(`DELETE FROM problem_families WHERE id=$1`, [fam.id]);
  const fresh = await registry.getOrCreateFamily(ORG,
    buildProblemSignature(seq.tasks[0].q, seq.domain));

  for (let i = 0; i < seq.tasks.length; i++) {
    const t = seq.tasks[i];
    const obs = await evolutionEngine.observe({
      orgId: ORG, task: t.q, domainOverride: seq.domain,
      steps: t.steps.map((a, j) => ({ order: j+1, action: a })),
      metrics: { quality: t.m.quality, verificationStatus: t.m.verification === undefined ? t.m.verificationStatus : (t.m.verificationStatus || 'unverified'), latencyMs: t.m.latencyMs, tokens: t.m.tokens, toolCalls: t.m.toolCalls, sourceCount: 3 },
      provenance: { reason: `step ${i+1} of convergence sequence` }
    });
    console.log(`  T${i+1}: quality=${t.m.quality} bestKnown=${obs.canonicalAfterId?.slice(0,8)} eliminated=${obs.eliminatedThisRound}`);
    if (i === seq.tasks.length - 1) {
      const snap = await evolutionEngine.snapshot(ORG, fresh.id);
      report.push({ family: seq.family, domain: seq.domain, paths: snap.paths.length, pareto: snap.paretoFrontierIds.length, best: snap.bestKnownPathAtTimeT?.slice(0,8), finalQuality: Math.max(...snap.paths.map(p=>parseFloat(p.quality_score)||0)) });
    }
  }
}

console.log('\n=== CONVERGENCE RESULTS ===');
for (const r of report) {
  console.log(`${r.family}: paths=${r.paths}, pareto=${r.pareto}, best=${r.best}, maxQuality=${r.finalQuality}`);
}
const allConverged = report.every(r => r.best);
console.log(`\nCONVERGENCE: ${allConverged ? 'PASS' : 'FAIL'}`);
await pool.end();
process.exit(allConverged ? 0 : 1);
