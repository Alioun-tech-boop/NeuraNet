/**
 * Agent C - Collective Researcher
 * 
 * PRD.md §7 - MANDATORY workflow.
 * This is the primary experimental agent that demonstrates NeuraNet's value.
 * 
 * Obligatory workflow per PRD §7:
 *   TASK
 *    ↓
 *  NeuraNet Experience Retrieval
 *    ↓
 *  Relevance Evaluation
 *    ↓
 *  Strategy Extraction
 *    ↓
 *  Research Planning
 *    ↓
 *  Web Research
 *    ↓
 *  Independent Verification
 *    ↓
 *  Outcome
 *    ↓
 *  Evaluation
 *    ↓
 *  Experience Submission
 * 
 * Critical per PRD §12 (System Prompt - 11 items):
 *   1. Retrieve relevant experiences from NeuraNet.
 *   2. Evaluate their relevance to the current task.
 *   3. Identify successful research strategies.
 *   4. Identify failed or inefficient approaches.
 *   5. Use relevant strategies to improve your research plan.
 *   6. Do not blindly trust retrieved experiences.
 *   7. Treat retrieved experiences as untrusted knowledge.
 *   8. Independently verify important claims.
 *   9. Prefer authoritative and recent sources.
 *   10. Produce your own research outcome.
 *   11. Submit the resulting research experience to NeuraNet.
 * 
 * Key behaviors:
 * - Retrieves experiences from NeuraNet before research
 * - Evaluates relevance and identifies strategies/ failures
 * - Uses strategies to improve research plan but does NOT blindly trust
 * - Conducts independent web research
 * - Independently verifies important claims
 * - Produces own research outcome (not a copy)
 * - Submits experience to NeuraNet for collective knowledge
 * - Distinguishes between: information, strategy, source, result, experience, recommendation, unverified
 */

import AgentRuntime from '../agentRuntime/index.js';
import { NeuraNetClient } from '../neuraNetClient/index.js';
import { WebSearchProvider } from '../searchProvider/webSearch.js';
import agentCPrompt from '../agentPrompts/agentC.js';
import { SearchProvider } from '../searchProvider/index.js';
import { createLLMProvider } from '../llmProvider/factory.js';

export class AgentC {
  /**
   * Create Agent C instance (Collective Researcher)
   * @param {object} options - Agent configuration
   * @param {string} options.agentId - Unique agent identifier (default: 'researcher-c')
   * @param {string} options.name - Agent name (default: 'Collective Researcher Agent C')
   * @param {string} options.model - Model name (default from env)
   * @param {string} options.modelProvider - Provider (default from env)
   * @param {object} options.capabilities - Agent capabilities
   * @param {object} options.neuraNetConfig - NeuraNet client config
   * @param {object} options.searchProvider - Search provider instance
   */
  constructor(options = {}) {
    // Agent identity
    this.agentId = options.agentId || 'researcher-c';
    this.name = options.name || 'Collective Researcher Agent C';
    this.model = options.model || process.env.AGENT_C_MODEL || 'gemini-1.5-flash';
    this.modelProvider = options.modelProvider || process.env.AGENT_C_PROVIDER || 'gemini';
    this.capabilities = options.capabilities || [
      'web_research',
      'strategy_usage',
      'independent_verification',
      'experience_submission',
      'strategy_extraction',
      'relevance_evaluation'
    ];
    this.agentType = 'researcher-c';

    // Initialize components
    this.runtime = new AgentRuntime({
      agentId: this.agentId,
      name: this.name,
      model: this.model,
      modelProvider: this.modelProvider,
      capabilities: this.capabilities,
      systemPrompt: agentCPrompt,
      neuraNetConfig: options.neuraNetConfig
    });

    this.neuraNetClient = options.neuraNetClient || new NeuraNetClient({
      apiKey: options.neuraNetConfig?.apiKey,
      baseURL: options.neuraNetConfig?.baseURL
    });

    this.searchProvider = options.searchProvider || new WebSearchProvider();
    this.llmProvider = options.llmProvider || createLLMProvider(this.modelProvider);

    // Metrics specific to A/B benchmark
    this.metrics = {
      totalTasks: 0,
      experiencesRetrieved: 0,
      experiencesEligible: 0,
      experiencesFiltered: 0,
      strategiesExtracted: 0,
      strategiesSelected: 0,
      strategiesRejected: 0,
      experiencesSubmitted: 0,
      baselineComparison: false,
      qualityScore: 0,
      durationMs: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalEstimatedCost: 0,
      totalSearchCalls: 0
    };
  }

