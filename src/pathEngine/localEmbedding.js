import { pipeline, env as transformersEnv } from '@xenova/transformers';

/**
 * LocalE5EmbeddingProvider — intfloat/multilingual-e5-small via ONNX.
 * 384 dimensions, multilingual FR/EN, normalized embeddings, cosine distance.
 * Zero API calls after initial model download. Works offline.
 */
export class LocalE5EmbeddingProvider {
  constructor(options = {}) {
    this.modelName = options.model || 'Xenova/multilingual-E5-small';
    this.dimension = 384;
    this.provider = 'local';
    this.distanceMetric = 'cosine';
    this._extractor = null;
    this._loadingPromise = null;
    this.cache = new Map();
    this.stats = { requests: 0, successes: 0, failures: 0, cacheHits: 0 };
  }

  async _loadModel() {
    if (this._extractor) return this._extractor;
    if (this._loadingPromise) return this._loadingPromise;
    this._loadingPromise = pipeline('feature-extraction', this.modelName, { quantized: true })
      .then(ex => { this._extractor = ex; return ex; });
    return this._loadingPromise;
  }

  async embed(text, type = 'query') {
    await this._loadModel();
    const cacheKey = `${type}:${text}`;
    if (this.cache.has(cacheKey)) { this.stats.cacheHits++; return this.cache.get(cacheKey); }
    const prefixed = `${type}: ${text}`;
    const output = await this._extractor(prefixed, { pooling: 'mean', normalize: true });
    this.stats.successes++;
    this.cache.set(cacheKey, Array.from(output.data));
    return Array.from(output.data);
  }

  async embedQuery(text) { return this.embed(text, 'query'); }
  async embedPassage(text) { return this.embed(text, 'passage'); }
  async embedBatchQueries(texts) { return Promise.all(texts.map(t => this.embedQuery(t))); }
  async embedBatchPassages(texts) { return Promise.all(texts.map(t => this.embedPassage(t))); }

  getModelInfo() {
    return { model: this.modelName.replace('Xenova/','intfloat/'), dimension: this.dimension,
             provider: 'local', distance: 'cosine', device: transformersEnv.backends?.onnx?.wasm?.numThreads > 1 ? 'cpu-multithread' : 'cpu' };
  }

  async healthCheck() {
    try {
      await this._loadModel();
      const test = await this.embed('health check probe');
      return { healthy: true, dimension: test.length };
    } catch (e) { return { healthy: false, error: e.message }; }
  }
}

import { env } from '@xenova/transformers';

export function createEmbeddingProvider(providerType, apiKey) {
  switch ((providerType||'').toLowerCase()) {
    case 'gemini': {
      // Lazy import to avoid loading Gemini when using local
      return import('./semanticEmbedding.js').then(m => new m.SemanticEmbeddingProvider(apiKey));
    }
    case 'local': return Promise.resolve(new LocalE5EmbeddingProvider());
    default: throw new Error(`UNKNOWN_EMBEDDING_PROVIDER: "${providerType}"`);
  }
}
