/**
 * Experiment Runner
 * 
 * Per PRD.md §13, §17: A/B benchmark comparison between Baseline and NeuraNet modes.
 * 
 * Two modes:
 *   MODE BASELINE: Agent C performs research WITHOUT using NeuraNet experiences
 * MODE NEURANET: Agent C uses retrieved experiences from NeuraNet
 * 
 * Same task, same model (as much as possible), same tools.
 * 
 * Metrics collected per PRD §37:
 *   - Tokens (input/output)
 *   - Cost estimated
 *   - Search calls
 *   - Tool calls
 *   - Duration/latency
 *   - Number of sources
 *   - Quality score
 *   - Verification rate
 *   - Errors
 */

import { AgentA } from '../src/agents/agentA.js';
import { AgentB } from '../src/agents/agentB.js';
import { AgentC } from '../src/agents/agentC.js';
import { WebSearchProvider } from '../src/searchProvider/webSearch.js';
import { NeuraNetClient } from '../src/neuraNetClient/index.js';

export class ExperimentRunner {
  /**
   * Run a single experiment in a given mode
   * @param {object} options - Experiment configuration
   * @param {string} options.task - The research task
   * @param {string} options.mode - 'baseline' or 'neuranet'
   * @param {string} [options.agentAModel] - Model for Agent A
   * @param {string} [options.agentBModel] - Model for Agent B
   * @param {string} [options.agentCModel] - Model for Agent C
   * @param {object} [options.neuraNetConfig] - NeuraNet client config
   * @returns {Promise<object>} Experiment result
   */
  static async runExperiment(options) {
    const task = options.task || 'Analyze the market for electric vehicles in Ghana';
    const mode = options.mode || 'neuranet'; // 'baseline' or 'neuranet'
    
    console.log('========================================');
    console.log('NEURANET MULTI-AGENT EXPERIMENT');
    console.log('========================================');
    console.log('Task:', task);
    console.log('Mode:', mode.toUpperCase());
    console.log('========================================\n');

    // Configure agents based on mode
    const neuraNetConfig = options.neuraNetConfig || {
      apiKey: process.env.NEURANET_API_KEY,
      baseURL: process.env.NEURANET_API_BASE_URL || 'http://localhost:3000'
    };

    // Agent A -> Gemini, Agent B -> Groq, Agent C -> OpenRouter per §11
    const agentA = new AgentA({
      agentId: 'researcher-a',
      name: 'Researcher Agent A',
      model: options.agentAModel || process.env.AGENT_A_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest',
      modelProvider: process.env.AGENT_A_PROVIDER || 'gemini',
      neuraNetConfig: neuraNetConfig,
      searchProvider: new WebSearchProvider()
    });

    const agentB = new AgentB({
      agentId: 'researcher-b',
      name: 'Independent Researcher Agent B',
      model: options.agentBModel || process.env.AGENT_B_MODEL || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      modelProvider: process.env.AGENT_B_PROVIDER || 'groq',
      neuraNetConfig: neuraNetConfig,
      searchProvider: new WebSearchProvider()
    });

    const agentC = new AgentC({
      agentId: 'researcher-c',
      name: 'Collective Researcher Agent C',
      model: options.agentCModel || process.env.AGENT_C_MODEL || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
      modelProvider: process.env.AGENT_C_PROVIDER || 'openrouter',
      neuraNetConfig: neuraNetConfig,
      searchProvider: new WebSearchProvider()
    });

    // === MODE: BASELINE ===
    if (mode === 'baseline') {
      console.log('\n--- MODE: BASELINE ---\n');
      console.log('Agent A: Fresh research (no prior NeuraNet experiences)\n');

      // Agent A: Fresh research without prior experiences
      const aResult = await agentA.research(task, {
        // No reference experiences - Agent A does fresh research
        referenceExperiences: []
      });
      console.log('Agent A complete. Experience submitted:', aResult.experienceSubmission.success ? 'YES' : 'NO');

      console.log('\nAgent B: Independent research (baseline, no NeuraNet)\n');
      const bResult = await agentB.research(task, {
        referenceExperiences: [] // No experiences for Agent B either
      });
      console.log('Agent B complete. Experience submitted:', bResult.experienceSubmission.success ? 'YES' : 'NO');

      console.log('\nAgent C: Baseline mode - research WITHOUT NeuraNet experiences\n');
      const cResult = await agentC.research(task, {
        baselineMode: true // Critical: skip NeuraNet retrieval
      });
      console.log('Agent C complete. Experience submitted:', cResult.experienceSubmission.success ? 'YES' : 'NO');

      // Collect metrics
      const experimentResult = {
        experimentId: 'exp-baseline-' + Date.now(),
        task,
        mode: 'baseline',
        
        baseline: {
          durationMs: 
            (aResult.metrics.durationMs || 0) + 
            (bResult.metrics.durationMs || 0) + 
            (cResult.metrics.durationMs || 0),
          inputTokens: 
            (aResult.metrics.totalTokensInput || 0) + 
            (bResult.metrics.totalTokensInput || 0) + 
            (cResult.metrics.totalTokensInput || 0),
          outputTokens: 
            (aResult.metrics.totalTokensOutput || 0) + 
            (bResult.metrics.totalTokensOutput || 0) + 
            (cResult.metrics.totalTokensOutput || 0),
          searchCalls: 
            (aResult.metrics.totalSearchCalls || 0) + 
            (bResult.metrics.totalSearchCalls || 0) + 
            (cResult.metrics.totalSearchCalls || 0),
          toolCalls: 0, // Would need detailed tracking
          estimatedCost: 
            (aResult.metrics.totalEstimatedCost || 0) + 
            (bResult.metrics.totalEstimatedCost || 0) + 
            (cResult.metrics.totalEstimatedCost || 0),
          qualityScore: 
            // Simple average of the three outcomes' quality indicators
            0.7, // Placeholder - would need proper evaluation
          experiences: [
            { agent: 'Agent A', experienceId: aResult.experienceSubmission.experienceId, success: aResult.experienceSubmission.success },
            { agent: 'Agent B', experienceId: bResult.experienceSubmission.experienceId, success: bResult.experienceSubmission.success },
            { agent: 'Agent C', experienceId: cResult.experienceSubmission.experienceId, success: cResult.experienceSubmission.success }
          ]
        },

        neuranet: null // Null in baseline mode
      };

      console.log('\n--- BASELINE EXPERIMENT COMPLETE ---\n');
      return experimentResult;
    }

    // === MODE: NEURANET ===
    if (mode === 'neuranet') {
      console.log('\n--- MODE: NEURANET ---\n');
      console.log('Agent A: Research and submit experience to NeuraNet\n');

      // Agent A: Research and submit experience
      const aResult = await agentA.research(task, {
        // No reference experiences - Agent A researches fresh and submits
        referenceExperiences: []
      });
      console.log('Agent A complete. Experience submitted:', aResult.experienceSubmission.success ? 'YES' : 'NO');

      console.log('\nAgent B: Independent research\n');
      const bResult = await agentB.research(task, {
        referenceExperiences: [] // Agent B researches independently
      });
      console.log('Agent B complete. Experience submitted:', bResult.experienceSubmission.success ? 'YES' : 'NO');

      console.log('\nAgent C: NeuraNet mode - retrieve experiences A+B, use strategies, independent research\n');
      // Agent C retrieves experiences from A and B (simulated - in real experiment,
      // these would be the actual experiences submitted in the baseline phase,
      // but for this single-run experiment, we run the full cycle)
      const cResult = await agentC.research(task, {
        baselineMode: false // Use NeuraNet mode - retrieve experiences
      });
      console.log('Agent C complete. Experience submitted:', cResult.experienceSubmission.success ? 'YES' : 'NO');

      // Collect metrics for NeuraNet mode
      const experimentResult = {
        experimentId: 'exp-neuranet-' + Date.now(),
        task,
        mode: 'neuranet',
        
        baseline: null, // Null in NeuraNet mode
        
        neuranet: {
          durationMs: 
            (aResult.metrics.durationMs || 0) + 
            (bResult.metrics.durationMs || 0) + 
            (cResult.metrics.durationMs || 0),
          inputTokens: 
            (aResult.metrics.totalTokensInput || 0) + 
            (bResult.metrics.totalTokensInput || 0) + 
            (cResult.metrics.totalTokensInput || 0),
          outputTokens: 
            (aResult.metrics.totalTokensOutput || 0) + 
            (bResult.metrics.totalTokensOutput || 0) + 
            (cResult.metrics.totalTokensOutput || 0),
          searchCalls: 
            (aResult.metrics.totalSearchCalls || 0) + 
            (bResult.metrics.totalSearchCalls || 0) + 
            (cResult.metrics.totalSearchCalls || 0),
          toolCalls: 0, // Would need detailed tracking
          estimatedCost: 
            (aResult.metrics.totalEstimatedCost || 0) + 
            (bResult.metrics.totalEstimatedCost || 0) + 
            (cResult.metrics.totalEstimatedCost || 0),
          qualityScore: cResult.metrics.qualityScore || 0.5,
          experiences: [
            { agent: 'Agent A', experienceId: aResult.experienceSubmission.experienceId, success: aResult.experienceSubmission.success },
            { agent: 'Agent B', experienceId: bResult.experienceSubmission.experienceId, success: bResult.experienceSubmission.success },
            { agent: 'Agent C', experienceId: cResult.experienceSubmission.experienceId, success: cResult.experienceSubmission.success }
          ],
          // NeuraNet-specific observability (Étapes 6-7)
          experiencesRetrieved: cResult.retrievedExperiences || 0,
          experiencesEligible: cResult.experiencesEligible || 0,
          experiencesFiltered: cResult.experiencesFiltered || 0,
          strategiesExtracted: cResult.metrics.strategiesExtracted || 0,
          strategiesSelected: cResult.metrics.strategiesSelected || 0,
          strategiesRejected: cResult.metrics.strategiesRejected || 0,
          extractionRate: cResult.strategyExtraction?.extractionRate || 0,
          selectionRate: cResult.strategyExtraction?.selectionRate || 0,
          relevanceEvaluation: cResult.relevanceEvaluation || null,
          strategyExtraction: cResult.strategyExtraction || null,
          strategyRanking: cResult.strategyRanking || null
        }
      };

      console.log('\n--- NEURANET EXPERIMENT COMPLETE ---\n');
      return experimentResult;
    }

    // Invalid mode
    console.error('ERROR: Invalid mode "' + mode + '". Must be "baseline" or "neuranet".');
    return null;
  }
}

