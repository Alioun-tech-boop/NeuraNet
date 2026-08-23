/**
 * NeuraNet Client - Agent-facing API client
 * 
 * Per ARCHITECTURE-ESSENTIALS §3: Agents must communicate with NeuraNet
 * through a clean layer, not directly access the database.
 * 
 * Conceptual flow per ARCHITECTURE-ESSENTIALS §3:
 *   Agent
 *     ↓
 *   Agent Runtime
 *     ↓
 *   NeuraNet Client
 *     ↓
 *   NeuraNet API
 *     ↓
 *   Experience Engine
 * 
 * Security per ARCHITECTURE-ESSENTIALS §29: Never trust client-provided
 * user_id, organization_id, permissions, trust_score. Authorization must
 * be derived from authenticated context.
 */

import { pool } from '../db/connection.js';
import strategyEngine from '../strategies/index.js';

export class NeuraNetClient {
  /**
   * Create a new NeuraNet client
   * @param {object} config - Configuration
   * @param {string} config.apiKey - NeuraNet API key (X-API-Key header)
   * @param {string} config.baseURL - API base URL (default: http://localhost:3000)
   * @param {string} config.organizationId - Organization ID for tenant isolation
   */
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.NEURANET_API_KEY;
    this.baseURL = config.baseURL || process.env.NEURANET_API_BASE_URL || 'http://localhost:3000';
    this.organizationId = config.organizationId || process.env.DEFAULT_ORGANIZATION_ID;
    
