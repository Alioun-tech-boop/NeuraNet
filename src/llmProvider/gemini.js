/**
 * Gemini Provider - Google Gemini API integration
 * 
 * Per PRD.md §10 and ARCHITECTURE-ESSENTIALS §26.
 * Real implementation using https://generativelanguage.googleapis.com/v1beta
 */

import { AIProvider } from './index.js';

export class GeminiProvider extends AIProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    this.timeoutMs = 30000;
  }

  _getApiUrl() {
    // Gemini API key typically starts with AIza; the token in .env (AQ.Ab8...) looks like an OAuth token
    // We try the standard API key flow; if GOOGLE_API_KEY is an OAuth token, the request will fail and we surface the error
    const encodedModel = encodeURIComponent(this.model);
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent`;
  }

  async complete(messages, options = {}) {
    const start = Date.now();
    if (!this.apiKey) {
      console.warn('[GeminiProvider] GEMINI_API_KEY not configured');
      return {
        text: '',
        provider: 'gemini',
        model: this.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
        success: false,
        error: 'MISSING_API_KEY: GEMINI_API_KEY not configured',
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

    // Convert messages to Gemini contents format
    // Gemini uses roles "user" and "model" (not assistant), and no native system role - prepend system as user instruction
    const contents = [];
    let systemPrefix = '';
    for (const m of messages) {
      if (m.role === 'system') {
        systemPrefix += (systemPrefix ? '\n\n' : '') + m.content;
      } else {
        const role = m.role === 'assistant' ? 'model' : 'user';
        let text = String(m.content || '');
        if (role === 'user' && systemPrefix && contents.length === 0) {
          text = systemPrefix + '\n\n' + text;
          systemPrefix = '';
        }
        contents.push({ role, parts: [{ text }] });
      }
    }
    // If only system was provided
    if (contents.length === 0 && systemPrefix) {
      contents.push({ role: 'user', parts: [{ text: systemPrefix }] });
    }
    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const body = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    };

    const url = `${this._getApiUrl()}?key=${encodeURIComponent(this.apiKey)}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[GeminiProvider] HTTP ${res.status}: ${errText.slice(0, 500)}`);
        return {
          text: '',
          provider: 'gemini',
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

      // Extract text from candidates
      let content = '';
      const candidate = data.candidates?.[0];
      if (candidate?.content?.parts) {
        content = candidate.content.parts.filter(p => p.text).map(p => p.text).join('\n');
      }

      const usageMeta = data.usageMetadata || {};
      const inputTokens = usageMeta.promptTokenCount || 0;
      const outputTokens = usageMeta.candidatesTokenCount || 0;
      return {
        text: content,
        provider: 'gemini',
        model: data.model || this.model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: Date.now() - start,
        success: true,
        role: 'assistant',
        content,
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
        stopReason: candidate?.finishReason || 'STOP'
      };
    } catch (err) {
      const isAbort = err.name === 'AbortError';
      console.error('[GeminiProvider] Request failed:', isAbort ? 'timeout' : err.message);
      return {
        text: '',
        provider: 'gemini',
        model: this.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: Date.now() - start,
        success: false,
        error: isAbort ? 'Gemini request timeout' : err.message,
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
      console.warn('[GeminiProvider] Failed to extract JSON:', e.message);
      return null;
    }
  }

  getModelName() {
    return this.model;
  }

  getPricing() {
    const inputPrice = parseFloat(process.env.GEMINI_INPUT_PRICE_PER_1K) || 0.0025;
    const outputPrice = parseFloat(process.env.GEMINI_OUTPUT_PRICE_PER_1K) || 0.0075;
    return { inputPricePer1k: inputPrice, outputPricePer1k: outputPrice };
  }
}
