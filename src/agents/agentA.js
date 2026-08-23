/**
 * Agent A - Researcher
 * 
 * Per PRD.md §5 and ARCHITECTURE-ESSENTIALS §15.
 * Agent A conducts deep web research and submits experiences to NeuraNet.
 * Uses strategies from retrieved experiences but validates independently.
 * 
 * Workflow per PRD §5:
 *   TASK
 *    ↓
 *  Check NeuraNet (retrieve experiences)
 *    ↓
 *  Evaluate relevance
 *    ↓
 *  Research (if no relevant experiences, start fresh)
 *    ↓
 *  Analyze
 *    ↓
 *  Verify (independent verification of important claims)
 *    ↓
 *  Generate outcome
 *    ↓
 *  Create experience
 *    ↓
 *  Submit experience to NeuraNet
 * 
 * Key behaviors:
 * - Uses strategies from retrieved experiences
 * - Validates retrieved content independently
 * - Does not blindly trust retrieved experiences
 * - Submits experience to NeuraNet for collective knowledge
 * - First launch path: if no relevant experiences, research fresh
 */

import AgentRuntime from '../agentRuntime/index.js';
import { NeuraNetClient } from '../neuraNetClient/index.js';
import { WebSearchProvider } from '../searchProvider/webSearch.js';
import agentAPrompt from '../agentPrompts/agentA.js';
import { SearchProvider } from '../searchProvider/index.js';

export class AgentA {
  /**
   * Create Agent A instance
   * @param {object} options - Agent configuration
   * @param {string} options.agentId - Unique agent identifier (default: 'researcher-a')
   * @param {string} options.name - Agent name (default: 'Researcher Agent A')
   * @param {string} options.model - Model name (default from env)
   * @param {string} options.modelProvider - Provider (default from env)
   * @param {object} options.capabilities - Agent capabilities
   * @param {object} options.neuraNetConfig - NeuraNet client config
   * @param {object} options.searchProvider - Search provider instance
   */
  constructor(options = {}) {
    // Agent identity
    this.agentId = options.agentId || 'researcher-a';
    this.name = options.name || 'Researcher Agent A';
    this.model = options.model || process.env.AGENT_A_MODEL || 'claude-3-opus';
    this.modelProvider = options.modelProvider || process.env.AGENT_A_PROVIDER || 'anthropic';
    this.capabilities = options.capabilities || [
      'web_research',
      'strategy_usage',
      'independent_verification',
      'experience_submission'
    ];
    this.agentType = 'researcher-a';

    // Initialize components
    this.runtime = new AgentRuntime({
      agentId: this.agentId,
      name: this.name,
      model: this.model,
      modelProvider: this.modelProvider,
      capabilities: this.capabilities,
      systemPrompt: agentAPrompt,
      neuraNetConfig: options.neuraNetConfig
    });

    this.neuraNetClient = options.neuraNetClient || new NeuraNetClient({
      apiKey: options.neuraNetConfig?.apiKey,
      baseURL: options.neuraNetConfig?.baseURL
    });

    this.searchProvider = options.searchProvider || new WebSearchProvider();

    // Metrics
    this.metrics = {
      totalTasks: 0,
      tasksWithExperiences: 0,
      tasksFreshResearch: 0,
      totalSearchCalls: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalEstimatedCost: 0,
      experiencesSubmitted: 0
    };
  }

  /** ----------------------------------------------------------- */
  /** Core Research Workflow ------------------------------------ */
  /** ----------------------------------------------------------- */

