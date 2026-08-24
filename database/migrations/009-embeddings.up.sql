-- Migration: 009-embeddings.up.sql
-- Add embedding support for semantic matching
ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS embedding JSONB DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_rp_embedding ON resolution_paths USING gin (embedding);