/** ----------------------------------------------------------- */
/** CLI entry point -------------------------------------------- */
/** Usage: node scripts/experimentRunner.js "task text" --mode neuranet */
/** ----------------------------------------------------------- */
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function printSummary(result) {
  console.log('\n========================================');
  console.log('EXPERIMENT SUMMARY');
  console.log('========================================');
  if (!result) {
    console.log('Experiment failed: no result returned.');
    return;
  }
  const section = result.mode === 'baseline' ? result.baseline : result.neuranet;
  console.log('Experiment ID:', result.experimentId);
  console.log('Task:', result.task);
  console.log('Mode:', result.mode.toUpperCase());
  if (section) {
    console.log('Duration:', section.durationMs, 'ms');
    console.log('Input tokens:', section.inputTokens);
    console.log('Output tokens:', section.outputTokens);
    console.log('Search calls:', section.searchCalls);
    console.log('Estimated cost: $' + Number(section.estimatedCost || 0).toFixed(4));
    console.log('Quality score:', section.qualityScore);
  }
  if (result.mode === 'neuranet' && result.neuranet) {
    console.log('Experiences retrieved by Agent C:', result.neuranet.experiencesRetrieved, `(eligible: ${result.neuranet.experiencesEligible}, filtered: ${result.neuranet.experiencesFiltered})`);
    console.log('Strategies extracted:', result.neuranet.strategiesExtracted, `→ selected: ${result.neuranet.strategiesSelected}, rejected: ${result.neuranet.strategiesRejected} (extractionRate: ${result.neuranet.extractionRate}, selectionRate: ${result.neuranet.selectionRate})`);
    if (result.neuranet.strategyRanking?.selected) {
      console.log('Top strategies:');
      for (const s of result.neuranet.strategyRanking.selected.slice(0, 3)) {
        console.log(`  + ${s.type}: ${s.strategy.slice(0, 80)}`);
      }
    }
  }
  if (section && Array.isArray(section.experiences)) {
    for (const e of section.experiences) {
      console.log(' -', e.agent + ':', 'experience=' + (e.experienceId || 'none'), 'submitted=' + (e.success ? 'YES' : 'NO'));
    }
  }
  console.log('========================================\n');
}

async function main() {
  const args = process.argv.slice(2);
  let mode = 'neuranet';
  const taskParts = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode') {
      mode = args[i + 1];
      i++;
    } else {
      taskParts.push(args[i]);
    }
  }

  const task = taskParts.join(' ').trim() || 'Analyze the market for electric vehicles in Ghana';

  if (!['baseline', 'neuranet'].includes(mode)) {
    console.error('Invalid --mode "' + mode + '". Use "baseline" or "neuranet".');
    process.exit(1);
  }

  try {
    const result = await ExperimentRunner.runExperiment({ task, mode });
    printSummary(result);
  } catch (err) {
    console.error('EXPERIMENT FAILED:', err.message);
    process.exit(1);
  }
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  main();
}

export default ExperimentRunner;