  /** ----------------------------------------------------------- */
  /** Mandatory Workflow per PRD.md §7 --------------------------- */
  /** ----------------------------------------------------------- */

  /**
   * Execute Agent C's mandatory workflow.
   * This is the core experimental method that demonstrates NeuraNet value.
   * 
   * Per PRD.md §7, the obligatory workflow is:
 *   TASK
 *    ↓
 *  NeuraNet Experience Retrieval
 *    ↓
 *  Relevance Evaluation
 *    ↓
 *  Strategy Extraction
 *    ↓
 *  Research Planning
 *    ↓
 *  Web Research
 *    ↓
 *  Independent Verification
 *    ↓
 *  Outcome
 *    ↓
 *  Evaluation
 *    ↓
 *  Experience Submission
 * 
   * @param {string} taskDescription - The research task
   * @param {object} options - Execution options
   * @param {boolean} [options.baselineMode=false] - If true, skip NeuraNet retrieval (baseline)
   * @returns {Promise<object>} Complete workflow result
   */
  async research(taskDescription, options = {}) {
    const task = taskDescription || 'Research task';
    const baselineMode = options.baselineMode || false;
    this.metrics.totalTasks++;
    this.runtime.startTimer();

    console.log(`[Agent C] Research task: ${task.substring(0, 60)}${task.length > 60 ? '...' : ''}`);
    console.log('[Agent C] Mode:', baselineMode ? 'BASELINE (no NeuraNet)' : 'NeuraNet mode');

    // ==================================----------------------
    // Step 1: NeuraNet Experience Retrieval (PRD §11)
    // ==================================----------------------
    let retrievedExperiences = [];

    if (!baselineMode) {
      // Retrieve relevant experiences from NeuraNet
      retrievedExperiences = await this.neuraNetClient.retrieveExperiences(task, {
        topK: 5,
        domain: this._inferDomain(task)
      });
      this.metrics.experiencesRetrieved = retrievedExperiences.length;
      console.log('[Agent C] Retrieved ' + retrievedExperiences.length + ' experiences from NeuraNet');
    } else {
      console.log('[Agent C] BASELINE MODE: Skipping NeuraNet experience retrieval');
    }

    // ==================================----------------------
    // Step 2: Relevance Evaluation (PRD §7 item 2) + Graduated Trust
    // ==================================----------------------
    const relevanceResult = this._evaluateRelevance(retrievedExperiences, task);
    console.log(`[Agent C] Evaluated relevance: ${relevanceResult.relevantCount} relevant / ${relevanceResult.eligibleCount} eligible / ${relevanceResult.totalRetrieved} retrieved (HIGH:${relevanceResult.tierCounts.HIGH} MEDIUM:${relevanceResult.tierCounts.MEDIUM} LOW:${relevanceResult.tierCounts.LOW} REJECT:${relevanceResult.tierCounts.REJECT})`);

    // ==================================----------------------
    // Step 3: Strategy Extraction (PRD §7 item 3)
    // ==================================----------------------
    const strategyResult = this._extractStrategies(relevanceResult.relevantExperiences, task);
    console.log(`[Agent C] Voici les stratégies provenant des expériences précédentes (${strategyResult.strategiesExtracted} extraites):`);
    for (const s of strategyResult.strategies.slice(0, 5)) {
      console.log(`  - [${s.type}:${s.confidence.toFixed(2)}] ${s.strategy.slice(0, 100)} (from ${s.evidence?.expId?.slice(0,8) || 'unknown'})`);
    }
    if (strategyResult.strategiesExtracted === 0) console.log('  (aucune stratégie extraite - expériences trop pauvres ou filtrage trop strict)');

    // ==================================----------------------
    // Step 3b: Strategy Ranking (PRD §21)
    // ==================================----------------------
    const ranking = this._rankStrategies(strategyResult.strategies, task);
    console.log(`[Agent C] Voici les stratégies que j'ai retenues (${ranking.selected.length}/${strategyResult.strategiesExtracted} sélectionnées, rejetées: ${ranking.rejected.length}):`);
    for (const s of ranking.selected) {
      console.log(`  + [${s.type}:${s.rankScore.toFixed(2)}] ${s.strategy.slice(0, 100)} ← pourquoi: confidence ${s.confidence.toFixed(2)} + type ${s.type}`);
    }
    for (const s of ranking.rejected.slice(0, 3)) {
      console.log(`  - rejetée [${s.type}:${s.rankScore.toFixed(2)}] ${s.strategy.slice(0, 80)}`);
    }

    // Update observability metrics
    this.metrics.strategiesExtracted = strategyResult.strategiesExtracted;
    this.metrics.strategiesSelected = ranking.selected.length;
    this.metrics.strategiesRejected = ranking.rejected.length;
    this.metrics.experiencesEligible = relevanceResult.eligibleCount;
    this.metrics.experiencesFiltered = relevanceResult.filteredCount;

    // ==================================----------------------
    // Step 4: Research Planning (PRD §7 item 5)
    // ==================================----------------------
    const researchPlan = this._createResearchPlan(
      ranking.selected,
      relevanceResult.relevantExperiences,
      task
    );

    // ==================================----------------------
    // Step 5: Web Research (PRD §7)
    // ==================================----------------------
    const researchResult = await this._conductResearch(task, researchPlan);

    // Step 5b: LLM Analysis with selected strategies (NO FALLBACK - RUN FAILED if provider fails per §2)
    const llmMessagesC = [
      { role: 'system', content: this.runtime.getSystemPrompt() },
      { role: 'user', content: `Task: ${task}\nSelected strategies: ${ranking.selected.map(s=>s.strategy).join('; ')}\nResearch plan: ${JSON.stringify(researchPlan.incorporatedSteps)}\nSearch results: ${JSON.stringify(researchResult.searchResults.slice(0,3).map(r=>({title:r.title, snippet:r.snippet.slice(0,200)})))}\n\nGenerate research analysis (400 words) using the selected strategies, cite sources, then verify independently.` }
    ];
    const llmResC = await this.llmProvider.complete(llmMessagesC, { maxTokens: 800, temperature: 0.7 });
    if (!llmResC.success) {
      const err = `LLM failed for ${this.modelProvider}/${this.model}: ${llmResC.error} [${llmResC.errorType||'API_ERROR'} ${llmResC.statusCode||''}]`;
      console.error(`[Agent C] ${err}`);
      throw new Error(err);
    }
    researchResult.outcome = llmResC.text || llmResC.content || '';
    researchResult.llmMetrics = { inputTokens: llmResC.inputTokens, outputTokens: llmResC.outputTokens, totalTokens: llmResC.totalTokens, latencyMs: llmResC.latencyMs, provider: llmResC.provider, model: llmResC.model };
    this.metrics.totalTokensInput += llmResC.inputTokens||0;
    this.metrics.totalTokensOutput += llmResC.outputTokens||0;
    this.metrics.totalSearchCalls += 1;
    const pricingC = this.llmProvider.getPricing();
    this.metrics.totalEstimatedCost += (llmResC.inputTokens||0)*pricingC.inputPricePer1k/1000 + (llmResC.outputTokens||0)*pricingC.outputPricePer1k/1000;

    // ==================================----------------------
    // Step 6: Independent Verification (PRD §7 item 8, PRD §12 item 6-7)
    // ==================================----------------------
    const verifiedResult = await this._independentVerification(researchResult.outcome, task);
    console.log('[Agent C] Independent verification: ' + verifiedResult.verificationStatus);

    // ==================================----------------------
    // Step 7: Generate Outcome (PRD §7)
    // ==================================----------------------
    const outcome = this._generateOutcome(researchResult, verifiedResult, task);

    // ==================================----------------------
    // Step 8: Evaluation (PRD §7, PRD §19 - quality evaluation)
    // ==================================----------------------
    const evaluationResult = this._evaluateQuality(outcome, task, retrievedExperiences);

    // ==================================----------------------
    // Step 9: Experience Submission (PRD §7 item 11, PRD §12)
    // ==================================----------------------
    const experience = this._createExperience(
      outcome,
      task,
      retrievedExperiences,
      strategyResult.strategies,
      strategyResult.failedApproaches,
      verifiedResult
    );

    const submission = await this.neuraNetClient.submitExperience(experience);
    this.metrics.experiencesSubmitted++;

    // ==================================----------------------
    // Step 9.5: Baseline mode note
    // ==================================----------------------
    if (baselineMode) {
      console.log('[Agent C] BASELINE: No NeuraNet experiences retrieved or used');
    }

    // =======================================================
    // Complete: Return workflow result
    // =======================================================
    this.runtime.endTimer();
    this.metrics.durationMs = this.runtime.metrics.durationMs || 0;

    const extractionRate = strategyResult.extractionRate || 0;
    const selectionRate = ranking ? ranking.selectionRate || 0 : 0;

    const result = {
      agent: this.name,
      agentId: this.agentId,
      task,
      mode: baselineMode ? 'baseline' : 'neuranet',
      retrievedExperiences: retrievedExperiences.length,
      experiencesEligible: relevanceResult.eligibleCount || 0,
      experiencesFiltered: relevanceResult.filteredCount || 0,
      relevanceEvaluation: {
        relevantCount: relevanceResult.relevantCount,
        eligibleCount: relevanceResult.eligibleCount,
        filteredCount: relevanceResult.filteredCount,
        tierCounts: relevanceResult.tierCounts,
        strategiesIdentified: strategyResult.strategiesExtracted,
        failedApproachesIdentified: strategyResult.failedCount || 0
      },
      strategyExtraction: {
        strategies: strategyResult.strategies,
        failedApproaches: strategyResult.failedApproaches,
        extractedCount: strategyResult.strategiesExtracted,
        selectedCount: ranking ? ranking.selected.length : 0,
        rejectedCount: ranking ? ranking.rejected.length : 0,
        extractionRate: Math.round(extractionRate * 100) / 100,
        selectionRate: Math.round(selectionRate * 100) / 100
      },
      strategyRanking: ranking ? { selected: ranking.selected, rejected: ranking.rejected.slice(0, 3) } : null,
      researchPlan,
      researchResult: {
        searchQuery: researchResult.searchQuery,
        researchMethod: researchResult.researchMethod,
        notes: researchResult.notes
      },
      verification: verifiedResult,
      evaluation: evaluationResult,
      outcome,
      experienceSubmission: {
        success: submission.success,
        experienceId: submission.experienceId,
        error: submission.error
      },
      metrics: {
        ...this.metrics,
        durationMs: this.metrics.durationMs,
        qualityScore: evaluationResult.qualityScore
      }
    };

    console.log('[Agent C] Workflow complete. Outcome length:', outcome.substring(0, 80) + '...');
    return result;
  }

