/**
 * LLM Provider Factory
 * Returns the correct AIProvider instance based on provider name
 */
import { GeminiProvider } from './gemini.js';
import { GroqProvider } from './groq.js';
import { OpenRouterProvider } from './openrouter.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';

export function createLLMProvider(providerName, apiKey) {
  const name = (providerName || '').toLowerCase();
  switch (name) {
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'groq':
      return new GroqProvider(apiKey);
    case 'openrouter':
      return new OpenRouterProvider(apiKey);
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'openai':
      return new OpenAIProvider(apiKey);
    default:
      console.warn(`[Factory] Unknown provider "${providerName}", falling back to gemini`);
      return new GeminiProvider(apiKey);
  }
}

export { GeminiProvider, GroqProvider, OpenRouterProvider, AnthropicProvider, OpenAIProvider };