    if (!this.apiKey) {
      console.warn('[NeuraNetClient] API key not configured - some functions will be disabled');
    }
  }

  /** ----------------------------------------------------------- */
  /** Experience Retrieval ---------------------------------------- */
  /** ----------------------------------------------------------- */

  /**
   * Retrieve relevant experiences from NeuraNet for a research task
   * Per ARCHITECTURE-ESSENTIALS §11 and §18.
   * 
   * Hybrid retrieval: semantic similarity + keyword + metadata + trust + freshness
   * 
   * @param {string} task - The research task description
   * @param {object} options - Retrieval options
   * @param {number} [options.topK=5] - Number of top experiences to return
   * @param {string} [options.domain] - Optional domain filter
   * @returns {Promise<Array>} Array of relevant experiences
   */
  async retrieveExperiences(task, options = {}) {
    if (!this.apiKey) {
      console.warn('[NeuraNetClient] API key missing, cannot retrieve experiences');
      return [];
    }

    const topK = options.topK || 5;
    const domain = options.domain || 'general';

    try {
      const response = await fetch(`${this.baseURL}/v1/experiences/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          task_id: options.taskId || null,
          // We'll need the task details; if taskId not provided, we'll
          // pass the task text and the server may normalize it
          // For now, pass task as original_task
          original_task: task,
          domain: domain
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[NeuraNetClient] NeuraNet retrieval error:', errorData);
        return [];
      }

      const result = await response.json();
      return result.data?.recommendations || [];

    } catch (error) {
      console.error('[NeuraNetClient] Error retrieving experiences:', error);
      return [];
    }
  }

  /**
   * Generate a research strategy from retrieved experiences
   * Per PRD.md §16 and ARCHITECTURE-ESSENTIALS §18.
   * 
   * @param {Array} experiences - Retrieved experiences from NeuraNet
   * @param {string} task - The research task
   * @param {object} options - Strategy options
   * @returns {object} Generated strategy
   */
  generateStrategy(experiences, task, options = {}) {
    if (!strategyEngine) {
      console.error('[NeuraNetClient] Strategy engine not available');
      return null;
    }

    return strategyEngine.generateStrategy({
      experiences: experiences || [],
      task: {
        original_task: task,
        domain: options.domain || 'general',
        normalized_task: { intent: 'research' }
      },
      topK: options.topK || 1
    });
  }

  /**
   * Persist a generated strategy to the NeuraNet database
   * Per ARCHITECTURE.md §19: strategies are versioned.
   * 
   * @param {object} strategy - Strategy object to persist
   * @returns {Promise<object>} Persisted strategy result
   */
  async saveStrategy(strategy) {
    if (!this.apiKey) {
      console.warn('[NeuraNetClient] API key missing, cannot save strategy');
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/v1/strategies/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          task_id: strategy?.lastTaskId || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[NeuraNetClient] Failed to save strategy:', errorData);
        return null;
      }

      const result = await response.json();
      return result.data || null;

    } catch (error) {
      console.error('[NeuraNetClient] Error saving strategy:', error);
      return null;
    }
  }

  /**
   * Retrieve a stored strategy by ID
   * Per ARCHITECTURE-ESSENTIALS §19: strategy version tracking.
   * 
   * @param {string} strategyId - The strategy ID
   * @returns {Promise<object|null>} Strategy data or null
   */
  async getStrategy(strategyId) {
    if (!this.apiKey) {
      console.warn('[NeuraNetClient] API key missing, cannot retrieve strategy');
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/v1/strategies/${strategyId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[NeuraNetClient] Failed to retrieve strategy:', errorData);
        return null;
      }

      const result = await response.json();
      return result.data || null;

    } catch (error) {
      console.error('[NeuraNetClient] Error retrieving strategy:', error);
      return null;
    }
  }

  /**
   * List all strategies for the organization
   * @returns {Promise<Array>} Array of strategies
   */
  async listStrategies() {
    if (!this.apiKey) {
      console.warn('[NeuraNetClient] API key missing, cannot list strategies');
      return [];
    }

    try {
      const response = await fetch(`${this.baseURL}/v1/strategies`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[NeuraNetClient] Failed to list strategies:', errorData);
        return [];
      }

      const result = await response.json();
      return result.data || [];

    } catch (error) {
      console.error('[NeuraNetClient] Error listing strategies:', error);
      return [];
    }
  }

  /** ----------------------------------------------------------- */
  /** Experience Submission --------------------------------------- */
  /** ----------------------------------------------------------- */

  /**
   * Submit a research experience to NeuraNet
   * Per PRD.md §12 and ARCHITECTURE-ESSENTIALS §14-17.
   * 
   * The experience must represent the research process, not just question + answer.
   * 
   * @param {object} experience - Experience object to submit
   * @param {string} experience.task - The research task
   * @param {string} experience.objective - What the research sought to find
   * @param {Array} experience.researchStrategy - Steps taken during research
   * @param {Array} experience.queries - Search queries executed
   * @param {Array} experience.sources - Sources consulted
   * @param {Array} experience.successfulApproaches - What worked
   * @param {Array} experience.failedApproaches - What didn't work
   * @param {string} experience.outcome - Research findings
   * @param {string} experience.verification - verification status (passed/failed/unverified)
   * @param {number} experience.confidence - Confidence score (0-1)
   * @param {string} experience.agent - Agent identifier
   * @param {string} experience.model - Model used
   * @param {object} experience.metrics - Token usage and cost metrics
   * @param {string} experience.domain - Task domain
   * @param {string} experience.visibility - Visibility (private/org/collective, default: private)
   * @returns {Promise<object>} Submission result
   */
  async submitExperience(experience) {
    if (!this.apiKey) {
      console.warn('[NeuraNetClient] API key missing, cannot submit experience');
      return { success: false, error: 'API key missing' };
    }

    // Default visibility is PRIVATE per ARCHITECTURE-ESSENTIALS §9
    const visibility = experience.visibility || 'private';

    // Build provenance per ARCHITECTURE-ESSENTIALS §11
    const provenance = {
      source_agent_id: experience.agent || this.agentId || 'unknown',
      originating_task_id: experience.taskId || null,
      created_by: 'agent',
      contribution_timestamp: new Date().toISOString(),
      organization_id: this.organizationId
    };

    // Calculate initial trust score per ARCHITECTURE-ESSENTIALS §12
    // Base trust for new contributions
    let initialTrust = 0.3;
    
    if (experience.confidence !== undefined) {
      initialTrust = Math.min(0.5 + (experience.confidence * 0.4), 1.0);
    }
    
    // Boost if verification passed (if provided)
    if (experience.verification === 'passed') {
      initialTrust = Math.min(initialTrust + 0.2, 1.0);
    }

    // Set freshness score per domain (ARCHITECTURE-ESSENTIALS §44)
    let freshnessScore = 1.0;
    if (experience.domain === 'finance' || experience.domain === 'markets') {
      freshnessScore = 0.5; // Higher freshness requirement for finance
    }

    const experienceData = {
      organization_id: this.organizationId,
      agent_id: experience.agent || null,
      task_id: experience.taskId || null,
      outcome: experience.outcome,
      strategy: experience.researchStrategy || null,
      search_queries: experience.queries || null,
      sources: experience.sources || null,
      domain: experience.domain || null,
      quality_score: experience.qualityScore || null,
      confidence_score: experience.confidence || null,
      verification_status: experience.verification || 'unverified',
      visibility: visibility,
      provenance: JSON.stringify(provenance),
      freshness_score: freshnessScore
    };

    try {
      const response = await fetch(`${this.baseURL}/v1/experiences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify(experienceData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[NeuraNetClient] Failed to submit experience:', errorData);
        return { success: false, error: errorData.error || 'Failed to submit experience' };
      }

      const result = await response.json();
      return { success: true, experienceId: result.data.id, ...result.data };

    } catch (error) {
      console.error('[NeuraNetClient] Error submitting experience:', error);
      return { success: false, error: error.message };
    }
  }

  /** ----------------------------------------------------------- */
  /** Agent LLM Interaction --------------------------------------- */
  /** ----------------------------------------------------------- */

  /**
   * Have the agent's configured LLM complete a chat composition
   * Per PRD.md §10.
   * 
   * @param {Array} messages - Chat messages [ {role, content}, ... ]
   * @param {object} options - Completion options
   * @param {string} [options.provider] - Provider name (anthropic, openai, gemini)
   * @returns {Promise<object>} LLM completion result
   */
  async complete(messages, options = {}) {
    // In a full implementation, this would use the agent's configured LLM provider
    // For now, delegate to the AgentRuntime which has the provider config
    console.warn('[NeuraNetClient] complete() - delegate to AgentRuntime LLM provider');
    return {
      role: 'assistant',
      content: 'LLM completion not directly supported - use AgentRuntime with configured provider',
      content: '',
      model: 'unknown',
      usage: { input_tokens: 0, output_tokens: 0 }
    };
  }

  /**
   * Check if the client is properly configured
   * @returns {boolean} True if minimally configured
   */
  isConfigured() {
    return !!this.apiKey;
  }
}