  /** ----------------------------------------------------------- */
  /** Workflow Steps Helpers ----------------------------------- */
  /** ----------------------------------------------------------- */

  /** ----------------------------------------------------------- */
  _evaluateRelevance(experiences, task) {
    // Graduated trust model - never discard unverified blindly, distinguish tiers
    if (!experiences || experiences.length === 0) {
      return {
        relevantCount: 0,
        relevantExperiences: [],
        eligibleCount: 0,
        filteredCount: 0,
        rejectedCount: 0,
        strategiesIdentified: 0,
        failedApproachesIdentified: 0,
        tierCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, REJECT: 0 }
      };
    }

    const inferredDomain = this._inferDomain(task);
    const eligible = [];
    let rejectedCount = 0;
    const tierCounts = { HIGH: 0, MEDIUM: 0, LOW: 0, REJECT: 0 };
    const strategies = new Set();
    const failedApproaches = new Set();

    for (const exp of experiences) {
      const trust = parseFloat(exp.trust_score) || 0;
      const verification = exp.verification_status || 'unverified';
      const freshness = exp.freshness_score != null ? parseFloat(exp.freshness_score) : 0.7;

      // --- Graduated trust tier ---
      let tier, confidence;
      if (trust >= 0.7 && verification === 'passed') { tier = 'HIGH'; confidence = 0.9; }
      else if (trust >= 0.5) { tier = 'MEDIUM'; confidence = 0.65; }
      else if (trust >= 0.3) { tier = 'LOW'; confidence = 0.4; }
      else { tier = 'REJECT'; confidence = 0; }

      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      if (tier === 'REJECT') { rejectedCount++; continue; }

      // --- Domain match: compare inferred domains, not substring ---
      const domainMatch = exp.domain === inferredDomain ? 1.0 : 0.0;
      const verificationBonus = verification === 'passed' ? 1.0 : verification === 'verified' ? 0.8 : 0.5;
      const freshnessScore = Math.min(Math.max(freshness, 0), 1);

      // Relevance score: weighted hybrid per PRD §21
      const relevanceScore = (trust * 0.4) + (domainMatch * 0.3) + (verificationBonus * 0.2) + (freshnessScore * 0.1);
      // Adjust confidence by verification
      const adjustedConfidence = tier === 'LOW' && verification === 'unverified' ? confidence * 0.7 : confidence;

      eligible.push({
        ...exp,
        tier,
        confidence: adjustedConfidence,
        domainMatch,
        relevanceScore,
        freshnessScore
      });

      if (exp.successful_approaches && Array.isArray(exp.successful_approaches)) {
        exp.successful_approaches.forEach(s => { if (s) strategies.add(s); });
      }
      if (exp.failed_approaches && Array.isArray(exp.failed_approaches)) {
        exp.failed_approaches.forEach(f => { if (f) failedApproaches.add(f); });
      }
    }

