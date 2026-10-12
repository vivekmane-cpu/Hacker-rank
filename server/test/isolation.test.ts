import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../src/index.js';
import { appPool, superuserPool } from '../src/db/pool.js';
import { verifyRlsCoverage } from '../src/scripts/verify-rls.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-minimum-32-chars-long-kombee-assess';

describe('Kombee Assess - Multi-Tenant Isolation & Security Suite', () => {
  let tenantAId: string;
  let tenantBId: string;
  let tokenA: string;
  let tokenB: string;
  let apiKeyA: string;
  let apiKeyB: string;

  beforeAll(async () => {
    // 1. Create two isolated test tenants
    const resA = await superuserPool.query(
      `INSERT INTO tenants (name, slug, billing_status, status)
       VALUES ('Tenant Alpha', 'tenant-alpha-${Date.now()}', 'paid', 'active')
       RETURNING id`
    );
    tenantAId = resA.rows[0].id;

    const resB = await superuserPool.query(
      `INSERT INTO tenants (name, slug, billing_status, status)
       VALUES ('Tenant Beta', 'tenant-beta-${Date.now()}', 'trial', 'active')
       RETURNING id`
    );
    tenantBId = resB.rows[0].id;

    // Enable modules for tenant A, but disable 'assessments' for tenant B to test entitlements
    const modules = ['skills', 'question_bank', 'candidate_testing', 'integrity', 'api_access', 'analytics'];
    for (const m of [...modules, 'assessments']) {
      await superuserPool.query(
        `INSERT INTO tenant_modules (tenant_id, module, enabled) VALUES ($1, $2, true)`,
        [tenantAId, m]
      );
    }
    for (const m of modules) {
      await superuserPool.query(
        `INSERT INTO tenant_modules (tenant_id, module, enabled) VALUES ($1, $2, true)`,
        [tenantBId, m]
      );
    }
    // Explicitly disable assessments on Tenant B
    await superuserPool.query(
      `INSERT INTO tenant_modules (tenant_id, module, enabled) VALUES ($1, 'assessments', false)`,
      [tenantBId]
    );

    // Create API Keys for A and B
    const rawKeyA = `kba_live_${crypto.randomBytes(24).toString('hex')}`;
    const hashA = crypto.createHash('sha256').update(rawKeyA).digest('hex');
    await superuserPool.query(
      `INSERT INTO api_keys (tenant_id, name, key_prefix, key_hash, scopes, environment)
       VALUES ($1, 'Key A', 'kba_live', $2, '["assessments:read"]', 'production')`,
      [tenantAId, hashA]
    );
    apiKeyA = rawKeyA;

    const rawKeyB = `kba_live_${crypto.randomBytes(24).toString('hex')}`;
    const hashB = crypto.createHash('sha256').update(rawKeyB).digest('hex');
    await superuserPool.query(
      `INSERT INTO api_keys (tenant_id, name, key_prefix, key_hash, scopes, environment)
       VALUES ($1, 'Key B', 'kba_live', $2, '["assessments:read"]', 'production')`,
      [tenantBId, hashB]
    );
    apiKeyB = rawKeyB;

    // Create session JWTs
    tokenA = jwt.sign(
      { tenantId: tenantAId, userId: '00000000-0000-0000-0000-00000000000a', role: 'Tenant Admin' },
      JWT_SECRET
    );
    tokenB = jwt.sign(
      { tenantId: tenantBId, userId: '00000000-0000-0000-0000-00000000000b', role: 'Tenant Admin' },
      JWT_SECRET
    );
  });

  afterAll(async () => {
    // Tenants are marked status = 'deleted' in accordance with tenant lifecycle rules (audit_log is append-only)
    if (tenantAId) await superuserPool.query("UPDATE tenants SET status = 'deleted' WHERE id = $1", [tenantAId]);
    if (tenantBId) await superuserPool.query("UPDATE tenants SET status = 'deleted' WHERE id = $1", [tenantBId]);
    await appPool.end();
    await superuserPool.end();
  });

  // TEST 1: Role Bypass Check
  it('1. App DB role must have rolbypassrls = false and rolsuper = false', async () => {
    const { rows } = await superuserPool.query(
      `SELECT rolname, rolsuper, rolbypassrls
       FROM pg_roles WHERE rolname = 'kombee_app'`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].rolsuper).toBe(false);
    expect(rows[0].rolbypassrls).toBe(false);
  });

  // TEST 2: RLS Coverage Verification
  it('2. Every table with a tenant_id column must have RLS enabled, forced, and active policies', async () => {
    const passed = await verifyRlsCoverage();
    expect(passed).toBe(true);
  });

  // TEST 3: Connection Reuse Safety (The Single Most Important Control)
  it('3. Two tenants served back-to-back over the exact same physical DB connection must never see cross data', async () => {
    const client = await appPool.connect();
    try {
      // Record Postgres backend PID for this physical connection
      const pidRes = await client.query('SELECT pg_backend_pid() AS pid');
      const pid = pidRes.rows[0].pid;

      // Seed an assessment for Tenant A inside transaction with tenant A context
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantAId]);
      await client.query(
        `INSERT INTO assessments (tenant_id, title, slug) VALUES ($1, 'Assessment Alpha', 'alpha-test')`,
        [tenantAId]
      );
      const resA = await client.query('SELECT id, title FROM assessments');
      expect(resA.rows.length).toBe(1);
      expect(resA.rows[0].title).toBe('Assessment Alpha');
      await client.query('COMMIT');

      // Now verify that outside the transaction, tenant_id setting is completely empty/null
      const settingCheck = await client.query("SELECT current_setting('app.tenant_id', true) AS current_tenant");
      expect(settingCheck.rows[0].current_tenant).toBeFalsy();

      // Now reuse the EXACT SAME physical connection for Tenant B
      const pidRes2 = await client.query('SELECT pg_backend_pid() AS pid');
      expect(pidRes2.rows[0].pid).toBe(pid); // Confirms same physical connection!

      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantBId]);

      // Tenant B queries assessments: MUST RETURN 0 rows (Tenant A data must not leak)
      const resB = await client.query('SELECT id, title FROM assessments');
      expect(resB.rows.length).toBe(0);

      // Attempting to insert with Tenant A's id while in Tenant B's context must be rejected by RLS WITH CHECK
      await expect(
        client.query(
          `INSERT INTO assessments (tenant_id, title, slug) VALUES ($1, 'Illegal Injection', 'leak-slug')`,
          [tenantAId]
        )
      ).rejects.toThrow();

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  // TEST 4: Zero Cross-Reads across all core tenant tables
  it('4. Data inserted for Tenant A is strictly invisible to Tenant B under RLS', async () => {
    const client = await appPool.connect();
    try {
      // 1. Insert records under Tenant A context
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantAId]);

      await client.query(`INSERT INTO teams (tenant_id, name) VALUES ($1, 'Engineering Alpha')`, [tenantAId]);
      await client.query(`INSERT INTO audit_log (tenant_id, actor_id, actor_type, action, entity_type, entity_id) VALUES ($1, gen_random_uuid(), 'user', 'test', 'team', gen_random_uuid())`, [tenantAId]);
      await client.query(`INSERT INTO webhook_endpoints (tenant_id, url, secret_hash) VALUES ($1, 'https://alpha.com/webhook', 'hash123')`, [tenantAId]);

      await client.query('COMMIT');

      // 2. Query under Tenant B context
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantBId]);

      const teams = await client.query('SELECT * FROM teams');
      expect(teams.rows.length).toBe(0);

      const audits = await client.query('SELECT * FROM audit_log');
      expect(audits.rows.length).toBe(0);

      const webhooks = await client.query('SELECT * FROM webhook_endpoints');
      expect(webhooks.rows.length).toBe(0);

      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  // TEST 5: Concurrency - 200 Interleaved Requests over a Pool of 2 Connections
  it('5. 200 interleaved concurrent requests over 2 pooled connections must produce zero cross-reads', async () => {
    const restrictedPool = new (await import('pg')).default.Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://kombee_app:kombee_secure_pass@localhost:5432/kombee_assess',
      max: 2 // Intentionally constrained to 2 connections to force high contention & reuse
    });

    try {
      const tasks = Array.from({ length: 200 }, (_, i) => {
        const isTenantA = i % 2 === 0;
        const targetTenant = isTenantA ? tenantAId : tenantBId;

        return (async () => {
          const client = await restrictedPool.connect();
          try {
            await client.query('BEGIN');
            await client.query("SELECT set_config('app.tenant_id', $1, true)", [targetTenant]);

            const res = await client.query('SELECT tenant_id FROM assessments');
            // If rows returned, every single row MUST match targetTenant
            for (const row of res.rows) {
              if (row.tenant_id !== targetTenant) {
                throw new Error(`CRITICAL ISOLATION BREACH: Connection saw tenant ${row.tenant_id} while in context ${targetTenant}`);
              }
            }

            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
          } finally {
            client.release();
          }
        })();
      });

      await Promise.all(tasks);
    } finally {
      await restrictedPool.end();
    }
  });

  // TEST 6: Fail Closed Policy & Anti-Spoofing
  it('6. Request without tenant context must fail closed (HTTP 401), and forged X-Tenant-Id header is ignored', async () => {
    // Request without any credentials
    const unauthRes = await request(app).get('/api/v1/assessments');
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error.code).toBe('UNAUTHORIZED_TENANT');

    // Attempting to spoof tenant using X-Tenant-Id header must be completely ignored and fail closed
    const spoofRes = await request(app)
      .get('/api/v1/assessments')
      .set('X-Tenant-Id', tenantAId);
    expect(spoofRes.status).toBe(401);
    expect(spoofRes.body.error.code).toBe('UNAUTHORIZED_TENANT');

    // Exempt route /api/v1/health should succeed with 200
    const healthRes = await request(app).get('/api/v1/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('healthy');
  });

  // TEST 7: Per-Tenant Module Entitlement Enforcement (UI & API Key)
  it('7. Tenant without module entitlement receives HTTP 403 on both session and API key', async () => {
    // Tenant A is entitled to assessments -> returns 200
    const resA = await request(app)
      .get('/api/v1/assessments')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resA.status).toBe(200);

    // Tenant B has assessments module disabled -> returns 403
    const resB = await request(app)
      .get('/api/v1/assessments')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resB.status).toBe(403);
    expect(resB.body.error.code).toBe('MODULE_NOT_ENTITLED');

    // Tenant A via API Key -> returns 200
    const apiKeyResA = await request(app)
      .get('/api/v1/assessments')
      .set('Authorization', `Bearer ${apiKeyA}`);
    expect(apiKeyResA.status).toBe(200);

    // Tenant B via API Key -> returns 403
    const apiKeyResB = await request(app)
      .get('/api/v1/assessments')
      .set('Authorization', `Bearer ${apiKeyB}`);
    expect(apiKeyResB.status).toBe(403);
    expect(apiKeyResB.body.error.code).toBe('MODULE_NOT_ENTITLED');
  });

  // TEST 8: Immutability & Append-Only Triggers
  it('8. Database triggers enforce append-only logs and published version immutability', async () => {
    // 1. Audit log append-only check
    const client = await superuserPool.connect();
    try {
      const insRes = await client.query(
        `INSERT INTO audit_log (tenant_id, actor_id, actor_type, action, entity_type, entity_id)
         VALUES ($1, gen_random_uuid(), 'user', 'insert_test', 'test', gen_random_uuid())
         RETURNING id`,
        [tenantAId]
      );
      const auditId = insRes.rows[0].id;

      // UPDATE on audit_log must be rejected
      await expect(
        client.query(`UPDATE audit_log SET action = 'tampered' WHERE id = $1`, [auditId])
      ).rejects.toThrow(/strictly append-only/i);

      // DELETE on audit_log must be rejected
      await expect(
        client.query(`DELETE FROM audit_log WHERE id = $1`, [auditId])
      ).rejects.toThrow(/strictly append-only/i);

      // 2. Published assessment immutability check
      const qRes = await client.query(
        `INSERT INTO questions (tenant_id, type) VALUES ($1, 'multiple_choice') RETURNING id`,
        [tenantAId]
      );
      const questionId = qRes.rows[0].id;

      const vRes = await client.query(
        `INSERT INTO question_versions (question_id, version, title, description, content, difficulty, status)
         VALUES ($1, 1, 'Sample Q', 'Desc', '{"options":[]}', 'medium', 'published')
         RETURNING id`,
        [questionId]
      );
      const versionId = vRes.rows[0].id;

      // UPDATE on published version must be rejected
      await expect(
        client.query(`UPDATE question_versions SET title = 'Altered Title' WHERE id = $1`, [versionId])
      ).rejects.toThrow(/Published version .* is immutable/i);

    } finally {
      client.release();
    }
  });
});
