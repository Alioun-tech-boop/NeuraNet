/**
 * Groq Provider - Llama/Mixtral via Groq API
 * OpenAI-compatible: https://api.groq.com/openai/v1/chat/completions
 */
import { AIProvider } from './index.js';

export class GroqProvider extends AIProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey || process.env.GROQ_API_KEY;
    this.model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    this.timeoutMs = 30000;
  }

  async complete(messages, options = {}) {
    const start = Date.now();
    if (!this.apiKey) {
      return {
        text: '',
        provider: 'groq',
        model: this.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: Date.now() - start,
        success: false,
        error: 'MISSING_API_KEY: GROQ_API_KEY not configured',
        errorType: 'MISSING_API_KEY',
        statusCode: 0
      };
    }

    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const maxTokens = options.maxTokens || 2048;
    const apiMessages = messages.map(m => ({
      role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '')
    }));

    const body = { model: this.model, messages: apiMessages, temperature, max_tokens: maxTokens };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let errJson = {};
        try { errJson = JSON.parse(errText); } catch {}
        const msg = errJson.error?.message || errText.slice(0, 300);
        return {
          text: '',
          provider: 'groq',
          model: this.model,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          latencyMs,
          success: false,
          error: msg,
          errorType: errJson.error?.type || 'API_ERROR',
          statusCode: res.status,
          // legacy fields for agent compatibility
          role: 'assistant',
          content: '',
          usage: { input_tokens: 0, output_tokens: 0 },
          stopReason: 'error'
        };
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content || '';
      const usage = data.usage || {};
      return {
        text: content,
        provider: 'groq',
        model: data.model || this.model,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        latencyMs: Date.now() - start,
        success: true,
        // legacy
        role: 'assistant',
        content,
        usage: { input_tokens: usage.prompt_tokens || 0, output_tokens: usage.completion_tokens || 0 },
        stopReason: choice?.finish_reason || 'stop'
      };
    } catch (err) {
      const isAbort = err.name === 'AbortError';
      return {
        text: '',
        provider: 'groq',
        model: this.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: Date.now() - start,
        success: false,
        error: isAbort ? 'Groq request timeout' : err.message,
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
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      return null;
    } catch { return null; }
  }
  getModelName() { return this.model; }
  getPricing() {
    return {
      inputPricePer1k: parseFloat(process.env.GROQ_INPUT_PRICE_PER_1K) || 0.00059,
      outputPricePer1k: parseFloat(process.env.GROQ_OUTPUT_PRICE_PER_1K) || 0.00079
    };
  }
}
