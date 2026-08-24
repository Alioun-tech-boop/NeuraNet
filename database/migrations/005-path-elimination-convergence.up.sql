-- Migration: 005-path-elimination-convergence.up.sql
-- Progressive Path Elimination & Convergence: Pareto domination, controlled states.

-- New controlled state machine: ACTIVE/DOMINATED/ELIMINATED/CANDIDATE
-- Migrate legacy statuses first, then swap constraint.
UPDATE resolution_paths SET status='ACTIVE' WHERE status IN ('CANONICAL','ACTIVE');
UPDATE resolution_paths SET status='DOMINATED' WHERE status='SUPERSEDED';
UPDATE resolution_paths SET status='ELIMINATED' WHERE status='REJECTED';
ALTER TABLE resolution_paths DROP CONSTRAINT IF EXISTS resolution_paths_status_check;
ALTER TABLE resolution_paths ADD CONSTRAINT resolution_paths_status_check
  CHECK (status IN ('CANDIDATE','ACTIVE','DOMINATED','ELIMINATED'));
UPDATE resolution_paths SET is_canonical = true WHERE status = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM resolution_paths p2 WHERE p2.family_id = resolution_paths.family_id AND p2.is_canonical);
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_canonical_per_family ON resolution_paths(family_id) WHERE is_canonical;

-- Observed dimensions kept SEPARATELY (never a single naive score for decisions)
ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS observed_latency_ms INTEGER DEFAULT 0;
ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS observed_tokens INTEGER DEFAULT 0;
ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS observed_tool_calls INTEGER DEFAULT 0;
ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS observed_failures INTEGER DEFAULT 0;
ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS observed_executions INTEGER DEFAULT 0;
ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS pareto_active BOOLEAN DEFAULT true;

-- Elimination evidence (never delete silently)
CREATE TABLE path_eliminations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  eliminated_path_id UUID REFERENCES resolution_paths(id) ON DELETE SET NULL,
  dominated_by UUID REFERENCES resolution_paths(id) ON DELETE SET NULL,
  family_id UUID REFERENCES problem_families(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  dimension_snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exploration budget tracking per family
CREATE TABLE family_exploration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES problem_families(id) ON DELETE CASCADE,
  explored_candidate_id UUID REFERENCES resolution_paths(id) ON DELETE SET NULL,
  outcome VARCHAR(20),   -- PROMOTED / KEPT_AS_PARETO / DOMINATED
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
