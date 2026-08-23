-- Migration: 001-create-core-schema.up.sql
-- Description: Create core schema for NeuraNet MVP
-- Run: npx pg-migrate install && npx pg-migrate register 001-create-core-schema.up.sql

-- ========================================
-- Extensions
-- ========================================
-- pgvector will be added separately; for MVP, embeddings stored as JSONB

-- ========================================
-- Organizations (tenant isolation)
-- ========================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Users
-- ========================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- API Keys (server-to-server authentication)
-- Per PRD.md §28 and ARCHITECTURE-ESSENTIALS §38-39:
-- - Never stored in plaintext
-- - Hashed using bcrypt
-- - Support rotation, revocation, scopes
-- - Audit metadata
-- ========================================
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  hash VARCHAR(255) NOT NULL, -- bcrypt hash of the API key
  scopes JSONB DEFAULT '[]', -- e.g., ["tasks:read", "experiences:write"]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT
);

-- ========================================
-- Agents
-- Per ARCHITECTURE.md §10 and ARCHITECTURE-ESSENTIALS §11:
-- - Unique identity separate from model identity
-- - Belongs to organization
-- - Capabilities declared explicitly
-- ========================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  capabilities JSONB DEFAULT '[]', -- e.g., ["web_research", "financial_analysis"]
  model_provider VARCHAR(100), -- e.g., "openai", "anthropic", "open-source"
  model_name VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active', -- active, quarantined, inactive
  reputation_score DECIMAL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Tasks
-- Per PRD.md §10 and ARCHITECTURE.md §13:
-- - Task ID, agent ID, normalized representation
-- - Domain, constraints, language, privacy classification
-- ========================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  original_task TEXT NOT NULL,
  normalized_task JSONB, -- semantic representation
  domain VARCHAR(100),
  constraints JSONB DEFAULT '{}',
  language VARCHAR(10) DEFAULT 'en',
  privacy_classification VARCHAR(20) DEFAULT 'private',
  status VARCHAR(50) DEFAULT 'pending', -- pending, normalized, retrieved, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Task Embeddings
-- Stored as JSONB for MVP; pgvector can be adopted later
-- ========================================
CREATE TABLE task_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  embedding JSONB DEFAULT '[]', -- [float] vector dimensions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Experiences
-- Per ARCHITECTURE-ESSENTIALS §7, §11, §21 and ARCHITECTURE.md §19-21:
-- - Core knowledge unit
-- - visibility: PRIVATE/ORGANIZATION/COLLECTIVE (default PRIVATE)
-- - trust_score, confidence_score, provenance
-- - freshness metadata
-- ========================================
CREATE TABLE experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  
  -- Experience metadata
  visibility VARCHAR(20) DEFAULT 'private', -- private, organization, collective
  
  -- Task and strategy information
  task_type VARCHAR(100),
  domain VARCHAR(100),
  strategy JSONB, -- reusable research strategy
  successful_approaches JSONB DEFAULT '[]',
  failed_approaches JSONB DEFAULT '[]',
  
  -- Search and source information
  search_queries JSONB DEFAULT '[]',
  sources JSONB DEFAULT '[]',
  source_reliability JSONB DEFAULT '{}',
  
  -- Outcome and evaluation
  outcome TEXT,
  quality_score DECIMAL DEFAULT 0,
  confidence_score DECIMAL DEFAULT 0,
  trust_score DECIMAL DEFAULT 0,
  verification_status VARCHAR(50) DEFAULT 'unverified',
  
 -- Provenance (mandatory per ARCHITECTURE-ESSENTIALS §11)
  provenance JSONB DEFAULT '{}', -- who/what generated, task, sources, created_at, etc.
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  validated_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Metrics
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  reuse_count INTEGER DEFAULT 0,
  
 -- Embedding for semantic retrieval (JSONB for MVP, pgvector later)
  embedding JSONB DEFAULT '[]',
  
  -- Freshness
  freshness_score DECIMAL DEFAULT 1.0, -- 0.0 = obsolete, 1.0 = fresh
  
  -- Constraints
  CONSTRAINT chk_visibility CHECK (visibility IN ('private', 'organization', 'collective')),
  CONSTRAINT chk_trust_score CHECK (trust_score >= 0 AND trust_score <= 1),
  CONSTRAINT chk_confidence_score CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT chk_quality_score CHECK (quality_score >= 0 AND quality_score <= 1)
);

