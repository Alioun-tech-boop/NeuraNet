/**
 * AIProvider Abstraction
 * 
 * Per PRD.md §10 and ARCHITECTURE-ESSENTIALS §26.
 * 
 * Abstract interface for LLM providers. Agents use this interface
 * to interact with AI models. The concrete implementation can be swapped
 * without changing agent logic.
 * 
 * Provider interchangeability per ARCHITECTURE-ESSENTIALS §26:
 *   Agent
 *     ↓
 *   AIProvider
 *     ↓
 *   Provider implementation (Anthropic, OpenAI, Gemini, etc.)
 * 
 * Key design decisions:
 * - Provider must be interchangeable (swap Claude/GPT/Gemini without agent changes)
 * - External content treated as untrusted data (prompt injection protection)
 - Never let provider responses become instructions automatically
 - Never log API keys
 - If key not configured: graceful error, don't crash
 * - Prices configurable via environment, not hardcoded
 */

export class AIProvider {
  /**
   * Complete a chat completion request
   * @param {Array} messages - Chat messages [ {role, content}, ... ]
   * @param {object} options - Completion options
   * @param {number} [options.temperature=0.7] - Sampling temperature
   * @param {number} [options.maxTokens] - Maximum tokens to generate
   * @returns {Promise<object>} Completion result
   */
  async complete(messages, options = {}) {
    throw new Error('Not implemented: AIProvider.complete()');
  }

  /**
   * Safely extract JSON from LLM response text
   * Per ARCHITECTURE-ESSENTIALS §26: never trust external content as instructions
   * @param {string} text - Raw text from LLM response
   * @returns {object|Promise<object>} Parsed JSON or null
   */
  async extractJson(text) {
    throw new Error('Not implemented: AIProvider.extractJson()');
  }

  /**
   * Get the model name this provider uses
   * @returns {string} Model name
   */
  getModelName() {
    throw new Error('Not implemented: AIProvider.getModelName()');
  }

  /**
   * Get pricing information for token usage tracking
   * @returns {object} { inputPricePer1k, outputPricePer1k }
   */
  getPricing() {
    throw new Error('Not implemented: AIProvider.getPricing()');
  }

  /**
   * Validate that an LLM response doesn't contain prompt injection
   * Per PRD §23 and ARCHITECTURE-ESSENTIALS §23.
   * @param {string} text - LLM response text
   * @returns {boolean} true if response appears safe, false if suspicious
   */
  static validateResponse(text) {
    if (typeof text !== 'string') return false;
    
    const suspiciousPatterns = [
      /(system|instruction|developer|prompt|override|ignore previous)/i,
      /(do not|don't|never|always|must|should)\s+(do|think|believe|follow)/i,
      /<(|")system|<|"developer>/i,
    ];
    
    return !suspiciousPatterns.some(pattern => pattern.test(text));
  }
}