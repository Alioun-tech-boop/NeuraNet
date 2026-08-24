import crypto from 'node:crypto';

/**
 * SemanticEmbeddingProvider — real pretrained embeddings via Gemini gemini-embedding-001.
 * 768 dimensions (reduced from native 3072), multilingual (FR/EN), cosine distance.
 * Zero LLM generation — embedding-only endpoint.
 */
export class SemanticEmbeddingProvider {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    this.model = 'gemini-embedding-001';
    this.dimension = 768;
    this.provider = 'google';
    this.distanceMetric = 'cosine';
    this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent`;
    this.cache = new Map();
    this.stats = { requests: 0, successes: 0, failures: 0, cacheHits: 0 };
  }

  getModelInfo() {
    return { model: this.model, dimension: this.dimension, provider: this.provider,
             distance: this.distanceMetric, maxInputLength: 2048 };
  }

  _cacheKey(text) { return crypto.createHash('sha256').update(`${this.model}:${text}`).digest('hex'); }

  async embed(text) {
    if (!text || typeof text !== 'string') throw new Error('SEMANTIC_EMBEDDING_UNAVAILABLE: empty text');
    const cacheKey = this._cacheKey(text);
    if (this.cache.has(cacheKey)) { this.stats.cacheHits++; return this.cache.get(cacheKey); }

    this.stats.requests++;
    const res = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        outputDimensionality: this.dimension
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`SEMANTIC_EMBEDDING_UNAVAILABLE: ${res.status} ${errText.slice(0,100)}`);
      err.code = 'EMBEDDING_ERROR'; err.statusCode = res.status;
      throw err;
    }

    const data = await res.json();
    const vector = data.embedding?.values;
    if (!Array.isArray(vector) || vector.length !== this.dimension)
      throw new Error(`Invalid embedding dim: expected ${this.dimension}, got ${vector?.length}`);
    for (const v of vector) if (!isFinite(v)) throw new Error('Embedding contains NaN/Infinity');

    // L2 normalize for cosine similarity via dot product
    const norm = Math.sqrt(vector.reduce((s,v)=>s+v*v,0));
    const normalized = norm > 0 ? vector.map(v=>v/norm) : vector;

    this.stats.successes++;
    this.cache.set(cacheKey, normalized);
    return normalized;
  }

  async embedBatch(texts) {
    const results = [];
    for (let i=0;i<texts.length;i+=5) {
      const chunk = texts.slice(i,i+5);
      results.push(...await Promise.all(chunk.map(t=>this.embed(t))));
    }
    return results;
  }
}

export default new SemanticEmbeddingProvider();
