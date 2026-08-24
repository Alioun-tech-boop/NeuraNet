-- Migration: 011-local-e5-embeddings.up.sql
ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS local_e5_embedding vector(384);
CREATE INDEX idx_rp_local_e5 ON resolution_paths USING ivfflat (local_e5_embedding vector_cosine_ops) WITH (lists = 10);
