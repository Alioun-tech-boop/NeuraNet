-- Migration: 008-adaptive-learning-governance.up.sql

-- Immutable LearningObservation (append-only, never updated/deleted for stats)
CREATE TABLE learning_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  problem_family_id UUID REFERENCES problem_families(id) ON DELETE CASCADE,
  path_id UUID REFERENCES resolution_paths(id) ON DELETE SET NULL,
  execution_id UUID REFERENCES path_executions(id) ON DELETE SET NULL,

  problem_signature JSONB DEFAULT '{}',
  quality DECIMAL,
  correctness DECIMAL,
  success BOOLEAN DEFAULT true,
  latency_ms INTEGER,
  token_usage INTEGER DEFAULT 0,
  tool_calls INTEGER DEFAULT 0,
  failure_type VARCHAR(60),
  environment JSONB DEFAULT '{}',          -- provider/model metadata only
  evaluation_confidence DECIMAL DEFAULT 0.5,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_learn_obs_tenant_family ON learning_observations(tenant_id, problem_family_id, created_at DESC);

-- Family-level governance controls (human override + policy)
ALTER TABLE problem_families ADD COLUMN IF NOT EXISTS learning_frozen BOOLEAN DEFAULT false;
ALTER TABLE problem_families ADD COLUMN IF NOT EXISTS path_frozen BOOLEAN DEFAULT false;
ALTER TABLE problem_families ADD COLUMN IF NOT EXISTS parent_family_key VARCHAR(120); -- specialization hierarchy

-- Governance decision log (audit trail, append-only by convention)
CREATE TABLE governance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  mutation_type VARCHAR(60) NOT NULL,
  target_type VARCHAR(40),
  target_id UUID,
  decision VARCHAR(10) NOT NULL CHECK (decision IN ('ALLOW','LIMIT','REVIEW','DENY')),
  reason TEXT,
  actor VARCHAR(80) DEFAULT 'learning-engine',
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_gov_log_org ON governance_log(organization_id, created_at DESC);
