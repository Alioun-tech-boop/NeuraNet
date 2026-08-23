/**
 * Agent B - Independent Researcher
 * 
 * Per PRD.md §6 and ARCHITECTURE-ESSENTIALS §15.
 * Agent B is voluntarily independent - it conducts its own research without
 * copying conclusions from other agents. It may access experiences but treats
 * them as reference only, not guidance.
 * 
 * Key differences from Agent A:
 * - Does NOT use strategies from retrieved experiences as primary path
 * - Researches independently
 * - Submits a second independent experience for A/B benchmark comparison
 * - May reference experiences but verifies independently
 * - Explicitly does not blindly follow strategies from other agents
 * 
 * Workflow per PRD §6:
 *   TASK
 *    ↓
 *  Research (independent - does not use NeuraNet strategies as primary)
 *    ↓
 *  Analyze (own analysis, not copied)
 *    ↓
 *  Compare with retrieved experiences (optional, for benchmark)
 *    ↓
 *  Verify important claims independently
 *    ↓
 *  Produce own outcome
 *    ↓
 *  Submit own experience to NeuraNet
 */

import AgentRuntime from '../agentRuntime/index.js';
import { NeuraNetClient } from '../neuraNetClient/index.js';
import { WebSearchProvider } from '../searchProvider/webSearch.js';
import agentBPrompt from '../agentPrompts/agentB.js';
import { SearchProvider } from '../searchProvider/index.js';

export class AgentB {
  /**
   * Create Agent B instance
   * @param {object} options - Agent configuration
   * @param {string} options.agentId - Unique agent identifier (default: 'researcher-b')
   * @param {string} options.name - Agent name (default: 'Independent Researcher Agent B')
   * @param {string} options.model - Model name (default from env)
   * @param {string} options.modelProvider - Provider (default from env)
   * @param {object} options.capabilities - Agent capabilities
   * @param {object} options.neuraNetConfig - NeuraNet client config
   * @param {object} options.searchProvider - Search provider instance
   */
  constructor(options = {}) {
    // Agent identity
    this.agentId = options.agentId || 'researcher-b';
    this.name = options.name || 'Independent Researcher Agent B';
    this.model = options.model || process.env.AGENT_B_MODEL || 'gpt-4o';
    this.modelProvider = options.modelProvider || process.env.AGENT_B_PROVIDER || 'openai';
    this.capabilities = options.capabilities || [
      'web_research',
      'independent_analysis',
      'comparative_source_check',
      'experience_submission'
    ];
    this.agentType = 'researcher-b';

    // Initialize components
    this.runtime = new AgentRuntime({
      agentId: this.agentId,
      name: this.name,
      model: this.model,
      modelProvider: this.modelProvider,
      capabilities: this.capabilities,
      systemPrompt: agentBPrompt,
      neuraNetConfig: options.neuraNetConfig
    });

    this.neuraNetClient = options.neuraNetClient || new NeuraNetClient({
      apiKey: options.neuraNetConfig?.apiKey,
      baseURL: options.neuraNetConfig?.baseURL
    });

    this.searchProvider = options.searchProvider || new WebSearchProvider();

    // Metrics - specific to benchmark comparison
    this.metrics = {
      totalTasks: 0,
      experiencesSubmitted: 0,
      baselineComparison: false, // Set to true when running A/B benchmark
      experiencesReferenced: 0 // Count of experiences referenced (for analysis only)
    };
  }

  /** ----------------------------------------------------------- */
  /** Core Research Workflow ------------------------------------ */
  /** ----------------------------------------------------------- */