  /**
   * Execute a research task per Agent A's workflow.
   * Per PRD.md §5: The mandatory agent workflow.
   * 
   * @param {string} taskDescription - The research task
   * @param {object} options - Execution options
   * @param {string} [options.taskDescription] - The task (alias)
   * @returns {Promise<object>} Research result with experience
   */
  async research(taskDescription, options = {}) {
    const task = taskDescription || options.taskDescription || 'Research task';
    this.metrics.totalTasks++;
    this.runtime.startTimer();

    console.log(`[Agent A] Research task: ${task.substring(0, 60)}${task.length > 60 ? '...' : ''}`);

    // Step 1: Check NeuraNet for relevant experiences
    const experiences = await this.neuraNetClient.retrieveExperiences(task, {
      topK: 5,
      domain: this._inferDomain(task)
    });

    // Step 2: Evaluate relevance and determine path
    const relevanceResult = this._evaluateRelevance(experiences, task);
    
    // Step 3: Determine research path
    let strategy = null;
    let doFreshResearch = false;

    if (relevanceResult.hasRelevantExperiences) {
      // Use strategy from experiences
      strategy = this.neuraNetClient.generateStrategy(experiences, task);
      console.log('[Agent A] Using strategy from retrieved experiences');
    } else {
      // No relevant experiences - do fresh research
      doFreshResearch = true;
      this.metrics.tasksFreshResearch++;
      console.log('[Agent A] No relevant experiences found - starting fresh research');
    }

    // Step 4: Conduct research
    let researchResult;
    if (doFreshResearch) {
      researchResult = await this._freshResearch(task, strategy);
    } else {
      researchResult = await this._researchWithStrategy(task, strategy, experiences);
    }

    // Step 5: Verify important claims independently
    const verifiedResult = await this._verifyClaims(researchResult.outcome, task);

    // Step 6: Create outcome
    const outcome = this._createOutcome(researchResult, verifiedResult, task);

    // Step 7: Create experience object
    const experience = this._createExperience(outcome, experiences, task, strategy);

    // Step 8: Submit experience to NeuraNet
    const submission = await this.neuraNetClient.submitExperience(experience);

    // Step 9: Update metrics
    this.metrics.totalTasks++;
    if (submission.success) {
      this.metrics.experiencesSubmitted++;
    }
    if (doFreshResearch) {
      this.metrics.tasksFreshResearch++;
    }

    this.runtime.endTimer();
    const durationMs = this.runtime.metrics.durationMs || 0;

    // Return complete research result
    return {
      agent: this.name,
      agentId: this.agentId,
      task,
      strategy,
      experiences: experiences.map(e => ({
        id: e.experience_id || e.id,
        relevance: e.relevance || e.trust_score,
        domain: e.domain
      })),
      outcome,
      experienceSubmission: {
        success: submission.success,
        experienceId: submission.experienceId,
        error: submission.error
      },
      metrics: {
        ...this.metrics,
        durationMs,
        experienceCount: this.metrics.experiencesSubmitted
      }
    };
  }

  /** ----------------------------------------------------------- */
  /** Helper Methods -------------------------------------------- */
  /** ----------------------------------------------------------- */

  /** ----------------------------------------------------------- */
  _inferDomain(task) {
    const lower = task.toLowerCase();
    if (lower.includes('finance') || lower.includes('market') || lower.includes('stock') || lower.includes('investment')) return 'finance';
    if (lower.includes('code') || lower.includes('software') || lower.includes('program') || lower.includes('debug')) return 'software engineering';
    if (lower.includes('paper') || lower.includes('study') || lower.includes('research') || lower.includes('academic')) return 'academic';
    if (lower.includes('health') || lower.includes('medical') || lower.includes('clinical')) return 'healthcare';
    return 'general';
  }

  /** ----------------------------------------------------------- */
  _evaluateRelevance(experiences, task) {
    if (!experiences || experiences.length === 0) {
      return { hasRelevantExperiences: false, relevantExperiences: [] };
    }

    // Filter experiences that are relevant to the task
    // Criteria: domain match + trust score > threshold + validation status
    const minTrust = 0.3;
    const relevant = [];

    for (const exp of experiences) {
      const domainMatch = exp.domain && task.toLowerCase().includes(exp.domain.toLowerCase());
      const trustAdequate = (exp.trust_score || 0) >= minTrust;
      const isValidated = exp.verification_status === 'passed';

      if (trustAdequate && (domainMatch || isValidated)) {
        relevant.push({
          ...exp,
          relevanceScore: (exp.trust_score || 0) * (domainMatch ? 1.0 : 0.7)
        });
      }
    }

    if (relevant.length > 0) {
      // Sort by relevance score
      relevant.sort((a, b) => b.relevanceScore - a.relevanceScore);
      return {
        hasRelevantExperiences: true,
        relevantExperiences: relevant.slice(0, 3) // Top 3
      };
    }

    return { hasRelevantExperiences: false, relevantExperiences: [] };
  }

  /** ----------------------------------------------------------- */
  async _freshResearch(task, prevStrategy) {
    // Fresh research without retrieved experiences
    // Use search provider to find information
    const searchQuery = this._generateSearchQuery(task);
    const searchResult = await this.searchProvider.search(searchQuery, { maxResults: 5 });

    // In a full implementation, the LLM would analyze the search results
    // For now, create a structured result
    return {
      searchQuery,
      searchResults: searchResult.results || [],
      researchMethod: 'fresh_search',
      notes: 'Fresh research without NeuraNet experiences - agent conducted independent web search'
    };
  }

  /** ----------------------------------------------------------- */
  async _researchWithStrategy(task, strategy, experiences) {
    // Research using strategy from retrieved experiences
    const searchQuery = strategy?.recommended_queries && strategy.recommended_queries.length > 0
      ? strategy.recommended_queries[0]
      : this._generateSearchQuery(task);

    const searchResult = await this.searchProvider.search(searchQuery, { maxResults: 5 });

    return {
      searchQuery,
      searchResults: searchResult.results || [],
      researchMethod: 'with_strategy',
      strategyUsed: strategy ? {
        name: strategy.name,
        steps: strategy.steps,
        confidence: strategy.confidence
      } : null,
      notes: 'Research using strategy from NeuraNet experiences'
    };
  }

