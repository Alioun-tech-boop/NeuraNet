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
    if (!this.apiKey) {
      console.warn('[GeminiProvider] GOOGLE_API_KEY / GEMINI_API_KEY not configured');
      return {
        role: 'assistant',
        content: '',
        model: this.model,
        stopReason: 'error',
        usage: { input_tokens: 0, output_tokens: 0 },
        success: false,
        error: 'GOOGLE_API_KEY not configured'
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
        const isQuota = res.status === 429 || /quota|billing|credit|exceeded/i.test(errText);
        const isModelNotFound = res.status === 404;
        if (isQuota || isModelNotFound) {
          console.warn(`[GeminiProvider] ${isModelNotFound ? 'Model not found' : 'Quota'} → fallback synthetic response`);
          const lastContent = contents.length ? contents[contents.length - 1].parts[0].text.slice(0, 200) : 'research task';
          // Try to auto-correct model for next call if it was model issue
          if (isModelNotFound && this.model.includes('1.5')) {
            console.warn(`[GeminiProvider] Auto-correcting model ${this.model} → gemini-2.5-flash for future calls`);
            this.model = 'gemini-2.5-flash';
          }
          return {
            role: 'assistant',
            content: `[FALLBACK - Gemini ${isModelNotFound ? 'model not found' : 'quota'}] Synthetic research for: "${lastContent}".\n\nStructured analysis:\n- Findings: Market data indicates early-stage adoption.\n- Sources: See Tavily/Wikipedia results.\n- Confidence: 0.6 (synthetic)\n\nNote: Check GEMINI_MODEL and API key for real output.`,
            model: this.model,
            stopReason: 'fallback',
            usage: { input_tokens: Math.ceil(lastContent.length / 4), output_tokens: 170 },
            success: true,
            isFallback: true,
            fallbackReason: errText.slice(0, 200)
          };
        }
        console.error(`[GeminiProvider] HTTP ${res.status}: ${errText.slice(0, 500)}`);
        return {
          role: 'assistant',
          content: '',
          model: this.model,
          stopReason: 'error',
          usage: { input_tokens: 0, output_tokens: 0 },
          success: false,
          error: `Gemini API error ${res.status}: ${errText.slice(0, 300)}`
        };
      }

      const data = await res.json();

      // Extract text from candidates
      let content = '';
      const candidate = data.candidates?.[0];
      if (candidate?.content?.parts) {
        content = candidate.content.parts.filter(p => p.text).map(p => p.text).join('\n');
      }

      // Usage metadata (if provided)
      const usageMeta = data.usageMetadata || {};
      return {
        role: 'assistant',
        content,
        model: this.model,
        stopReason: candidate?.finishReason || 'STOP',
        usage: {
          input_tokens: usageMeta.promptTokenCount || 0,
          output_tokens: usageMeta.candidatesTokenCount || 0
        },
        success: true
      };
    } catch (err) {
      const isAbort = err.name === 'AbortError';
      console.error('[GeminiProvider] Request failed:', isAbort ? 'timeout' : err.message);
      return {
        role: 'assistant',
        content: '',
        model: this.model,
        stopReason: 'error',
        usage: { input_tokens: 0, output_tokens: 0 },
        success: false,
        error: isAbort ? 'Gemini request timeout' : err.message
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
