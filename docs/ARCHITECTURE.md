# Architecture Specification - Kombee Assess (Phase 1)

## 1. System Overview

Kombee Assess is a high-assurance, multi-tenant enterprise SaaS and API platform for skills-based technical assessments, coding evaluations, and candidate review.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SURFACES & CLIENTS                              │
│   Web UI (Tenant & Candidate)  ·  Embeddable Widget  ·  Direct REST API│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       Tenant Context & Resolution
                       Server-Side Module Entitlement
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                        APPLICATION LAYER (EXPRESS)                     │
│  - Fail-closed tenant context middleware (AsyncLocalStorage)           │
│  - Transaction-per-request with SET LOCAL app.tenant_id                │
│  - Auth (JWT/Cookie sessions, RBAC, OIDC SSO, API Keys)                │
│  - Modules: Skills, Question Bank, Assessments, Candidate Runtime,     │
│             Integrity Monitoring, Evidence & Review, Webhooks, Billing │
└─────────────────┬──────────────────────────────────┬───────────────────┘
                  │                                  │
                  ▼                                  ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────┐
│     DATABASE LAYER (POSTGRES)   │   │     EXECUTION ENGINE QUEUE       │
│ - Restricted role: kombee_app   │   │ - Priority Queue (SKIP LOCKED)   │
│ - FORCE ROW LEVEL SECURITY      │   │ - Interactive vs Batch grading   │
│ - Append-only audit & events    │   │ - DockerRunner (prod)            │
│ - Immutable published versions  │   │ - LocalProcessRunner (dev)       │
└─────────────────────────────────┘   │ - sql.js (in-process SQL)        │
                                      └──────────────────────────────────┘
```

## 2. Core Security & Tenancy Architecture

### 2.1 Two-Tier Tenancy Enforcement
1. **Application Context:**
   Every HTTP request passes through `tenantResolver`. If the tenant cannot be resolved and the route is not explicitly exempt (`/api/v1/health`, `/api/v1/auth/login`, `/api/v1/candidates/verify-token`), the request is rejected immediately with HTTP 401 or 403.
2. **Database Row-Level Security:**
   The connection pool executes as a non-superuser database role (`kombee_app`) with `rolbypassrls = false`.
   Every tenant-scoped table has:
   ```sql
   ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
   ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY;
   CREATE POLICY <table_name>_isolation ON <table_name>
     USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
     WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
   ```

### 2.2 Connection-Reuse Guarantee
PostgreSQL session-level settings can leak across pooled connections if not properly reset. To eliminate this vulnerability:
- Every query is wrapped inside a database transaction (`BEGIN ... COMMIT/ROLLBACK`).
- The tenant context is injected using `SELECT set_config('app.tenant_id', $1, true)` where `is_local = true` (`SET LOCAL`).
- As soon as the transaction ends, PostgreSQL automatically discards the setting.

### 2.3 Entitlements & Metering
- Modules (`skills`, `question_bank`, `assessments`, `candidate_testing`, `integrity`, `api_access`, `analytics`) are verified on every request.
- Usage events are recorded into an append-only `usage_events` log for all tenants uniformly (including `billing_status = 'internal'`).

## 3. Sandboxed Code Execution Model
Candidate-submitted code runs asynchronously:
- Interactive runs (candidate clicking "Run" against public sample test cases) are prioritized ahead of background batch grading.
- Sandbox runs are isolated with timeout limits, memory caps (128MB default), process limits, and network denial.
- Outputs (stdout/stderr) are capped to prevent terminal flooding attacks.
