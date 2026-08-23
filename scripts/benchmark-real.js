/**
 * Real Multi-Provider Benchmark - No Synthetic Fallback
 * Per §26: if provider fails, RUN = FAILED (no fallback)
 * Matrix: 3 providers x 2 modes = 6 runs
 */
import 'dotenv/config';
import { ExperimentRunner } from './experimentRunner.js';

const TASK = process.env.EXPERIMENT_TASK || 'Analyze the market for solar panels in Ghana';

const PROVIDERS = [
  { name: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-flash-latest', envKey: 'GEMINI_API_KEY' },
  { name: 'groq', model: process.env.GROQ_MODEL || 'allam-2-7b', envKey: 'GROQ_API_KEY' },
  { name: 'openrouter', model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-lightning:free', envKey: 'OPENROUTER_API_KEY' }
];

function isConfigured(p) {
  return !!process.env[p.envKey] || !!process.env[p.envKey.replace('GEMINI','GOOGLE')];
}

async function runWithProvider(provider, mode) {
  const start = Date.now();
  console.log(`\n=== ${provider.name.toUpperCase()} ${mode.toUpperCase()} ===`);
  if (!isConfigured(provider)) {
    console.log(`MISSING_API_KEY for ${provider.envKey}`);
    return { provider: provider.name, mode, success: false, error: 'MISSING_API_KEY', errorType: 'MISSING_API_KEY', statusCode: 0, metrics: null };
  }

  // Configure all agents to use this provider for fair comparison (same provider, same model, only NeuraNet ON/OFF)
  const neuraNetConfig = { apiKey: process.env.NEURANET_API_KEY, baseURL: process.env.NEURANET_API_BASE_URL || 'http://127.0.0.1:3000' };
  const opts = {
    task: TASK,
    mode,
    agentAModel: provider.model,
    agentBModel: provider.model,
    agentCModel: provider.model,
    neuraNetConfig
  };
  // Override provider via env for this run
  const prevA = process.env.AGENT_A_PROVIDER;
  const prevB = process.env.AGENT_B_PROVIDER;
  const prevC = process.env.AGENT_C_PROVIDER;
  process.env.AGENT_A_PROVIDER = provider.name;
  process.env.AGENT_B_PROVIDER = provider.name;
  process.env.AGENT_C_PROVIDER = provider.name;

  try {
    const result = await ExperimentRunner.runExperiment(opts);
    const section = mode === 'baseline' ? result.baseline : result.neuranet;
    // Check if any agent failed due to LLM
    const failedAgents = [];
    // The experimentRunner will throw if LLM fails (we made it throw), so if we reach here, it succeeded
    console.log(`SUCCESS: duration=${section.durationMs}ms quality=${section.qualityScore} strategies=${section.strategiesSelected||section.strategiesExtracted||0}`);
    return {
      provider: provider.name,
      mode,
      model: provider.model,
      success: true,
      latencyMs: Date.now() - start,
      metrics: section,
      result
    };
  } catch (err) {
    console.log(`FAILED: ${err.message.slice(0,200)}`);
    return {
      provider: provider.name,
      mode,
      model: provider.model,
      success: false,
      error: err.message.slice(0,300),
      errorType: err.message.includes('MISSING_API_KEY') ? 'MISSING_API_KEY' : 'LLM_ERROR',
      statusCode: 0,
      latencyMs: Date.now() - start
    };
  } finally {
    if (prevA !== undefined) process.env.AGENT_A_PROVIDER = prevA; else delete process.env.AGENT_A_PROVIDER;
    if (prevB !== undefined) process.env.AGENT_B_PROVIDER = prevB; else delete process.env.AGENT_B_PROVIDER;
    if (prevC !== undefined) process.env.AGENT_C_PROVIDER = prevC; else delete process.env.AGENT_C_PROVIDER;
  }
}

async function main() {
  console.log('=== REAL MULTI-PROVIDER BENCHMARK (NO FALLBACK) ===');
  console.log('Task:', TASK);
  console.log('Providers:', PROVIDERS.map(p=>`${p.name}(${p.model})`).join(', '));
  console.log('Matrix: 3 providers x 2 modes = 6 runs\n');

  const results = [];
  for (const provider of PROVIDERS) {
    for (const mode of ['baseline', 'neuranet']) {
      const r = await runWithProvider(provider, mode);
      results.push(r);
      // Small delay between runs
      await new Promise(r=>setTimeout(r, 1000));
    }
  }

  console.log('\n=== RESULTS MATRIX ===');
  console.log('| Provider   | Baseline | NeuraNet | Delta Quality | Delta Latency | Status |');
  console.log('|------------|----------|----------|---------------|---------------|--------|');
  for (const provider of PROVIDERS) {
    const b = results.find(r=>r.provider===provider.name && r.mode==='baseline');
    const n = results.find(r=>r.provider===provider.name && r.mode==='neuranet');
    const bQ = b?.metrics?.qualityScore ?? 'FAIL';
    const nQ = n?.metrics?.qualityScore ?? 'FAIL';
    const bL = b?.metrics?.durationMs ?? b?.latencyMs ?? 'FAIL';
    const nL = n?.metrics?.durationMs ?? n?.latencyMs ?? 'FAIL';
    const dQ = (typeof bQ==='number' && typeof nQ==='number') ? (nQ-bQ).toFixed(2) : 'n/a';
    const dL = (typeof bL==='number' && typeof nL==='number' && bL>0) ? ((nL-bL)/bL*100).toFixed(1)+'%' : 'n/a';
    const status = (b?.success && n?.success) ? 'PASS' : 'FAIL';
    console.log(`| ${provider.name.padEnd(10)} | ${String(bQ).padStart(8)} | ${String(nQ).padStart(8)} | ${String(dQ).padStart(13)} | ${String(dL).padStart(13)} | ${status.padEnd(6)} |`);
  }

  console.log('\n=== DETAILED RESULTS ===');
  for (const r of results) {
    console.log(`${r.provider} ${r.mode}: ${r.success ? `PASS quality=${r.metrics?.qualityScore} strategies=${r.metrics?.strategiesSelected||0} latency=${r.metrics?.durationMs}ms` : `FAIL ${r.errorType} ${r.error?.slice(0,80)}`}`);
  }

  // Save
  const { writeFileSync } = await import('node:fs');
  writeFileSync('benchmark-real.json', JSON.stringify({ task: TASK, providers: PROVIDERS, results, timestamp: new Date().toISOString() }, null, 2));
  console.log('\nSaved to benchmark-real.json');

  const allPass = results.every(r=>r.success);
  console.log(`\nOverall: ${allPass ? 'ALL PASS' : 'SOME FAILED - per §2, failed runs are not synthetic'}`);
  if (!allPass) {
    console.log('Note: Real LLM calls without fallback - failures are genuine API errors, not fallback');
  }
}

main().catch(e=>{ console.error('BENCHMARK FAILED', e); process.exit(1); });
