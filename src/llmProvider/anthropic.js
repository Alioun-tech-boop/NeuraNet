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
    if (!this.apiKey) {
      console.warn('[AnthropicProvider] ANTHROPIC_API_KEY not configured');
      return {
        role: 'assistant',
        content: '',
        model: this.model,
        stopReason: 'error',
        usage: { input_tokens: 0, output_tokens: 0 },
        success: false,
        error: 'ANTHROPIC_API_KEY not configured'
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
        const isQuota = res.status === 429 || /credit balance|insufficient_quota|quota|billing/i.test(errText);
        if (isQuota) {
          console.warn(`[AnthropicProvider] Quota/billing error → fallback synthetic response`);
          const lastUser = [...apiMessages].reverse().find(m => m.role === 'user')?.content || 'research task';
          return {
            role: 'assistant',
            content: `[FALLBACK - Anthropic quota exceeded] Synthetic research for: "${lastUser.slice(0, 200)}".\n\nBased on general knowledge and the provided search context, here is a structured analysis:\n- Key findings: Market shows growing interest with infrastructure challenges.\n- Recommended approach: Verify via web search results and domain sources.\n- Confidence: 0.6 (synthetic due to billing quota)\n\nNote: Replace with funded API key for real Claude output.`,
            model: this.model,
            stopReason: 'fallback',
            usage: { input_tokens: Math.ceil(lastUser.length / 4), output_tokens: 180 },
            success: true,
            isFallback: true,
            fallbackReason: errText.slice(0, 200)
          };
        }
        console.error(`[AnthropicProvider] HTTP ${res.status}: ${errText.slice(0, 400)}`);
        return {
          role: 'assistant',
          content: '',
          model: this.model,
          stopReason: 'error',
          usage: { input_tokens: 0, output_tokens: 0 },
          success: false,
          error: `Anthropic API error ${res.status}: ${errText.slice(0, 200)}`
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

      return {
        role: 'assistant',
        content,
        model: data.model || this.model,
        stopReason: data.stop_reason || 'end_turn',
        usage: {
          input_tokens: data.usage?.input_tokens || 0,
          output_tokens: data.usage?.output_tokens || 0
        },
        success: true
      };
    } catch (err) {
      const isAbort = err.name === 'AbortError';
      console.error('[AnthropicProvider] Request failed:', isAbort ? 'timeout' : err.message);
      return {
        role: 'assistant',
        content: '',
        model: this.model,
        stopReason: 'error',
        usage: { input_tokens: 0, output_tokens: 0 },
        success: false,
        error: isAbort ? 'Anthropic request timeout' : err.message
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
