-- Migration 007: Row Level Security (RLS) & Grant Setup

-- Ensure kombee_app role has permissions
GRANT ALL ON SCHEMA public TO kombee_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kombee_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kombee_app;

-- 1. Tenants table RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_isolation ON tenants;
CREATE POLICY tenants_isolation ON tenants
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Helper loop to apply RLS to all strictly tenant-scoped tables
DO $$
DECLARE
  strictly_tenant_tables TEXT[] := ARRAY[
    'tenant_modules',
    'teams',
    'memberships',
    'sso_configs',
    'api_keys',
    'audit_log',
    'support_grants',
    'exposure_counters',
    'assessments',
    'candidates',
    'invitations',
    'attempts',
    'attempt_answers',
    'attempt_events',
    'consents',
    'executions',
    'integrity_signals',
    'integrity_reviews',
    'candidate_explanations',
    'scores',
    'overrides',
    'rubrics',
    'reviews',
    'decisions',
    'webhook_endpoints',
    'webhook_deliveries',
    'usage_events',
    'reports'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY strictly_tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_tenant_isolation', tbl);
    EXECUTE format(
      $p$
        CREATE POLICY %I ON %I
          USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
      $p$,
      tbl || '_tenant_isolation', tbl
    );
  END LOOP;
END
$$;

-- Tables with optional tenant (platform-shared when tenant_id IS NULL, or tenant-private)
DO $$
DECLARE
  shared_tenant_tables TEXT[] := ARRAY[
    'skills',
    'roles_taxonomy',
    'questions',
    'roles'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY shared_tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_tenant_isolation', tbl);
    EXECUTE format(
      $p$
        CREATE POLICY %I ON %I
          USING (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
      $p$,
      tbl || '_tenant_isolation', tbl
    );
  END LOOP;
END
$$;
