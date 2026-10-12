-- Migration 003: Skills, Roles Taxonomy & Question Bank

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  domain VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  sub_skill VARCHAR(150),
  description TEXT,
  proficiency_levels JSONB NOT NULL DEFAULT '["beginner", "intermediate", "advanced", "expert"]',
  visibility VARCHAR(20) NOT NULL DEFAULT 'platform' CHECK (visibility IN ('platform', 'tenant', 'team')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  description TEXT,
  visibility VARCHAR(20) NOT NULL DEFAULT 'platform' CHECK (visibility IN ('platform', 'tenant', 'team')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles_taxonomy(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  weight NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  target_level VARCHAR(20) NOT NULL CHECK (target_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, skill_id)
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'tenant' CHECK (visibility IN ('platform', 'tenant', 'team')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  summary VARCHAR(300),
  content JSONB NOT NULL,
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
  points INTEGER NOT NULL DEFAULT 10,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  reference_solution JSONB,
  reference_solution_verified BOOLEAN NOT NULL DEFAULT false,
  author_id UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_id, version)
);

CREATE TABLE IF NOT EXISTS question_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_version_id UUID NOT NULL REFERENCES question_versions(id) ON DELETE CASCADE,
  test_type VARCHAR(50) NOT NULL DEFAULT 'unit_test' CHECK (test_type IN ('unit_test', 'stdin_stdout', 'sql_assertion')),
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT true,
  weight NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_skills (
  question_version_id UUID NOT NULL REFERENCES question_versions(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (question_version_id, skill_id)
);

CREATE TABLE IF NOT EXISTS exposure_counters (
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  times_served INTEGER NOT NULL DEFAULT 0,
  last_served_at TIMESTAMPTZ,
  PRIMARY KEY (question_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS leak_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  snippet TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed_leak', 'dismissed')),
  reviewer_id UUID REFERENCES users(id),
  review_note TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS language_safety_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(10) NOT NULL UNIQUE,
  prohibited_terms JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS language_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(10) NOT NULL REFERENCES language_safety_lists(language_code) ON DELETE CASCADE UNIQUE,
  safety_signed_off BOOLEAN NOT NULL DEFAULT false,
  signed_off_by UUID REFERENCES users(id),
  signed_off_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_question_versions_status ON question_versions(status);
CREATE INDEX IF NOT EXISTS idx_questions_tenant ON questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skills_tenant ON skills(tenant_id);