-- ========================================
-- Strategies
-- Per ARCHITECTURE-ESSENTIALS §18 and ARCHITECTURE.md §24:
-- - Reusable research procedures
-- - Versioned
-- ========================================
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  version INTEGER DEFAULT 1,
  description TEXT,
  steps JSONB DEFAULT '[]', -- recommended research sequence
  confidence DECIMAL DEFAULT 0.5,
  success_rate DECIMAL DEFAULT 0,
  average_searches DECIMAL DEFAULT 0,
  average_latency DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_version CHECK (version >= 1)
);

-- ========================================
-- Strategy Versions
-- Per ARCHITECTURE.md §19:
-- - Tracks strategy evolution
-- ========================================
CREATE TABLE strategy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  steps JSONB NOT NULL,
  confidence DECIMAL DEFAULT 0.5,
  success_rate DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_version_positive CHECK (version > 0)
);

-- ========================================
-- Sources
-- Per ARCHITECTURE-ESSENTIALS §26 and ARCHITECTURE.md §27:
-- - Source metadata with reputation
-- ========================================
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_domain VARCHAR(500) NOT NULL,
  category VARCHAR(100),
  trust_score DECIMAL DEFAULT 0.5,
  freshness VARCHAR(50) DEFAULT 'unknown', -- unknown, high, medium, low, evergreen
  domain_relevance DECIMAL DEFAULT 0.5,
  successful_usage_count INTEGER DEFAULT 0,
  failed_usage_count INTEGER DEFAULT 0,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_trust CHECK (trust_score >= 0 AND trust_score <= 1),
  CONSTRAINT chk_domain_relevance CHECK (domain_relevance >= 0 AND domain_relevance <= 1)
);

-- ========================================
-- Evaluations
-- Per PRD.md §21 and ARCHITECTURE-ESSENTIALS §12:
-- - Trust/experience evaluation records
-- ========================================
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID REFERENCES experiences(id) ON DELETE CASCADE,
  evaluator_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  score DECIMAL DEFAULT 0, -- 0.0 to 1.0
  verification_passed BOOLEAN DEFAULT FALSE,
  feedback JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Audit Logs
-- Per ARCHITECTURE-ESSENTIALS §38 and AGENTS.md §69:
-- - Security-sensitive actions audit trail
-- - Must not contain secrets
-- ========================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50), -- agent, task, experience, etc.
  entity_id UUID,
  performed_by UUID, -- agent_id or user_id
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Usage Metrics
-- Per PRD.md §36 and ARCHITECTURE-ESSENTIALS §37:
-- - Cost and performance tracking
-- ========================================
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  
  -- Metrics
  model_calls INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  search_calls INTEGER DEFAULT 0,
  embedding_calls INTEGER DEFAULT 0,
  estimated_cost DECIMAL DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  
  -- Context
  action VARCHAR(100) NOT NULL, -- e.g., "task_submission", "experience_retrieval", "strategy_generation"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Indexes for performance
-- ========================================

-- Organization isolation indexes (critical per ARCHITECTURE-ESSENTIALS §9, §10)
CREATE INDEX idx_agents_organization ON agents(organization_id);
CREATE INDEX idx_tasks_organization ON tasks(organization_id);
CREATE INDEX idx_experiences_organization ON experiences(organization_id);
CREATE INDEX idx_api_keys_organization ON api_keys(organization_id);
CREATE INDEX idx_users_organization ON users(organization_id);

-- Tenant isolation: every database query involving tenant data must review isolation
-- Per ARCHITECTURE-ESSENTIALS §9

-- Full-text search index on tasks
CREATE INDEX idx_tasks_search ON tasks USING gin (to_tsvector('english', original_task));

-- JSONB indexes for common query patterns
CREATE INDEX idx_experiences_task_type ON experiences(task_type);
CREATE INDEX idx_experiences_domain ON experiences(domain);
CREATE INDEX idx_experiences_visibility ON experiences(visibility);
CREATE INDEX idx_strategies_name ON strategies(name);

-- Audit log indexes
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Usage metrics indexes
CREATE INDEX idx_usage_metrics_action ON usage_metrics(action);
CREATE INDEX idx_usage_metrics_organization ON usage_metrics(organization_id);

-- Default organization seed (for development)
INSERT INTO organizations (id, name, description) VALUES ('00000000-0000-0000-0000-000000000001', 'NeuraNet Demo Organization', 'Default organization for MVP development') ON CONFLICT DO NOTHING;

-- ========================================
-- End of migration
-- ========================================