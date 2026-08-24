-- Migration: 006-path-executor-graph.up.sql
-- Generic step execution tracking + shared sub-path graph.

-- Execution step records: what actually ran, per path execution
CREATE TABLE path_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES path_executions(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type VARCHAR(60) NOT NULL,          -- cache_check | web_search | deduplicate | source_rank | verify | synthesize | custom
  params JSONB DEFAULT '{}',
  result_summary JSONB DEFAULT '{}',       -- {count, topUrl, durationMs...} — never secrets
  success BOOLEAN DEFAULT true,
  error TEXT,
  latency_ms INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_exec_steps_exec ON path_execution_steps(execution_id);

-- Shared sub-path graph: nodes = step types, edges = observed transitions
CREATE TABLE path_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  family_id UUID REFERENCES problem_families(id) ON DELETE CASCADE,
  from_step VARCHAR(60) NOT NULL,
  to_step VARCHAR(60) NOT NULL,
  weight INTEGER DEFAULT 0,                -- observations of this transition
  success_weight INTEGER DEFAULT 0,        -- transitions followed by overall success
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, family_id, from_step, to_step)
);
CREATE INDEX idx_path_edges_family ON path_edges(family_id);

-- Step-type reputation: which step types correlate with successful executions
CREATE TABLE step_type_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  step_type VARCHAR(60) NOT NULL,
  observations INTEGER DEFAULT 0,
  successes INTEGER DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  UNIQUE(organization_id, step_type)
);
