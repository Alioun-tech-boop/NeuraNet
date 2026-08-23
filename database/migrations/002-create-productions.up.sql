-- Migration: 002-create-productions.up.sql
-- Description: Continuous Knowledge - Productions as primary knowledge unit

-- Enable pg_trgm for similarity (if not already)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ========================================
-- Productions - CE QUE le système a produit
-- ========================================
CREATE TABLE productions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Query
  original_query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  query_hash VARCHAR(64) NOT NULL, -- SHA256 of normalized query for clustering
  cluster_id UUID, -- will reference production_clusters after creation

  -- Answer
  answer TEXT NOT NULL,

  -- Domain
  domain VARCHAR(100) DEFAULT 'general',

  -- Claims and sources as JSONB for MVP
  claims JSONB DEFAULT '[]', -- [{claim, confidence, verificationStatus, sourceIds}]
  sources JSONB DEFAULT '[]', -- [{id, title, url, domain, score}]

  -- Scores
  quality_score DECIMAL DEFAULT 0.5 CHECK (quality_score >= 0 AND quality_score <= 1),
  confidence DECIMAL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  verification_status VARCHAR(50) DEFAULT 'unverified' CHECK (verification_status IN ('verified','partially_verified','unverified')),
  freshness_score DECIMAL DEFAULT 1.0 CHECK (freshness_score >= 0 AND freshness_score <= 1),

  -- Canonical
  is_canonical BOOLEAN DEFAULT false,
  canonical_id UUID REFERENCES productions(id) ON DELETE SET NULL,
  version INTEGER DEFAULT 1,

  -- Status for comparison engine
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','superseded','conflicting')),

  -- Metrics
  retrieval_count INTEGER DEFAULT 0,
  reuse_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- Production Clusters - group similar queries
-- ========================================
CREATE TABLE production_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  query_signature VARCHAR(64) NOT NULL, -- hash of normalized query
  domain VARCHAR(100) DEFAULT 'general',
  canonical_production_id UUID REFERENCES productions(id) ON DELETE SET NULL,
  production_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, query_signature)
);

-- Add FK after clusters created
ALTER TABLE productions ADD CONSTRAINT fk_productions_cluster FOREIGN KEY (cluster_id) REFERENCES production_clusters(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_productions_org ON productions(organization_id);
CREATE INDEX idx_productions_query_hash ON productions(query_hash);
CREATE INDEX idx_productions_cluster ON productions(cluster_id);
CREATE INDEX idx_productions_canonical ON productions(is_canonical) WHERE is_canonical = true;
CREATE INDEX idx_productions_domain ON productions(domain);
CREATE INDEX idx_productions_quality ON productions(quality_score DESC);
CREATE INDEX idx_productions_created ON productions(created_at DESC);
CREATE INDEX idx_productions_normalized_query_trgm ON productions USING gin (normalized_query gin_trgm_ops);
CREATE INDEX idx_clusters_org_sig ON production_clusters(organization_id, query_signature);
CREATE INDEX idx_clusters_canonical ON production_clusters(canonical_production_id);
