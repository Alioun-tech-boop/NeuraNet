/**
 * Benchmark Comparatif - Baseline vs NeuraNet
 * Per PRD §37-38: mesure tokens, recherches, latence, qualité
 */
import 'dotenv/config';
import { ExperimentRunner } from './experimentRunner.js';

const TASK = process.env.EXPERIMENT_TASK || 'Analyze the market for solar panels in Ghana';
const RUNS = 2; // 2 runs per mode for moyenne

function fmt(n, d=2) { return typeof n === 'number' ? n.toFixed(d) : String(n); }
function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

async function runMode(mode, run) {
  console.log(`\n--- ${mode.toUpperCase()} run ${run}/${RUNS} ---`);
  const res = await ExperimentRunner.runExperiment({ task: TASK, mode });
  if (!res) throw new Error(`No result for ${mode}`);
  const section = mode === 'baseline' ? res.baseline : res.neuranet;
  return {
    durationMs: section.durationMs || 0,
    inputTokens: section.inputTokens || 0,
    outputTokens: section.outputTokens || 0,
    totalTokens: (section.inputTokens||0)+(section.outputTokens||0),
    searchCalls: section.searchCalls || 0,
    estimatedCost: section.estimatedCost || 0,
    qualityScore: section.qualityScore || 0,
    experiences: section.experiences || [],
    experiencesRetrieved: section.experiencesRetrieved || 0,
    experiencesEligible: section.experiencesEligible || 0,
    experiencesFiltered: section.experiencesFiltered || 0,
    strategiesExtracted: section.strategiesExtracted || 0,
    strategiesSelected: section.strategiesSelected || 0,
    strategiesRejected: section.strategiesRejected || 0,
    extractionRate: section.extractionRate || 0,
    selectionRate: section.selectionRate || 0,
    allSuccess: section.experiences ? section.experiences.every(e=>e.success) : false
  };
}

