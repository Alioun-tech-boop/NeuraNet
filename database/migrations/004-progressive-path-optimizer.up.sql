-- Migration: 004-progressive-path-optimizer.up.sql
-- Refoundation: NeuraNet as a Progressive Problem-Solving Path Optimizer.
-- REUSE = reuse of a validated ResolutionPath, never of a stored answer.

-- ========================================
-- Problem families: structural classes of problems (not linguistic forms)
-- ========================================
CREATE TABLE problem_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  family_key VARCHAR(120) NOT NULL,        -- deterministic key from ProblemSignature
  domain VARCHAR(100) NOT NULL,
  subdomain VARCHAR(100),
  jurisdiction VARCHAR(100),
  intent VARCHAR(100) NOT NULL,
  granularity VARCHAR(100),
  temporal_scope VARCHAR(20) DEFAULT 'current',
  signature JSONB NOT NULL DEFAULT '{}',   -- full ProblemSignature
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, family_key)
);
CREATE INDEX idx_problem_families_lookup ON problem_families(organization_id, family_key);

-- ========================================
-- Resolution paths: HOW to solve, never WHAT was answered
-- ========================================
CREATE TABLE resolution_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  family_id UUID REFERENCES problem_families(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES resolution_paths(id) ON DELETE SET NULL,

  -- The path itself (execution strategy, infrastructure-side)
  steps JSONB NOT NULL DEFAULT '[]',           -- [{order, action, tool, params, queryPattern}]
  tools_required JSONB DEFAULT '[]',

  -- Transparent multi-criteria scores
  quality_score DECIMAL CHECK (quality_score >= 0 AND quality_score <= 1),
  score_components JSONB DEFAULT '{}',         -- {correctness, verification, reliability, sourceQuality, efficiency}
  latency_score DECIMAL,
  reliability_score DECIMAL,
  verification_score DECIMAL,
  efficiency_score DECIMAL,
  success_rate DECIMAL DEFAULT 0,

  usage_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,

  supersedes UUID REFERENCES resolution_paths(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CANDIDATE'
    CHECK (status IN ('CANDIDATE','ACTIVE','CANONICAL','SUPERSEDED','REJECTED')),

  is_canonical BOOLEAN DEFAULT false,

  provenance JSONB DEFAULT '{}',               -- {createdBy, reason, evidenceProductionId}

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rp_family_canonical ON resolution_paths(family_id) WHERE is_canonical = true;
CREATE INDEX idx_rp_org_family ON resolution_paths(organization_id, family_id);

-- Immutable version history
CREATE TABLE path_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID REFERENCES resolution_paths(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  steps JSONB NOT NULL,
  provenance JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Execution records: evidence that a path ran and how it performed
CREATE TABLE path_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  path_id UUID REFERENCES resolution_paths(id) ON DELETE SET NULL,
  production_id UUID REFERENCES productions(id) ON DELETE SET NULL,

  task_signature JSONB DEFAULT '{}',
  decision VARCHAR(20),                        -- REUSE_PATH / REFRESH / RESEARCH / REJECT_REUSE
  decision_reason TEXT,

  latency_ms INTEGER,
  llm_calls INTEGER DEFAULT 0,
  tavily_calls INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  context_added_tokens INTEGER DEFAULT 0,      -- must always be 0

  quality_score DECIMAL,
  success BOOLEAN DEFAULT true,
  error TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_path_executions_path ON path_executions(path_id);
