import crypto from 'node:crypto';
import { ProductionEngine } from '../productions/engine.js';

const legacy = new ProductionEngine();

/**
 * Deterministic hash-based embedding: 384-dim bag-of-words from stemmed tokens.
 * No LLM call. Captures semantic overlap after canonicalization.
 * Different from trigram (character n-grams) — captures word-level semantics.
 */
export function generateEmbedding(text, dim = 384) {
  const tokens = legacy.contentTokens(text);
  const vec = new Array(dim).fill(0);
  for (const tok of tokens) {
    const h = crypto.createHash('md5').update(tok).digest();
    // Hash into multiple positions for better distribution
    for (let i = 0; i < 3; i++) {
      const idx = ((h[i * 4] << 24 | h[i * 4 + 1] << 16 | h[i * 4 + 2] << 8 | h[i * 4 + 3]) >>> 0) % dim;
      vec[idx] += 1;
    }
  }
  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm > 0) return vec.map(v => Math.round(v / norm * 10000) / 10000);
  return vec;
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; normA += a[i]*a[i]; normB += b[i]*b[i]; }
  const denom = Math.sqrt(normA)*Math.sqrt(normB);
  return denom > 0 ? dot/denom : 0;
}