async function main() {
  console.log('========================================');
  console.log('NEURANET BENCHMARK COMPARATIF');
  console.log('========================================');
  console.log('Task:', TASK);
  console.log('Runs per mode:', RUNS);
  console.log('========================================');

  const baselineRuns = [];
  const neuranetRuns = [];

  for (let i=1;i<=RUNS;i++) baselineRuns.push(await runMode('baseline', i));
  for (let i=1;i<=RUNS;i++) neuranetRuns.push(await runMode('neuranet', i));

  const b = {
    durationMs: avg(baselineRuns.map(r=>r.durationMs)),
    totalTokens: avg(baselineRuns.map(r=>r.totalTokens)),
    searchCalls: avg(baselineRuns.map(r=>r.searchCalls)),
    estimatedCost: avg(baselineRuns.map(r=>r.estimatedCost)),
    qualityScore: avg(baselineRuns.map(r=>r.qualityScore)),
    experiencesRetrieved: avg(baselineRuns.map(r=>r.experiencesRetrieved)),
    experiencesEligible: avg(baselineRuns.map(r=>r.experiencesEligible)),
    strategiesExtracted: avg(baselineRuns.map(r=>r.strategiesExtracted)),
    strategiesSelected: avg(baselineRuns.map(r=>r.strategiesSelected)),
    extractionRate: avg(baselineRuns.map(r=>r.extractionRate))
  };
  const n = {
    durationMs: avg(neuranetRuns.map(r=>r.durationMs)),
    totalTokens: avg(neuranetRuns.map(r=>r.totalTokens)),
    searchCalls: avg(neuranetRuns.map(r=>r.searchCalls)),
    estimatedCost: avg(neuranetRuns.map(r=>r.estimatedCost)),
    qualityScore: avg(neuranetRuns.map(r=>r.qualityScore)),
    experiencesRetrieved: avg(neuranetRuns.map(r=>r.experiencesRetrieved)),
    experiencesEligible: avg(neuranetRuns.map(r=>r.experiencesEligible)),
    strategiesExtracted: avg(neuranetRuns.map(r=>r.strategiesExtracted)),
    strategiesSelected: avg(neuranetRuns.map(r=>r.strategiesSelected)),
    extractionRate: avg(neuranetRuns.map(r=>r.extractionRate))
  };

  const delta = (a,b) => b===0 ? 'n/a' : `${((a-b)/b*100).toFixed(1)}%`;
  const dDur = ((n.durationMs-b.durationMs)/b.durationMs*100);
  const dCost = b.estimatedCost ? ((n.estimatedCost-b.estimatedCost)/b.estimatedCost*100) : 0;

  console.log('\n========================================');
  console.log('RESULTATS (moyenne sur '+RUNS+' runs)');
  console.log('========================================');
  console.log(`| Métrique               | Baseline      | NeuraNet      | Delta       |`);
  console.log(`|------------------------|---------------|---------------|-------------|`);
  console.log(`| Durée (ms)             | ${String(Math.round(b.durationMs)).padStart(13)} | ${String(Math.round(n.durationMs)).padStart(13)} | ${(dDur>0?'+':'')+dDur.toFixed(1)+'%'.padStart(8)} |`);
  console.log(`| Tokens totaux          | ${String(Math.round(b.totalTokens)).padStart(13)} | ${String(Math.round(n.totalTokens)).padStart(13)} | ${delta(n.totalTokens,b.totalTokens).padStart(11)} |`);
  console.log(`| Search calls (moy)     | ${fmt(b.searchCalls,1).padStart(13)} | ${fmt(n.searchCalls,1).padStart(13)} | ${delta(n.searchCalls,b.searchCalls).padStart(11)} |`);
  console.log(`| Coût estimé ($)        | ${fmt(b.estimatedCost,4).padStart(13)} | ${fmt(n.estimatedCost,4).padStart(13)} | ${(dCost>0?'+':'')+dCost.toFixed(1)+'%'.padStart(8)} |`);
  console.log(`| Quality score          | ${fmt(b.qualityScore,2).padStart(13)} | ${fmt(n.qualityScore,2).padStart(13)} | ${(n.qualityScore-b.qualityScore>0?'+':'')+fmt(n.qualityScore-b.qualityScore,2).padStart(10)} |`);
  console.log(`| Experiences retrieved  | ${fmt(b.experiencesRetrieved,1).padStart(13)} | ${fmt(n.experiencesRetrieved,1).padStart(13)} | ${String(fmt(n.experiencesRetrieved-b.experiencesRetrieved,1)).padStart(11)} |`);
  console.log(`| Experiences eligible   | ${fmt(b.experiencesEligible,1).padStart(13)} | ${fmt(n.experiencesEligible,1).padStart(13)} | ${String(fmt(n.experiencesEligible-b.experiencesEligible,1)).padStart(11)} |`);
  console.log(`| Strategies extraites   | ${fmt(b.strategiesExtracted,1).padStart(13)} | ${fmt(n.strategiesExtracted,1).padStart(13)} | ${String(fmt(n.strategiesExtracted-b.strategiesExtracted,1)).padStart(11)} |`);
  console.log(`| Strategies sélectionnées| ${fmt(b.strategiesSelected,1).padStart(13)} | ${fmt(n.strategiesSelected,1).padStart(13)} | ${String(fmt(n.strategiesSelected-b.strategiesSelected,1)).padStart(11)} |`);
  console.log(`| Extraction rate        | ${fmt(b.extractionRate,2).padStart(13)} | ${fmt(n.extractionRate,2).padStart(13)} | ${String(fmt(n.extractionRate-b.extractionRate,2)).padStart(11)} |`);
  console.log('========================================');
  console.log(`\nInterprétation:`);
  if (n.experiencesRetrieved > 0) console.log(`- NeuraNet: ${Math.round(n.experiencesRetrieved)} retrieved → ${Math.round(n.experiencesEligible)} eligible → ${Math.round(n.strategiesExtracted)} stratégies extraites → ${Math.round(n.strategiesSelected)} sélectionnées (vs 0 en baseline)`);
  if (n.qualityScore > b.qualityScore) console.log(`- Quality +${fmt(n.qualityScore-b.qualityScore,2)} avec NeuraNet`);
  console.log(`- Trust gradué: HIGH/MEDIUM/LOW (pas de baisse aveugle du seuil) - LOW unverified utilisé comme hypothèse à vérifier`);
  console.log(`- Note: LLM fallback (quota) → tokens/coût non valides; search Tavily réel; durée -36% précédemment mesurée`);
  console.log(`- Observabilité: experiences_retrieved/eligible, strategies_extracted/selected/rejected, rates`);

  // Sauvegarde JSON
  const out = { task: TASK, runs: RUNS, baseline: baselineRuns, neuranet: neuranetRuns, avg: { baseline: b, neuranet: n } };
  const { writeFileSync } = await import('node:fs');
  writeFileSync('benchmark-result.json', JSON.stringify(out, null, 2));
  console.log('\nRésultats sauvegardés dans benchmark-result.json');
}

main().catch(e=>{ console.error('BENCHMARK FAILED', e.stack||e.message); process.exit(1); });
