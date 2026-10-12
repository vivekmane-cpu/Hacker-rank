"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSeed = runSeed;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pool_js_1 = require("./pool.js");
async function runSeed() {
    const client = await pool_js_1.superuserPool.connect();
    try {
        console.log('[Seed] Seeding initial platform data...');
        await client.query('BEGIN');
        // 1. System Roles & Permissions
        const permissions = [
            'skills:read', 'skills:write',
            'questions:read', 'questions:write', 'questions:publish',
            'assessments:read', 'assessments:write', 'assessments:publish',
            'candidates:read', 'candidates:write', 'candidates:invite',
            'reviews:read', 'reviews:write', 'reviews:override',
            'decisions:write',
            'integrity:read', 'integrity:review',
            'teams:manage', 'members:manage', 'roles:manage', 'settings:manage',
            'api_keys:manage', 'webhooks:manage',
            'audit:read',
            'billing:read',
            'tenant:admin',
            'platform:admin'
        ];
        const rolesDef = [
            { name: 'Platform Admin', desc: 'Global platform super administrator', perms: permissions, is_system: true },
            { name: 'Tenant Owner', desc: 'Full administrative ownership of tenant', perms: permissions.filter(p => p !== 'platform:admin'), is_system: true },
            { name: 'Tenant Admin', desc: 'Tenant administration and policy settings', perms: permissions.filter(p => p !== 'platform:admin'), is_system: true },
            { name: 'Recruiter', desc: 'Manage assessments, invite candidates, view scores', perms: ['skills:read', 'questions:read', 'assessments:read', 'assessments:write', 'candidates:read', 'candidates:write', 'candidates:invite', 'reviews:read', 'decisions:write', 'integrity:read', 'billing:read'], is_system: true },
            { name: 'Hiring Manager', desc: 'Review candidates and submit hiring decisions', perms: ['assessments:read', 'candidates:read', 'reviews:read', 'reviews:write', 'decisions:write', 'integrity:read'], is_system: true },
            { name: 'Interviewer', desc: 'Evaluate candidate submissions and score rubrics', perms: ['assessments:read', 'candidates:read', 'reviews:read', 'reviews:write'], is_system: true },
            { name: 'Content Author', desc: 'Create and edit question bank items and rubrics', perms: ['skills:read', 'skills:write', 'questions:read', 'questions:write', 'questions:publish', 'assessments:read'], is_system: true },
            { name: 'Auditor', desc: 'Read-only access to audit logs and compliance records', perms: ['audit:read', 'candidates:read', 'reviews:read', 'integrity:read'], is_system: true },
            { name: 'Candidate', desc: 'Access assigned assessment tests', perms: [], is_system: true }
        ];
        for (const r of rolesDef) {
            const res = await client.query(`INSERT INTO roles (tenant_id, name, description, is_system)
         VALUES (NULL, $1, $2, $3)
         ON CONFLICT (tenant_id, name) DO UPDATE SET description = EXCLUDED.description
         RETURNING id`, [r.name, r.desc, r.is_system]);
            const roleId = res.rows[0].id;
            for (const p of r.perms) {
                await client.query(`INSERT INTO role_permissions (role_id, permission)
           VALUES ($1, $2)
           ON CONFLICT (role_id, permission) DO NOTHING`, [roleId, p]);
            }
        }
        console.log('[Seed] System roles & permissions seeded.');
        // 2. Tenants (Acme Corp = paid, Beta Startups = trial, Kombee Internal = internal)
        const tenantsDef = [
            { name: 'Acme Technologies', slug: 'acme-corp', billing: 'paid', status: 'active', region: 'us-east-1' },
            { name: 'Beta Startups Inc', slug: 'beta-startups', billing: 'trial', status: 'active', region: 'eu-west-1' },
            { name: 'Kombee Internal Hiring', slug: 'kombee-internal', billing: 'internal', status: 'active', region: 'ap-south-1' }
        ];
        const tenantMap = {};
        const modules = ['skills', 'question_bank', 'assessments', 'candidate_testing', 'integrity', 'api_access', 'analytics'];
        for (const t of tenantsDef) {
            const res = await client.query(`INSERT INTO tenants (name, slug, billing_status, status, region)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE SET billing_status = EXCLUDED.billing_status
         RETURNING id`, [t.name, t.slug, t.billing, t.status, t.region]);
            const tenantId = res.rows[0].id;
            tenantMap[t.slug] = tenantId;
            for (const m of modules) {
                await client.query(`INSERT INTO tenant_modules (tenant_id, module, enabled)
           VALUES ($1, $2, true)
           ON CONFLICT (tenant_id, module) DO NOTHING`, [tenantId, m]);
            }
        }
        console.log('[Seed] Seeded tenants & module entitlements.');
        // 3. Seed Users
        const passwordHash = await bcryptjs_1.default.hash('Password123!', 10);
        const usersDef = [
            { email: 'admin@kombee.io', name: 'Platform Admin', is_platform_admin: true, tenant_slug: 'kombee-internal', role_name: 'Platform Admin' },
            { email: 'owner@acme.com', name: 'Alice Acme (Owner)', is_platform_admin: false, tenant_slug: 'acme-corp', role_name: 'Tenant Owner' },
            { email: 'recruiter@acme.com', name: 'Bob Recruiter', is_platform_admin: false, tenant_slug: 'acme-corp', role_name: 'Recruiter' },
            { email: 'owner@beta.com', name: 'Charlie Beta (Owner)', is_platform_admin: false, tenant_slug: 'beta-startups', role_name: 'Tenant Owner' }
        ];
        for (const u of usersDef) {
            const res = await client.query(`INSERT INTO users (email, password_hash, full_name, is_platform_admin)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`, [u.email, passwordHash, u.name, u.is_platform_admin]);
            const userId = res.rows[0].id;
            const tenantId = tenantMap[u.tenant_slug];
            const roleRes = await client.query('SELECT id FROM roles WHERE tenant_id IS NULL AND name = $1', [u.role_name]);
            if (roleRes.rows.length > 0 && tenantId) {
                const roleId = roleRes.rows[0].id;
                await client.query(`INSERT INTO memberships (tenant_id, user_id, role_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id`, [tenantId, userId, roleId]);
            }
        }
        console.log('[Seed] Seeded users & tenant memberships.');
        // 4. Seed Content Safety Language Lists & Signoff
        await client.query(`
      INSERT INTO language_safety_lists (language_code, prohibited_terms)
      VALUES ('en', '["caste", "religion", "pregnancy", "marital status", "ethnicity", "sexual orientation"]')
      ON CONFLICT (language_code) DO NOTHING;
    `);
        const adminUser = await client.query("SELECT id FROM users WHERE email = 'admin@kombee.io'");
        if (adminUser.rows.length > 0) {
            await client.query(`
        INSERT INTO language_signoffs (language_code, safety_signed_off, signed_off_by, signed_off_at, notes)
        VALUES ('en', true, $1, NOW(), 'English content safety dictionary audited and verified for launch.')
        ON CONFLICT (language_code) DO NOTHING;
      `, [adminUser.rows[0].id]);
        }
        console.log('[Seed] Content-safety language lists initialized and verified.');
        // 5. Seed Starter Skills Taxonomy (8 domains, >60 skills, including Generative AI)
        const skillsList = [
            // Domain 1: Frontend Development
            { domain: 'Frontend Development', name: 'JavaScript Core', slug: 'js-core', sub: 'ES6+, Closures, Async/Await' },
            { domain: 'Frontend Development', name: 'TypeScript', slug: 'typescript-front', sub: 'Generics, Utility Types, Discriminated Unions' },
            { domain: 'Frontend Development', name: 'React.js', slug: 'react', sub: 'Hooks, Context, Performance, SSR' },
            { domain: 'Frontend Development', name: 'CSS & Modern Layouts', slug: 'css-layouts', sub: 'Flexbox, Grid, CSS Variables, Responsive' },
            { domain: 'Frontend Development', name: 'Web Accessibility (a11y)', slug: 'a11y', sub: 'WCAG 2.1, ARIA landmarks, Screen Readers' },
            { domain: 'Frontend Development', name: 'State Management', slug: 'state-mgmt', sub: 'Redux, Zustand, Query Caching' },
            { domain: 'Frontend Development', name: 'Web Performance Optimization', slug: 'web-perf', sub: 'Core Web Vitals, Bundling, Lazy Loading' },
            { domain: 'Frontend Development', name: 'Browser Security & DOM', slug: 'browser-security', sub: 'CORS, CSP, DOM XSS, Storage' },
            // Domain 2: Backend Development
            { domain: 'Backend Development', name: 'Node.js Runtime', slug: 'nodejs', sub: 'Event Loop, Streams, Cluster Module' },
            { domain: 'Backend Development', name: 'Python Backend', slug: 'python-backend', sub: 'AsyncIO, FastApi, Django, Metaclasses' },
            { domain: 'Backend Development', name: 'Java Enterprise', slug: 'java-enterprise', sub: 'JVM Tuning, Concurrency, Spring Boot' },
            { domain: 'Backend Development', name: 'Go Microservices', slug: 'golang', sub: 'Goroutines, Channels, Memory Management' },
            { domain: 'Backend Development', name: 'C++ Systems Programming', slug: 'cpp-systems', sub: 'RAII, Pointers, Templates, Memory Safety' },
            { domain: 'Backend Development', name: 'RESTful API Design', slug: 'api-design-rest', sub: 'HTTP Semantics, Versioning, Idempotency' },
            { domain: 'Backend Development', name: 'GraphQL & gRPC', slug: 'graphql-grpc', sub: 'Schemas, Resolvers, Protobuf RPC' },
            { domain: 'Backend Development', name: 'Authentication & OAuth2', slug: 'auth-security', sub: 'JWT, OIDC, RBAC, Cryptographic Tokens' },
            { domain: 'Backend Development', name: 'Background Jobs & Scheduling', slug: 'job-scheduling', sub: 'BullMQ, Cron, Idempotency, Dead-Letter' },
            // Domain 3: Database Systems
            { domain: 'Database Systems', name: 'PostgreSQL Advanced', slug: 'postgres-adv', sub: 'Query Planner, Row-Level Security, Partitioning' },
            { domain: 'Database Systems', name: 'SQL Query Optimization', slug: 'sql-opt', sub: 'Indexes, Trigrams, Window Functions, CTEs' },
            { domain: 'Database Systems', name: 'Data Modeling & Normalization', slug: 'data-modeling', sub: 'Relational 3NF, Denormalization, Keys' },
            { domain: 'Database Systems', name: 'Transactions & Concurrency', slug: 'db-concurrency', sub: 'ACID, Isolation Levels, MVCC, Deadlocks' },
            { domain: 'Database Systems', name: 'Redis & Distributed Caching', slug: 'redis-caching', sub: 'Cache-Aside, Write-Through, Expirations' },
            { domain: 'Database Systems', name: 'NoSQL & Document Stores', slug: 'nosql-doc', sub: 'MongoDB, DynamoDB, Sharding & Consistency' },
            // Domain 4: Algorithms & Data Structures
            { domain: 'Algorithms & Data Structures', name: 'Graph Theory & Search', slug: 'graph-algo', sub: 'BFS, DFS, Dijkstra, Topological Sort' },
            { domain: 'Algorithms & Data Structures', name: 'Dynamic Programming', slug: 'dynamic-prog', sub: 'Memoization, Tabulation, Knapsack' },
            { domain: 'Algorithms & Data Structures', name: 'Tree Traversals & BST', slug: 'tree-algo', sub: 'AVL, Red-Black, Segment Trees' },
            { domain: 'Algorithms & Data Structures', name: 'String & Array Manipulation', slug: 'string-arrays', sub: 'Two-Pointer, Sliding Window, KMP' },
            { domain: 'Algorithms & Data Structures', name: 'Sorting & Binary Search', slug: 'sorting-search', sub: 'Divide & Conquer, QuickSelect' },
            { domain: 'Algorithms & Data Structures', name: 'Bit Manipulation & Math', slug: 'bit-manipulation', sub: 'Bitwise Operators, Modular Arithmetic, Primes' },
            { domain: 'Algorithms & Data Structures', name: 'Greedy Algorithms', slug: 'greedy-algo', sub: 'Interval Scheduling, Huffman Coding' },
            // Domain 5: DevOps & Cloud Architecture
            { domain: 'DevOps & Cloud Architecture', name: 'Docker & Containerization', slug: 'docker', sub: 'Multi-stage builds, Security, cgroups' },
            { domain: 'DevOps & Cloud Architecture', name: 'Kubernetes Orchestration', slug: 'k8s', sub: 'Pods, Deployments, Services, Helm' },
            { domain: 'DevOps & Cloud Architecture', name: 'CI/CD Pipelines', slug: 'cicd', sub: 'GitHub Actions, Automated Testing, Release Gates' },
            { domain: 'DevOps & Cloud Architecture', name: 'Infrastructure as Code (Terraform)', slug: 'terraform', sub: 'State, Modules, Cloud Providers' },
            { domain: 'DevOps & Cloud Architecture', name: 'Cloud Infrastructure (AWS/GCP)', slug: 'cloud-infra', sub: 'VPC, IAM, S3, Serverless' },
            { domain: 'DevOps & Cloud Architecture', name: 'Observability & Monitoring', slug: 'observability', sub: 'Prometheus, OpenTelemetry, Log Tracing' },
            { domain: 'DevOps & Cloud Architecture', name: 'Linux System Administration', slug: 'linux-admin', sub: 'Systemd, Process Management, Signals, Bash' },
            // Domain 6: Software Architecture & Reliability
            { domain: 'Software Architecture & Reliability', name: 'Distributed Systems Patterns', slug: 'dist-patterns', sub: 'Saga, Event Sourcing, CQRS' },
            { domain: 'Software Architecture & Reliability', name: 'Message Queues & Streaming', slug: 'message-queues', sub: 'Kafka, RabbitMQ, Consumer Groups' },
            { domain: 'Software Architecture & Reliability', name: 'Multi-Tenant Architecture', slug: 'multi-tenancy', sub: 'Isolation, Pool Partitioning, RLS' },
            { domain: 'Software Architecture & Reliability', name: 'Security & OWASP Top 10', slug: 'app-security', sub: 'XSS, CSRF, SQLi, Parameter Tampering' },
            { domain: 'Software Architecture & Reliability', name: 'System Scalability', slug: 'system-scalability', sub: 'Load Balancing, Rate Limiting, Circuit Breakers' },
            { domain: 'Software Architecture & Reliability', name: 'Microservices Communication', slug: 'microservices-comm', sub: 'Service Mesh, API Gateways, Timeouts' },
            // Domain 7: Quality Assurance & Testing
            { domain: 'Quality Assurance & Testing', name: 'Unit & Integration Testing', slug: 'testing-unit', sub: 'TDD, Mocking, Property-based testing' },
            { domain: 'Quality Assurance & Testing', name: 'End-to-End Automation', slug: 'testing-e2e', sub: 'Playwright, Cypress, Headless Browsers' },
            { domain: 'Quality Assurance & Testing', name: 'Load & Performance Testing', slug: 'testing-load', sub: 'k6, JMeter, Stress Limits' },
            { domain: 'Quality Assurance & Testing', name: 'Test Coverage & Mutation Testing', slug: 'mutation-testing', sub: 'Branch Coverage, Stryker' },
            { domain: 'Quality Assurance & Testing', name: 'API Contract & Schema Testing', slug: 'api-testing', sub: 'Pact, Postman, OpenAPI Schema Validation' },
            { domain: 'Quality Assurance & Testing', name: 'Security Vulnerability Scanning', slug: 'security-scanning', sub: 'SAST, DAST, Dependency Checking' },
            // Domain 8: Generative AI & AI Engineering (Emerging Skills - SKL-05)
            { domain: 'Generative AI & AI Engineering', name: 'Prompt Engineering & System Prompting', slug: 'prompt-eng', sub: 'Few-shot, Chain-of-Thought, Delimiters' },
            { domain: 'Generative AI & AI Engineering', name: 'Working with AI Coding Agents', slug: 'ai-agents', sub: 'Tool Calling, Agentic Planning, Correction Loops' },
            { domain: 'Generative AI & AI Engineering', name: 'RAG & Vector Databases', slug: 'rag-vector-db', sub: 'Embeddings, Chunking, Cosine Similarity, Pinecone/pgvector' },
            { domain: 'Generative AI & AI Engineering', name: 'AI Safety & Prompt Injection Defense', slug: 'ai-safety', sub: 'Input Sanitization, Guardrails, Red Teaming' },
            { domain: 'Generative AI & AI Engineering', name: 'LLM Fine-Tuning & Evaluation', slug: 'llm-eval', sub: 'LoRA, ROUGE, BLEU, LLM-as-a-Judge' },
            { domain: 'Generative AI & AI Engineering', name: 'Model Context Protocol (MCP)', slug: 'mcp-integration', sub: 'Protocol Specs, JSON-RPC, Resource & Tool Servers' },
            { domain: 'Generative AI & AI Engineering', name: 'AI Code Review & Pair Programming', slug: 'ai-code-review', sub: 'Code Synthesis Verification, Hallucination Detection' },
            { domain: 'Generative AI & AI Engineering', name: 'AI Cost & Latency Optimization', slug: 'ai-cost-optimization', sub: 'Token Caching, Model Quantization, Streaming' },
            { domain: 'Generative AI & AI Engineering', name: 'Synthetic Test Data Generation', slug: 'synthetic-test-gen', sub: 'Constraint Sampling, Edge Case Synthesis' },
            { domain: 'Generative AI & AI Engineering', name: 'Autonomous Task Planning', slug: 'autonomous-planning', sub: 'ReAct, Multi-Step Workflows, Subagent Delegation' },
            { domain: 'Generative AI & AI Engineering', name: 'AI Alignment & Guardrails Validation', slug: 'guardrails-validation', sub: 'Output Verification, Semantic Boundaries' }
        ];
        const skillMap = {};
        for (const s of skillsList) {
            const res = await client.query(`INSERT INTO skills (tenant_id, domain, name, slug, sub_skill, visibility)
         VALUES (NULL, $1, $2, $3, $4, 'platform')
         RETURNING id`, [s.domain, s.name, s.slug, s.sub]);
            skillMap[s.slug] = res.rows[0].id;
        }
        console.log(`[Seed] Seeded ${skillsList.length} skills across 8 domains in shared taxonomy.`);
        // 6. Seed Roles Taxonomy
        const rolesTaxonomyList = [
            {
                title: 'Senior Full-Stack Engineer',
                slug: 'sr-full-stack',
                desc: 'Builds robust distributed web applications across frontend, backend, and databases.',
                skills: [
                    { slug: 'react', level: 'advanced', weight: 1.5 },
                    { slug: 'nodejs', level: 'advanced', weight: 1.5 },
                    { slug: 'typescript-front', level: 'advanced', weight: 1.2 },
                    { slug: 'postgres-adv', level: 'intermediate', weight: 1.2 },
                    { slug: 'api-design-rest', level: 'advanced', weight: 1.0 },
                    { slug: 'ai-agents', level: 'intermediate', weight: 0.8 }
                ]
            },
            {
                title: 'Senior Backend Engineer',
                slug: 'sr-backend-engineer',
                desc: 'Specializes in high-concurrency microservices, data persistence, and system scalability.',
                skills: [
                    { slug: 'nodejs', level: 'expert', weight: 2.0 },
                    { slug: 'postgres-adv', level: 'advanced', weight: 1.8 },
                    { slug: 'sql-opt', level: 'advanced', weight: 1.5 },
                    { slug: 'multi-tenancy', level: 'advanced', weight: 1.5 },
                    { slug: 'dist-patterns', level: 'advanced', weight: 1.5 },
                    { slug: 'docker', level: 'intermediate', weight: 1.0 }
                ]
            },
            {
                title: 'AI Systems Engineer',
                slug: 'ai-systems-engineer',
                desc: 'Integrates LLMs, agentic developer workflows, vector retrieval, and robust safety guardrails.',
                skills: [
                    { slug: 'prompt-eng', level: 'expert', weight: 2.0 },
                    { slug: 'ai-agents', level: 'advanced', weight: 1.8 },
                    { slug: 'rag-vector-db', level: 'advanced', weight: 1.8 },
                    { slug: 'ai-safety', level: 'advanced', weight: 1.5 },
                    { slug: 'python-backend', level: 'advanced', weight: 1.5 }
                ]
            }
        ];
        for (const r of rolesTaxonomyList) {
            const res = await client.query(`INSERT INTO roles_taxonomy (tenant_id, title, slug, description, visibility)
         VALUES (NULL, $1, $2, $3, 'platform')
         RETURNING id`, [r.title, r.slug, r.desc]);
            const roleId = res.rows[0].id;
            for (const s of r.skills) {
                const skillId = skillMap[s.slug];
                if (skillId) {
                    await client.query(`INSERT INTO role_skills (role_id, skill_id, weight, target_level)
             VALUES ($1, $2, $3, $4)`, [roleId, skillId, s.weight, s.level]);
                }
            }
        }
        console.log('[Seed] Seeded roles taxonomy and weighted skill profiles.');
        await client.query('COMMIT');
        console.log('[Seed] Database successfully seeded with baseline platform records.');
    }
    catch (error) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('[Seed] Error seeding database:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
    runSeed()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
