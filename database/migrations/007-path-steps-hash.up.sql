-- Migration: 007-path-steps-hash.up.sql
-- Accumulate observations per identical procedure (statistical requirement).

ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS steps_hash VARCHAR(64);
ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS last_quality DECIMAL;
CREATE INDEX IF NOT EXISTS idx_rp_steps_hash ON resolution_paths(organization_id, family_id, steps_hash);

-- Backfill from existing rows
UPDATE resolution_paths SET steps_hash = encode(digest(steps::text, 'sha256'), 'hex')
WHERE steps_hash IS NULL;
