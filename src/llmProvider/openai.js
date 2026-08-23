/**
 * OpenAI Provider - GPT API integration
 * 
 * Per PRD.md §10 and ARCHITECTURE-ESSENTIALS §26.
 * Agents can use different providers interchangeably.
 */

import { AIProvider } from './index.js';

export class OpenAIProvider extends AIProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  async complete(messages, options = {}) {
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const maxTokens = options.maxTokens || 1024;
    
    // WARNING: Stub implementation - replace with actual API call
    console.warn('[OpenAIProvider] Using stub completion - replace with actual API call');
    
    return {
      role: 'assistant',
      content: '[STUB] GPT response placeholder',
      model: this.model,
      stopReason: 'max_tokens',
      usage: {
        input_tokens: messages.length * 50,
        output_tokens: maxTokens,
      },
      success: false,
      note: 'Replace with actual OpenAI API call using API key'
    };
  }

  async extractJson(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (e) {
      console.warn('[OpenAIProvider] Failed to extract JSON:', e.message);
      return null;
    }
  }

  getModelName() {
    return this.model;
  }

  getPricing() {
    const inputPrice = parseFloat(process.env.OPENAI_INPUT_PRICE_PER_1K) || 0.005;
    const outputPrice = parseFloat(process.env.OPENAI_OUTPUT_PRICE_PER_1K) || 0.015;
    
    return {
      inputPricePer1k: inputPrice,
      outputPricePer1k: outputPrice
    };
  }
}