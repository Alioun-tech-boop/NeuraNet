-- Migration: 003-create-research-paths.up.sql
-- ResearchPath versioning for continuous intelligence

CREATE TABLE research_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  task_family VARCHAR(100) NOT NULL, -- e.g., ENERGY_GHANA_REGULATORY
  domain VARCHAR(100) DEFAULT 'general',
  version INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES research_paths(id) ON DELETE SET NULL,
  steps JSONB NOT NULL DEFAULT '[]', -- [{order, action, query, type, confidence}]
  is_canonical BOOLEAN DEFAULT false,
  quality_score DECIMAL DEFAULT 0.5,
  verification_status VARCHAR(50) DEFAULT 'unverified',
  latency_ms INTEGER DEFAULT 0,
  search_count INTEGER DEFAULT 0,
  token_usage JSONB DEFAULT '{"input":0,"output":0}',
  success_rate DECIMAL DEFAULT 0,
  provenance JSONB DEFAULT '{}', -- {createdBy, parentId, changes, productionId, experienceId}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, task_family, version)
);

CREATE TABLE research_path_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID REFERENCES research_paths(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  steps JSONB NOT NULL,
  provenance JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_research_paths_org_family ON research_paths(organization_id, task_family);
CREATE INDEX idx_research_paths_canonical ON research_paths(organization_id, task_family) WHERE is_canonical = true;
CREATE INDEX idx_research_paths_domain ON research_paths(domain);
