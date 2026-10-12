# Architectural Decision Log (ADR) - Kombee Assess

This document records architectural decisions, assumptions, and rationales for the Kombee Technical Assessment, Interview & Skills Platform (Kombee Assess - Phase 1).

## ADR-001: Tenancy & Database Isolation Model
- **Context:** The system must guarantee zero cross-tenant contamination even across shared, pooled database connections.
- **Decision:**
  1. Multi-tenancy is modeled with a shared PostgreSQL database where every tenant-owned table includes a `tenant_id uuid NOT NULL REFERENCES tenants(id)`.
  2. Postgres Row-Level Security (RLS) is applied with `FORCE ROW LEVEL SECURITY` on all tenant-owned tables.
  3. The runtime connects via a dedicated non-superuser role (`kombee_app`) configured with `NOSUPERUSER` and `NOBYPASSRLS`.
  4. Tenant context is bound strictly per transaction using `SET LOCAL` via `SELECT set_config('app.tenant_id', $1, true)`. Outside of the transaction or upon COMMIT/ROLLBACK, the setting automatically reverts, eliminating connection pollution risks.
  5. The application layer wraps every query in automatic tenant context resolution with a fail-closed policy (non-exempt endpoints missing a valid tenant return HTTP 401/403).

## ADR-002: Uniform Tenant Model & Invoicing
- **Context:** The platform serves external companies, Kombee internal hiring, and HRMS integrations.
- **Decision:** All accounts use an identical `Tenant` record. `billing_status` (`paid`, `trial`, `internal`) impacts only commercial invoicing mechanics. It never alters isolation, entitlements, rate limits, or metering rigor.

## ADR-003: Immutability and Append-Only Audit Integrity
- **Context:** Regulatory auditability, anti-cheating, and legal defensibility require immutable historical evidence.
- **Decision:**
  1. `audit_log`, `attempt_events`, and `usage_events` tables are strictly append-only. A PostgreSQL `BEFORE UPDATE OR DELETE` database trigger prevents modifications or deletions.
  2. Published questions (`question_versions`) and assessments (`assessment_versions`) are permanently locked upon publication (`status = 'published'`). Database triggers prevent updates to published records; any revision creates a new version record.

## ADR-004: Execution Engine Security & Fallback
- **Context:** Arbitrary candidate code execution requires containment against fork bombs, resource starvation, and data exfiltration.
- **Decision:**
  1. Code execution is designed with an `ExecutionRunner` abstraction.
  2. In production / containerized environments, `DockerRunner` provisions ephemeral, throw-away containers with read-only root filesystems, strict memory/CPU cgroups, no network egress, and execution timeouts.
  3. In development environments without Docker daemon access, a sandboxed `LocalProcessRunner` executes supported interpreted/compiled runtimes with strict timeouts and output buffer truncation, explicitly flagged as dev-only.
  4. SQL assessments execute in-process using `sql.js` in a sandboxed, ephemeral in-memory SQLite/SQL environment with read-only query assertion.

## ADR-005: Deterministic Scoring & Human Decision Authority (The Absolute Rule)
- **Context:** AI signals and automated proctoring must support, not displace, human judgment.
- **Decision:**
  1. Deterministic tests (unit test pass/fail, exact SQL result match, MCQ selections) are authoritative and cannot be overridden by AI subjective suggestions.
  2. Integrity signals (tab switching, blur, AI code likelihood, face presence) are strictly advisory. No signal or combination of signals ever automatically penalizes, rejects, or disqualifies a candidate.
  3. Every adverse decision requires explicit, logged human action, and candidates are provided an explanation mechanism before adverse actions are confirmed.

## ADR-006: Brand System and Accessibility (WCAG 2.1 AA)
- **Context:** The UI must adhere to the provided brand guidelines (Poppins typography, Indigo `#4648D4` brand accents, Teal `#029096` interactive buttons, Amber secondary, semantic badges).
- **Decision:** All colors and spacing are systematized as CSS custom properties. For any badge/tag pairing where contrast on light backgrounds may fall short of 4.5:1, the text color variant is slightly darkened while preserving the exact fill hex values specified in the brand guideline.