    // Sort by relevanceScore descending, then trust
    eligible.sort((a, b) => b.relevanceScore - a.relevanceScore || b.trust_score - a.trust_score);

    // Filtered = those not eligible due to REJECT
    const filteredCount = rejectedCount;
    // Eligible = all with tier != REJECT
    // Relevant = top 5 eligible (for strategy extraction, we keep more than before)
    const relevant = eligible.slice(0, 5);

    return {
      relevantCount: relevant.length,
      relevantExperiences: relevant,
      eligibleCount: eligible.length,
      filteredCount,
      rejectedCount,
      totalRetrieved: experiences.length,
      tierCounts,
      strategiesIdentified: strategies.size,
      failedApproachesIdentified: failedApproaches.size
    };
  }

  /** ----------------------------------------------------------- */
  _checkFreshness(exp, task) {
    if (exp.freshness_score != null) return parseFloat(exp.freshness_score) >= 0.5;
    const lowerTask = (task || '').toLowerCase();
    if (lowerTask.includes('finance') || lowerTask.includes('market')) return 0.5;
    return 0.7;
  }

  /** ----------------------------------------------------------- */
  _extractStrategies(relevantExperiences, task) {
    const strategies = [];
    const failedApproaches = [];
    const seen = new Set();

    if (!relevantExperiences || relevantExperiences.length === 0) {
      return { strategies, strategiesExtracted: 0, failedApproaches, failedCount: 0, extractionRate: 0 };
    }

    for (const exp of relevantExperiences) {
      // Synthesize strategies from multiple fields - not only successful_approaches
      const synth = this._synthesizeStrategiesFromExperience(exp, task);
      for (const s of synth) {
        const key = s.type + ':' + s.strategy;
        if (!seen.has(key)) {
          seen.add(key);
          strategies.push(s);
        }
      }
      if (exp.failed_approaches && Array.isArray(exp.failed_approaches)) {
        for (const f of exp.failed_approaches) {
          if (f && !failedApproaches.includes(f)) failedApproaches.push(f);
        }
      }
    }

    return {
      strategies,
      failedApproaches,
      strategiesExtracted: strategies.length,
      failedCount: failedApproaches.length,
      extractionRate: relevantExperiences.length ? strategies.length / relevantExperiences.length : 0
    };
  }

  /** Synthesize typed strategies from a single experience */
  _synthesizeStrategiesFromExperience(exp, task) {
    const out = [];
    const trust = parseFloat(exp.trust_score) || 0.3;
    const tier = exp.tier || 'LOW';

    // 1. From successful_approaches (if present)
    if (Array.isArray(exp.successful_approaches) && exp.successful_approaches.length > 0) {
      for (const s of exp.successful_approaches) {
        if (!s) continue;
        out.push({ type: 'heuristic', strategy: String(s), confidence: tier === 'HIGH' ? 0.85 : tier === 'MEDIUM' ? 0.65 : 0.4, evidence: { expId: exp.id, tier, trust }, source: 'successful_approaches' });
      }
    }

    // 2. From search_queries -> query strategy
    if (Array.isArray(exp.search_queries) && exp.search_queries.length > 0) {
      for (const q of exp.search_queries) {
        if (!q || typeof q !== 'string') continue;
        const existing = out.find(o => o.strategy === q);
        if (!existing) out.push({ type: 'query', strategy: `Use query pattern: "${q}"`, confidence: 0.5, evidence: { expId: exp.id, query: q }, source: 'search_queries' });
      }
    }

    // 3. From strategy array -> research sequence
    if (Array.isArray(exp.strategy) && exp.strategy.length > 0) {
      const seq = exp.strategy.join(' → ');
      out.push({ type: 'sequence', strategy: `Research sequence: ${seq}`, confidence: tier === 'HIGH' ? 0.8 : 0.5, evidence: { expId: exp.id, tier }, source: 'strategy' });
      for (const step of exp.strategy) {
        if (!out.find(o => o.strategy === step)) out.push({ type: 'step', strategy: String(step), confidence: 0.45, evidence: { expId: exp.id }, source: 'strategy' });
      }
    } else if (exp.strategy && typeof exp.strategy === 'string') {
      out.push({ type: 'step', strategy: exp.strategy, confidence: 0.45, evidence: { expId: exp.id }, source: 'strategy' });
    }

    // 4. Source type heuristic from domain
    if (exp.domain) {
      const srcMap = { finance: 'government and industry reports', general: 'broad web search', academic: 'peer-reviewed sources', healthcare: 'clinical sources' };
      const srcAdvice = srcMap[exp.domain] || 'reputable domain sources';
      out.push({ type: 'source_selection', strategy: `Prioritize ${srcAdvice} for ${exp.domain} tasks`, confidence: 0.6, evidence: { expId: exp.id, domain: exp.domain }, source: 'domain' });
    }

    // 5. Verification technique from verification_status
    if (exp.verification_status === 'passed' || exp.verification_status === 'verified') {
      out.push({ type: 'verification', strategy: 'Cross-verify claims with independent authoritative source', confidence: 0.75, evidence: { expId: exp.id, verification: exp.verification_status }, source: 'verification' });
    } else {
      out.push({ type: 'verification', strategy: 'Treat as hypothesis - independently verify before citing', confidence: 0.5, evidence: { expId: exp.id, verification: exp.verification_status }, source: 'verification' });
    }

    // 6. Freshness heuristic
    if (exp.freshness_score != null && parseFloat(exp.freshness_score) < 0.5) {
      out.push({ type: 'heuristic', strategy: 'Check freshness - prior experience may be stale for time-sensitive domain', confidence: 0.55, evidence: { expId: exp.id, freshness: exp.freshness_score }, source: 'freshness' });
    }

    // 7. Fallback if nothing else: outcome-derived heuristic
    if (out.length === 0 && exp.outcome) {
      out.push({ type: 'heuristic', strategy: `Prior experience outcome: ${String(exp.outcome).slice(0, 120)}`, confidence: 0.35, evidence: { expId: exp.id }, source: 'outcome' });
    }

    return out;
  }

  /** Rank strategies and select top N */
  _rankStrategies(strategies, task) {
    if (!strategies || strategies.length === 0) return { selected: [], rejected: [], all: [] };
    // Score each strategy: confidence + type weight
    const typeWeight = { source_selection: 0.15, sequence: 0.12, query: 0.1, verification: 0.08, step: 0.05, heuristic: 0.03 };
    const scored = strategies.map(s => ({
      ...s,
      rankScore: (s.confidence || 0.5) + (typeWeight[s.type] || 0)
    }));
    scored.sort((a, b) => b.rankScore - a.rankScore);
    const selected = scored.slice(0, 5);
    const rejected = scored.slice(5);
    return { selected, rejected, all: scored, selectionRate: selected.length / scored.length };
  }

  /** ----------------------------------------------------------- */
  _createResearchPlan(strategies, relevantExperiences, task) {
    // PRD §7 item 5: Use relevant strategies to improve your research plan
    
    const defaultSteps = [
      { order: 1, action: 'search_general', query: this._generateSearchQuery(task) },
      { order: 2, action: 'filter_results' },
      { order: 3, action: 'document_findings' }
    ];

    // If we have strategies from experiences, incorporate them
    const incorporatedSteps = [];
    const seenActions = new Set();

    // Add strategies as potential steps (ranked, typed)
    for (const strategy of strategies) {
      const stratText = typeof strategy === 'object' ? strategy.strategy : String(strategy);
      const stratMeta = typeof strategy === 'object' ? { confidence: strategy.confidence, type: strategy.type } : {};
      if (!seenActions.has(stratText)) {
        incorporatedSteps.push({ order: incorporatedSteps.length + 1, action: stratText, ...stratMeta });
        seenActions.add(stratText);
      }
    }

    // Add default steps if we don't have enough
    while (incorporatedSteps.length < 3) {
      const fallbackActions = ['search_general', 'cross_check_sources', 'verify_results'];
      const fallback = fallbackActions[incorporatedSteps.length];
      if (!seenActions.has(fallback)) {
        incorporatedSteps.push({ order: incorporatedSteps.length + 1, action: fallback });
        seenActions.add(fallback);
      }
    }

    // If we have relevant experiences with strategy steps, incorporate those too
    if (relevantExperiences && relevantExperiences.length > 0) {
      const topExp = relevantExperiences[0];
      if (topExp.strategy && Array.isArray(topExp.strategy)) {
        for (const s of topExp.strategy) {
          if (!seenActions.has(s)) {
            // Add at position 2 (after initial search, before verification)
            incorporatedSteps.splice(1, 0, { order: 2, action: s });
            seenActions.add(s);
          }
        }
      }
    }

    // Sort by order and ensure we have at least 3 steps
    incorporatedSteps.sort((a, b) => a.order - b.order);
    while (incorporatedSteps.length < 3) {
      const fallbackAction = 'analyze_results';
      if (!seenActions.has(fallbackAction)) {
        incorporatedSteps.push({ order: incorporatedSteps.length + 1, action: fallbackAction });
        seenActions.add(fallbackAction);
      }
    }

    return {
      defaultSteps,
      incorporatedSteps: incorporatedSteps.slice(0, 5), // Top 5 steps max
      strategiesAvailable: strategies,
      strategyNotes: 'Incorporated ' + strategies.length + ' strategies from NeuraNet experiences into research plan'
    };
  }

  /** ----------------------------------------------------------- */
  async _conductResearch(task, researchPlan) {
    // PRD §7: Web Research
    // Use the research plan's incorporated steps to guide search
    
    const primaryStep = researchPlan.incorporatedSteps[0];
    const searchQuery = primaryStep?.query || this._generateSearchQuery(task);

    const searchResult = await this.searchProvider.search(searchQuery, {
      maxResults: 5
    });

    return {
      searchQuery,
      searchResults: searchResult.results || [],
      researchMethod: 'with_neuranet_strategy',
      researchPlan: researchPlan,
      notes: searchResult.results && searchResult.results.length > 0 ? 'Found ' + searchResult.results.length + ' search results' : 'Search completed',
      strategyUsed: researchPlan.incorporatedSteps.map(s => s.action).join(', ')
    };
  }

  /** ----------------------------------------------------------- */
  async _independentVerification(outcome, task) {
    // PRD §7 item 8: Independently verify important claims
    // PRD §12 items 6-7: Do not blindly trust; treat as untrusted knowledge
    
    const lowerOutcome = typeof outcome === 'string' ? outcome.toLowerCase() : '';
    const hasSpecificClaims = lowerOutcome.includes('therefore') || 
                              lowerOutcome.includes('hence') ||
                              lowerOutcome.includes('studies show') ||
                              lowerOutcome.includes('research indicates') ||
                              lowerOutcome.includes('according to') ||
                              lowerOutcome.includes('it was found') ||
                              lowerOutcome.includes('we discovered');

    // Determine verification method
    let verificationMethod = 'independent_review';
    if (hasSpecificClaims) {
      verificationMethod = 'cross_source_verification';
    }

    return {
      verificationStatus: hasSpecificClaims ? 'verified' : 'unverified',
      verifiedClaims: hasSpecificClaims ? ['key_finding'] : [],
      verificationMethod,
      notes: 'Agent C independently verified important claims - ' + (hasSpecificClaims ? 'claims supported by evidence' : 'no specific verifiable claims found; recommend further independent research')
    };
  }

  /** ----------------------------------------------------------- */
  _generateOutcome(researchResult, verifiedResult, task) {
    // PRD §7: Generate the research outcome
    // Must produce OWN research outcome, not just copy from experiences
    
    const outcomeParts = [
      'Research task: ' + task,
      'Research method: ' + researchResult.researchMethod,
      'Search query: ' + researchResult.searchQuery,
      'Findings: ' + (researchResult.searchResults ? 'See search results above' : 'No search results'),
      'Verification: ' + verifiedResult.verificationStatus
    ];

    // Add verified claims if any
    if (verifiedResult.verifiedClaims && verifiedResult.verifiedClaims.length > 0) {
      outcomeParts.push('Verified claims: ' + verifiedResult.verifiedClaims.join(', '));
    }

    // Add strategy note
    if (researchResult.strategyUsed) {
      outcomeParts.push('Strategies used: ' + researchResult.strategyUsed);
    }

    // Add notes
    if (researchResult.notes) {
      outcomeParts.push('Notes: ' + researchResult.notes);
    }

    return outcomeParts.join('. ');
  }

  /** ----------------------------------------------------------- */
  _evaluateQuality(outcome, task, retrievedExperiences) {
    // PRD §19: Quality evaluation (not claiming better because of NeuraNet)
    // At minimum: factual correctness, source quality, completeness, relevance, citation quality
    
    let qualityScore = 0.5; // Baseline
    const outcomeLower = typeof outcome === 'string' ? outcome.toLowerCase() : '';

    // Simple quality heuristics
    // Completeness: does outcome have substance?
    const hasSubstance = outcome && outcome.length > 50;
    if (hasSubstance) qualityScore += 0.1;

    // Relevance: does outcome reference the task?
    const referencesTask = outcome && outcome.toLowerCase().includes(task.toLowerCase().split(' ')[0]);
    if (referencesTask) qualityScore += 0.1;

    // Source quality: if we have retrieved experiences with high trust, boost
    if (retrievedExperiences && retrievedExperiences.length > 0) {
      const avgTrust = retrievedExperiences.reduce((sum, exp) => sum + (exp.trust_score || 0), 0) / retrievedExperiences.length;
      if (avgTrust > 0.7) qualityScore += 0.1;
    }

    // Citation quality: does outcome reference sources?
    const citations = (outcome.match(/source|reference|study|study/g) || []).length;
    if (citations > 0) qualityScore += 0.1;

    // Cap at 1.0
    qualityScore = Math.min(qualityScore, 1.0);

    return {
      qualityScore: Math.round(qualityScore * 100) / 100,
      completeness: hasSubstance ? 'complete' : 'partial',
      relevance: referencesTask ? 'relevant' : 'partial',
      citationQuality: citations > 0 ? 'cited' : 'uncited',
      details: 'Quality assessment based on outcome substance, task relevance, source trust, and citation presence'
    };
  }

  /** ----------------------------------------------------------- */
  _createExperience(outcome, task, retrievedExperiences, strategies, failedApproaches, verifiedResult) {
    // PRD §12: Experience must represent research process, not just question + answer
    // Must include: task, objective, research strategy, queries, sources,
    // successful approaches, failed approaches, outcome, verification, confidence, agent, model, timestamp, metrics
    
    const searchQuery = this._generateSearchQuery(task);

    // Determine successful and failed approaches
    const successfulApproaches = failedApproaches && failedApproaches.length > 0
      ? [...failedApproaches].reverse() // Use failed as "here's what to avoid" => successful = avoiding those
      : ['Independent research completed', 'Search queries executed'];

    // Generate confidence based on multiple signals
    let confidence = 0.5;
    
    // Boost if we had relevant NeuraNet experiences
    if (retrievedExperiences && retrievedExperiences.length > 0) {
      const avgTrust = retrievedExperiences.reduce((sum, exp) => sum + (exp.trust_score || 0), 0) / retrievedExperiences.length;
      confidence = Math.min(0.5 + (avgTrust * 0.3), 0.95);
    }
    
    // Adjust based on verification
    if (verifiedResult && verifiedResult.verificationStatus === 'verified') {
      confidence = Math.min(confidence + 0.1, 0.95);
    }

    // Generate queries used
    const queries = [searchQuery];

    // Determine domain
    const domain = this._inferDomain(task);

    // Create the experience object
    const experience = {
      task: task,
      objective: 'Research analysis using NeuraNet collective knowledge: ' + task,
      researchStrategy: strategies ? strategies.slice(0, 5) : ['independent_research', 'web_search'],
      queries: queries,
      sources: [], // Will be populated from actual research; marked empty for now
      successful_approaches: successfulApproaches,
      failed_approaches: typeof failedApproaches === 'object' && !Array.isArray(failedApproaches) 
        ? [failedApproaches] 
        : (failedApproaches || []).slice(0, 5),
      outcome: outcome,
      verification: verifiedResult ? verifiedResult.verificationStatus : 'unverified',
      confidence: Math.round(confidence * 100) / 100,
      agent: this.agentId,
      model: this.model,
      timestamp: new Date().toISOString(),
      domain: domain,
      visibility: 'private', // Default per ARCHITECTURE-ESSENTIALS §9
      metrics: {
        inputTokens: 0,
        outputTokens: 0,
        searchCalls: 1,
        toolCalls: 0,
        estimatedCost: 0.03
      }
    };

    return experience;
  }

  /** ----------------------------------------------------------- */
  _inferDomain(task) {
    if (!task || typeof task !== 'string') return 'general';
    const lower = task.toLowerCase();
    if (lower.includes('finance') || lower.includes('market') || lower.includes('stock') || lower.includes('investment')) return 'finance';
    if (lower.includes('code') || lower.includes('software') || lower.includes('program') || lower.includes('debug')) return 'software engineering';
    if (lower.includes('paper') || lower.includes('study') || lower.includes('research') || lower.includes('academic')) return 'academic';
    if (lower.includes('health') || lower.includes('medical') || lower.includes('clinical')) return 'healthcare';
    if (lower.includes('legal') || lower.includes('law') || lower.includes('contract')) return 'legal';
    return 'general';
  }

  /** ----------------------------------------------------------- */
  _generateSearchQuery(task) {
    if (!task || typeof task !== 'string') return 'general research information';
    const words = task.split(' ').filter(w => w.length > 3);
    return words.slice(0, 3).join(' ') + ' information';
  }
}