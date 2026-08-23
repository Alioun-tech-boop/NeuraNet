/**
 * Anthropic Provider - Claude API integration
 * 
 * Per PRD.md §10 and ARCHITECTURE-ESSENTIALS §26.
 * Real implementation using https://api.anthropic.com/v1/messages
 */

import { AIProvider } from './index.js';

export class AnthropicProvider extends AIProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
    this.timeoutMs = 30000;
  }

  async complete(messages, options = {}) {
    const start = Date.now();
    if (!this.apiKey) {
      console.warn('[AnthropicProvider] ANTHROPIC_API_KEY not configured');
      return {
        text: '',
        provider: 'anthropic',
        model: this.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
        success: false,
        error: 'MISSING_API_KEY: ANTHROPIC_API_KEY not configured',
        errorType: 'MISSING_API_KEY',
        statusCode: 0,
        role: 'assistant',
        content: '',
        usage: { input_tokens: 0, output_tokens: 0 },
        stopReason: 'error'
      };
    }

    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const maxTokens = options.maxTokens || 2048;

    // Anthropic requires system as top-level param, not in messages
    let systemPrompt = null;
    const apiMessages = [];
    for (const m of messages) {
      if (m.role === 'system') {
        systemPrompt = systemPrompt ? systemPrompt + '\n\n' + m.content : m.content;
      } else if (m.role === 'user' || m.role === 'assistant') {
        apiMessages.push({ role: m.role, content: m.content });
      }
    }
    // Ensure at least one user message
    if (apiMessages.length === 0) {
      apiMessages.push({ role: 'user', content: 'Hello' });
    }

    const body = {
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages: apiMessages
    };
    if (systemPrompt) body.system = systemPrompt;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[AnthropicProvider] HTTP ${res.status}: ${errText.slice(0, 400)}`);
        return {
          text: '',
          provider: 'anthropic',
          model: this.model,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          latencyMs: Date.now() - start,
          success: false,
          error: errText.slice(0, 300),
          errorType: 'API_ERROR',
          statusCode: res.status,
          role: 'assistant',
          content: '',
          usage: { input_tokens: 0, output_tokens: 0 },
          stopReason: 'error'
        };
      }

      const data = await res.json();

      // Extract text from content blocks
      let content = '';
      if (Array.isArray(data.content)) {
        content = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      } else if (typeof data.content === 'string') {
        content = data.content;
      }

      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      return {
        text: content,
        provider: 'anthropic',
        model: data.model || this.model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: Date.now() - start,
        success: true,
        role: 'assistant',
        content,
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
        stopReason: data.stop_reason || 'end_turn'
      };
    } catch (err) {
      const isAbort = err.name === 'AbortError';
      console.error('[AnthropicProvider] Request failed:', isAbort ? 'timeout' : err.message);
      return {
        text: '',
        provider: 'anthropic',
        model: this.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: Date.now() - start,
        success: false,
        error: isAbort ? 'Anthropic request timeout' : err.message,
        errorType: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        statusCode: 0,
        role: 'assistant',
        content: '',
        usage: { input_tokens: 0, output_tokens: 0 },
        stopReason: 'error'
      };
    }
  }

  async extractJson(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return null;
    } catch (e) {
      console.warn('[AnthropicProvider] Failed to extract JSON:', e.message);
      return null;
    }
  }

  getModelName() {
    return this.model;
  }

  getPricing() {
    const inputPrice = parseFloat(process.env.ANTHROPIC_INPUT_PRICE_PER_1K) || 0.015;
    const outputPrice = parseFloat(process.env.ANTHROPIC_OUTPUT_PRICE_PER_1K) || 0.075;
    return { inputPricePer1k: inputPrice, outputPricePer1k: outputPrice };
  }
}
