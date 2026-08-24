import 'dotenv/config';
import { PathExecutor } from '../src/pathEngine/executor.js';
import graph from '../src/pathEngine/graph.js';
import { pool } from '../src/db/connection.js';

// Step-type executor demonstration: research + code + finance paths
const executor = new PathExecutor();

const PATHS = [
  { family: 'research_energy', steps: [
    { order:1, action:'classify', params:{ classification:'regulatory' } },
    { order:2, action:'authoritative_search', queryPattern:'Ghana Energy Commission renewable energy regulator' },
    { order:3, action:'deduplicate' },
    { order:4, action:'source_rank' },
    { order:5, action:'cross_check' },
    { order:6, action:'verify' }
  ]},
  { family: 'code_api', steps: [
    { order:1, action:'classify', params:{ classification:'backend_api' } },
    { order:2, action:'web_search', queryPattern:'Express JWT best practices official docs' },
    { order:3, action:'deduplicate' },
    { order:4, action:'verify' }
  ]},
  { family: 'finance_analysis', steps: [
    { order:1, action:'cache_check' },
    { order:2, action:'web_search', queryPattern:'Ghana stock exchange market analysis' },
    { order:3, action:'source_rank' },
    { order:4, action:'verify' }
  ]}
];

console.log('=== GENERIC PATH EXECUTOR — MULTI-DOMAIN ===\n');

let allOk = true;

for (const p of PATHS) {
  const ctx = { task: 'multi-domain probe', queryHash: 'diag-' + Date.now(), orgId: '00000000-0000-0000-0000-000000000001' };
  const r = await executor.execute(p.steps, ctx);
  const types = r.stepResults.map(s=>s.type).join(' → ');
  console.log(`${p.family}: success=${r.success} searchCalls=${r.searchCalls}`);
  console.log(`  steps: ${types}`);
  console.log(`  sources found: ${(r.context.searchResults||[]).length}, crossChecked=${!!r.context.crossChecked}`);
  if (!r.success) allOk = false;
}
console.log(`\nEXECUTOR: ${allOk ? 'PASS' : 'FAIL'}`);

// Graph: record edges from a synthetic execution then read strongest sub-path
console.log('\n=== PATH GRAPH (sub-path discovery) ===');
// Seed edges from three observed executions of the same family
const fam = await pool.query(
  `INSERT INTO problem_families (organization_id, family_key, domain, intent, signature)
   VALUES ('00000000-0000-0000-0000-000000000001', 'GRAPH_DEMO', 'research', 'identify', '{}')
   ON CONFLICT (organization_id, family_key) DO UPDATE SET updated_at = NOW() RETURNING id`);
const fid = fam.rows[0].id;
const ORG = '00000000-0000-0000-0000-000000000001';
await pool.query(`DELETE FROM path_edges WHERE family_id=$1`, [fid]);
const runs = [
  ['classify','official_search'],['official_search','cross_check'],
  ['cross_check','verify'],['verify','synthesize'],
  ['classify','blog_search'],['blog_search','verify'],
  ['official_search','cross_check'],['cross_check','verify']
];
for (const [f,t] of runs) {
  await pool.query(
    `INSERT INTO path_edges (organization_id, family_id, from_step, to_step, weight, success_weight)
     VALUES ($1,$2,$3,$4,1,$5) ON CONFLICT (organization_id, family_id, from_step, to_step)
     DO UPDATE SET weight = path_edges.weight+1, success_weight = path_edges.success_weight + EXCLUDED.success_weight`,
    [ORG, fid, f, t, f==='official_search'||t==='verify' ? 1 : 0]);
}
const strongest = await graph.strongestEdges(ORG, fid, 5);
for (const e of strongest) console.log(`  ${e.from_step} -> ${e.to_step} (w=${e.weight}, success=${e.success_ratio})`);
const bestSub = await graph.bestSubPath(ORG, fid);
console.log('Best shared sub-path:', bestSub.subPath.join(' -> '));
console.log(`GRAPH: ${strongest.length>0 && bestSub.subPath.length>0 ? 'PASS' : 'FAIL'}`);
process.exit(allOk && strongest.length > 0 ? 0 : 1);
