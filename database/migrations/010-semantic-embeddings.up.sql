-- Migration: 010-semantic-embeddings.up.sql
-- Real semantic embeddings via Gemini text-embedding-004 (768 dims)
ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS semantic_embedding vector(768);
CREATE INDEX idx_rp_semantic_embedding ON resolution_paths USING ivfflat (semantic_embedding vector_cosine_ops) WITH (lists = 10);