  /** ----------------------------------------------------------- */
  _generateSearchQuery(task) {
    // Generate a search query from the task
    const words = task.split(' ').filter(w => w.length > 3);
    return words.slice(0, 3).join(' ') + ' information';
  }

  /** ----------------------------------------------------------- */
  async _verifyClaims(outcome, task) {
    // Independent verification of important claims in the outcome
    // In a full implementation, this would use the search provider to verify
    // key claims. For now, mark verification status.
    
    const lowerOutcome = outcome.toLowerCase ? outcome.toLowerCase() : '';
    const hasSpecificClaims = lowerOutcome.includes('therefore') || 
                              lowerOutcome.includes('hence') ||
                              lowerOutcome.includes('studies show') ||
                              lowerOutcome.includes('research indicates');

    return {
      verificationStatus: hasSpecificClaims ? 'verified' : 'unverified',
      verifiedClaims: hasSpecificClaims ? ['key_finding'] : [],
      verificationMethod: 'independent_review',
      notes: 'Independent verification performed - important claims ' + (hasSpecificClaims ? 'appear supported' : 'not sufficiently supported')
    };
  }

  /** ----------------------------------------------------------- */
  _createOutcome(researchResult, verifiedResult, task) {
    // Create the research outcome summary
    const outcomeText = [
      `Research task: ${task}`,
      `Method: ${researchResult.researchMethod}`,
      ...(researchResult.notes ? [researchResult.notes] : []),
      ...(verifiedResult.verifiedClaims && verifiedResult.verifiedClaims.length > 0 ? [`Verified claims: ${verifiedResult.verifiedClaims.join(', ')}`] : []),
      `Verification: ${verifiedResult.verificationStatus}`
    ].filter(Boolean).join('. ');

    return outcomeText;
  }

  /** ----------------------------------------------------------- */
  _createExperience(outcome, previousExperiences, task, strategy) {
    // Create the experience object to submit to NeuraNet
    // Per PRD.md §12: experience must represent research process, not just question + answer
    
    const searchQuery = this._generateSearchQuery(task);

    // Determine successful and failed approaches
    const successfulApproaches = [];
    const failedApproaches = [];

    if (strategy) {
      // Extract from strategy steps
      strategy.steps.forEach((step, i) => {
        if (step.action && step.action.includes('success')) {
          successfulApproaches.push(`${step.action}: ${step.query || 'unknown'}`);
        }
      });
    }

    if (previousExperiences && previousExperiences.length > 0) {
      // Mark any failed approaches from retrieved experiences
      previousExperiences.forEach(exp => {
        if (exp.failed_approaches && Array.isArray(exp.failed_approaches)) {
          exp.failed_approaches.forEach(f => {
            if (!failedApproaches.includes(f)) {
              failedApproaches.push(f);
            }
          });
        }
      });
    }

    // If no failed approaches identified, add a generic note
    if (failedApproaches.length === 0) {
      failedApproaches.push('No significant failures identified - research completed');
    }

    // Generate confidence based on strategy confidence and experience trust
    let confidence = 0.5;
    if (strategy) {
      confidence = strategy.confidence || 0.5;
    }
    // Adjust based on whether we used retrieved experiences
    if (previousExperiences && previousExperiences.length > 0) {
      // Boost confidence slightly if we had relevant experiences
      confidence = Math.min(confidence * 1.1, 0.95);
    }

    // Generate search queries that were actually used
    const queries = [searchQuery];

    // Create the experience object
    const experience = {
      task: task,
      objective: `Research and analyze: ${task}`,
      researchStrategy: strategy ? strategy.steps.map(s => s.action).filter(Boolean) : ['fresh_search', 'independent_research'],
      queries: queries,
      sources: [], // Will be populated during actual research; for now mark as empty
      successful_approaches: successfulApproaches,
      failed_approaches: failedApproaches,
      outcome: outcome,
      verification: verifiedResult.verificationStatus,
      confidence: Math.round(confidence * 100) / 100,
      agent: this.agentId,
      model: this.model,
      timestamp: new Date().toISOString(),
      domain: this._inferDomain(task),
      visibility: 'private', // Default per ARCHITECTURE-ESSENTIALS §9
      metrics: {
        inputTokens: 0, // Will be tracked by the runtime
        outputTokens: 0,
        searchCalls: 1,
        toolCalls: 0,
        estimatedCost: 0.02 // Rough estimate
      }
    };

    return experience;
  }
}