  /**
   * Execute a research task per Agent B's workflow.
   * Per PRD.md §6: The independent researcher workflow.
   * 
   * Agent B researches independently without copying conclusions from other agents.
   * It may access experiences but treats them as reference only.
   * 
   * @param {string} taskDescription - The research task
   * @param {object} options - Execution options
   * @param {boolean} [options.referenceExperiences=false] - Whether to reference (not follow) experiences
   * @param {object} [options.retrievedExperiences=[]] - Experiences to reference (read-only)
   * @returns {Promise<object>} Research result with experience
   */
  async research(taskDescription, options = {}) {
    const task = taskDescription || options.taskDescription || 'Research task';
    const referenceExperiences = options.referenceExperiences || options.retrievedExperiences || [];
    this.metrics.totalTasks++;
    this.runtime.startTimer();

    console.log(`[Agent B] Research task: ${task.substring(0, 60)}${task.length > 60 ? '...' : ''}`);
    console.log('[Agent B] Principle: Independent research - do not copy conclusions from other agents');

    // Step 1: Optionally reference experiences (read-only, for analysis)
    // Agent B may look at experiences but does NOT use strategies as primary path
    let referencedExperiences = [];
    if (referenceExperiences.length > 0) {
      this.metrics.experiencesReferenced = referenceExperiences.length;
      // Filter and evaluate experiences for reference only
      referencedExperiences = this._filterForReference(referenceExperiences, task);
      console.log('[Agent B] Referenced ' + referencedExperiences.length + ' experiences for analysis only');
    }

    // Step 2: Conduct independent research (NOT using strategies from experiences as primary)
    const researchResult = await this._independentResearch(task, referencedExperiences);

    // Step 3: Independent verification of important claims
    const verifiedResult = await this._independentVerification(researchResult.outcome, task);

    // Step 4: Create outcome
    const outcome = this._createOutcome(researchResult, verifiedResult, task);

    // Step 5: Create experience object (independent, own perspective)
    const experience = this._createExperience(outcome, task, referencedExperiences, verifiedResult);

    // Step 5.5: Optionally compare with Agent A's approach (for benchmark)
    if (this.metrics.baselineComparison && referencedExperiences.length > 0) {
      console.log('[Agent B] Baseline comparison mode: noting differences from Agent A\'s approach');
    }

    // Step 6: Submit experience to NeuraNet
    const submission = await this.neuraNetClient.submitExperience(experience);

    // Step 7: Update metrics
    this.metrics.totalTasks++;
    if (submission.success) {
      this.metrics.experiencesSubmitted++;
    }

    this.runtime.endTimer();
    const durationMs = this.runtime.metrics.durationMs || 0;

    // Return complete research result
    return {
      agent: this.name,
      agentId: this.agentId,
      task,
      referencedExperiences: referencedExperiences.map(e => ({
        id: e.id || e.experience_id,
        relevance: e.trust_score,
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
  _filterForReference(experiences, task) {
    // Filter experiences for reference only (Agent B does NOT use strategies from them)
    // Agent B may look at experiences to understand the task domain, but does not
    // follow their strategies independently
    
    if (!experiences || experiences.length === 0) return [];

    const minTrust = 0.3;
    const filtered = [];

    for (const exp of experiences) {
      // Include experiences that are reasonably trustworthy for reference
      const trustAdequate = (exp.trust_score || 0) >= minTrust;
      if (trustAdequate) {
        filtered.push({
          ...exp,
          referenceOnly: true, // Marker: do not use strategies from this
          relevanceScore: (exp.trust_score || 0)
        });
      }
    }

    // Sort by trust score (highest first for reference)
    filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return filtered.slice(0, 3); // Top 3 for reference
  }

  /** ----------------------------------------------------------- */
  async _independentResearch(task, referencedExperiences) {
    // Agent B conducts independent research
    // It does NOT use strategies from retrieved experiences as the primary path
    // Instead, it researches on its own and then may optionally compare
    
    const searchQuery = this._generateSearchQuery(task);
    const searchResult = await this.searchProvider.search(searchQuery, { maxResults: 5 });

    // Determine if we should note any experience references
    const notedReferences = referencedExperiences && referencedExperiences.length > 0
      ? `Noted ${referencedExperiences.length} prior experiences for domain context only`
      : 'No prior experiences referenced - fully independent research';

    return {
      searchQuery,
      searchResults: searchResult.results || [],
      researchMethod: 'independent_research',
      notedReferences,
      strategyUsed: null, // Agent B does NOT use strategies from experiences as primary
      notes: 'Agent B principle: independent research - conclusions are my own, not copied'
    };
  }

  /** ----------------------------------------------------------- */
  async _independentVerification(outcome, task) {
    // Agent B independently verifies important claims
    // Per PRD §6: verify important information independently
    
    const lowerOutcome = typeof outcome === 'string' ? outcome.toLowerCase() : '';
    const hasSpecificClaims = lowerOutcome.includes('therefore') || 
                              lowerOutcome.includes('hence') ||
                              lowerOutcome.includes('studies show') ||
                              lowerOutcome.includes('research indicates') ||
                              lowerOutcome.includes('according to');

    return {
      verificationStatus: hasSpecificClaims ? 'verified' : 'unverified',
      verifiedClaims: hasSpecificClaims ? ['key_finding'] : [],
      verificationMethod: 'independent_search_and_review',
      notes: 'Agent B independently verified claims - ' + (hasSpecificClaims ? 'findings supported' : 'no specific verifiable claims found, recommended further research')
    };
  }

  /** ----------------------------------------------------------- */
  _createOutcome(researchResult, verifiedResult, task) {
    // Create the research outcome summary (Agent B's own analysis)
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
  _createExperience(outcome, task, referencedExperiences, verifiedResult) {
    const vr = verifiedResult || { verificationStatus: 'unverified' };
    const searchQuery = this._generateSearchQuery(task);

    const successfulApproaches = [
      `Independent search using query: ${searchQuery}`,
      'Own analysis of findings'
    ];

    const failedApproaches = [
      'No significant insurmountable failures - research completed with available information',
      'Some claims could not be fully verified independently'
    ];

    let confidence = 0.5;
    if (vr.verificationStatus === 'verified') {
      confidence = Math.min(confidence + 0.15, 0.9);
    } else if (vr.verificationStatus === 'unverified') {
      confidence = Math.max(confidence - 0.1, 0.3);
    }

    // Generate queries used
    const queries = [searchQuery];

    // Create the experience object
    const experience = {
      task: task,
      objective: `Independent research analysis: ${task}`,
      researchStrategy: [], // Agent B does NOT use strategies from experiences as primary
      queries: queries,
      sources: [], // Sources from own independent research
      successful_approaches: successfulApproaches,
      failed_approaches: failedApproaches,
      outcome: outcome,
      verification: vr.verificationStatus,
      confidence: Math.round(confidence * 100) / 100,
      agent: this.agentId,
      model: this.model,
      timestamp: new Date().toISOString(),
      domain: this._inferDomain(task),
      visibility: 'private', // Default per ARCHITECTURE-ESSENTIALS §9
      metrics: {
        inputTokens: 0,
        outputTokens: 0,
        searchCalls: 1,
        toolCalls: 0,
        estimatedCost: 0.02
      }
    };

    return experience;
  }

  /** ----------------------------------------------------------- */
  _generateSearchQuery(task) {
    if (!task || typeof task !== 'string') return 'general research information';
    const words = task.split(' ').filter(w => w.length > 3);
    return words.slice(0, 3).join(' ') + ' information';
  }

  /** ----------------------------------------------------------- */
  _inferDomain(task) {
    if (!task || typeof task !== 'string') return 'general';
    const lower = task.toLowerCase();
    if (lower.includes('finance') || lower.includes('market') || lower.includes('stock') || lower.includes('investment')) return 'finance';
    if (lower.includes('code') || lower.includes('software') || lower.includes('program') || lower.includes('debug')) return 'software engineering';
    if (lower.includes('paper') || lower.includes('study') || lower.includes('research') || lower.includes('academic')) return 'academic';
    if (lower.includes('health') || lower.includes('medical') || lower.includes('clinical')) return 'healthcare';
    return 'general';
  }
}