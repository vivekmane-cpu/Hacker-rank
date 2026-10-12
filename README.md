# Kombee Assess — Technical Assessment, Interview & Skills Platform (Phase 1)

Kombee Assess is a multi-tenant enterprise SaaS and API platform for skills-based technical assessments, coding evaluations, and candidate review.

## Architecture Highlights
- **Strict Multi-Tenancy:** Two-tier enforcement via request-scoped application context and PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`).
- **Connection-Reuse Safety:** Request-level tenant context applied strictly within transactions using `SET LOCAL` (`SELECT set_config('app.tenant_id', $1, true)`). It is discarded on transaction completion to prevent cross-tenant data leaks.
- **Fail-Closed Policy:** Requests without a resolved tenant are rejected (HTTP 401/403) unless accessing explicitly exempt routes.
- **Human Decision Authority (The Absolute Rule):** Automated signals (proctoring, AI code likelihood) are advisory only. Hiring outcomes always require logged human actions.
- **Immutable Historical Records:** Published questions and assessments are locked by database triggers; audit logs and event timelines are append-only.

## Project Structure
```
├── server/               # Express + TypeScript backend
│   ├── migrations/       # Numbered SQL migrations
│   ├── src/
│   │   ├── db/           # Pools, migrations runner, seed script
│   │   ├── scripts/      # verify-rls coverage audit
│   │   └── index.ts      # Server entry point
│   └── test/             # Supertest & Vitest suites
├── web/                  # React 18 + TypeScript + Vite frontend
├── docs/                 # ARCHITECTURE.md, DECISIONS.md, KNOWN_GAPS.md, PHASE2_HOOKS.md
├── docker-compose.yml    # PostgreSQL, Server, Web containers
├── .env.example          # Environment variables template
└── package.json          # Monorepo workspaces configuration
```

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+
- PostgreSQL 15+ (or Docker)

### 2. Setup & Installation
```bash
# Install all dependencies across monorepo
npm install

# Configure environment variables
cp .env.example .env
```

### 3. Database Migration & Seeding
```bash
# Run migrations (creates tables, roles, RLS policies, triggers)
npm run db:migrate

# Verify Row-Level Security enforcement
npm run db:verify-rls

# Seed default tenants, taxonomy, and system roles
npm run db:seed
```

### 4. Running the Application
```bash
# Run server
npm run dev:server

# Run web app
npm run dev:web
```
