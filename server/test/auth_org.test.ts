import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { superuserPool, appPool } from '../src/db/pool.js';

describe('Kombee Assess - Auth, Roles, Orgs, API Keys & Admin Suite', () => {
  let adminToken: string;
  let ownerToken: string;
  let recruiterToken: string;
  let acmeTenantId: string;
  let betaTenantId: string;

  beforeAll(async () => {
    // Lookup seeded tenant IDs
    const { rows: tRows } = await superuserPool.query("SELECT id, slug FROM tenants WHERE slug IN ('acme-corp', 'beta-startups')");
    for (const r of tRows) {
      if (r.slug === 'acme-corp') acmeTenantId = r.id;
      if (r.slug === 'beta-startups') betaTenantId = r.id;
    }

    // Login Platform Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@kombee.io', password: 'Password123!' });
    adminToken = adminRes.body.token;

    // Login Acme Owner
    const ownerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });
    ownerToken = ownerRes.body.token;

    // Login Acme Recruiter
    const recruiterRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'recruiter@acme.com', password: 'Password123!' });
    recruiterToken = recruiterRes.body.token;
  });

  afterAll(async () => {
    await appPool.end();
    await superuserPool.end();
  });

  // 1. Authentication & Session
  it('1. User login returns JWT, sets httpOnly cookie, and authenticates /me', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('owner@acme.com');
    expect(res.headers['set-cookie']).toBeDefined();

    // Verify /api/v1/auth/me
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.role).toBe('Tenant Owner');
  });

  it('2. Invalid login rejected, and lockouts trigger after repeated failures', async () => {
    const email = `lockout_test_${Date.now()}@test.com`;
    // Create test user
    const bcrypt = (await import('bcryptjs')).default;
    const hash = await bcrypt.hash('CorrectPass123!', 10);
    await superuserPool.query(
      `INSERT INTO users (email, password_hash, full_name, status) VALUES ($1, $2, 'Lockout Tester', 'active')`,
      [email, hash]
    );

    // Fail 5 times
    for (let i = 0; i < 5; i++) {
      const failRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword!' });
      expect(failRes.status).toBe(401);
    }

    // 6th attempt must trigger account lockout
    const lockRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'CorrectPass123!' });
    expect(lockRes.status).toBe(401);
    expect(lockRes.body.error.message).toMatch(/temporarily locked/i);
  });

  // 2. Roles, Permissions & Custom Roles
  it('3. Recruiter cannot create roles, but Tenant Owner can create custom roles', async () => {
    // Recruiter attempts to create role -> 403 Forbidden
    const deniedRes = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        name: 'Unauthorized Role',
        permissions: ['skills:read']
      });
    expect(deniedRes.status).toBe(403);
    expect(deniedRes.body.error.code).toBe('FORBIDDEN_PERMISSION');

    // Tenant Owner creates custom role 'Technical Sourcer'
    const createRes = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Technical Sourcer ${Date.now()}`,
        description: 'Custom sourcing role',
        permissions: ['candidates:read', 'candidates:invite']
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.permissions).toContain('candidates:invite');
  });

  // 3. Teams Scoping
  it('4. Tenant can create, list, and manage scoped business units / teams', async () => {
    const teamName = `Frontend Squad ${Date.now()}`;
    const createRes = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: teamName, description: 'Core web frontend' });
    expect(createRes.status).toBe(201);
    const teamId = createRes.body.data.id;

    const listRes = await request(app)
      .get('/api/v1/teams')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((t: any) => t.id === teamId)).toBe(true);
  });

  // 4. API Keys (Sandbox and Production)
  it('5. Tenant can generate scoped API keys, authenticate with them, and revoke them', async () => {
    // 1. Generate Sandbox Key
    const keyRes = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'CI Pipeline Key',
        environment: 'sandbox',
        scopes: ['assessments:read', 'skills:read']
      });
    expect(keyRes.status).toBe(201);
    const fullApiKey = keyRes.body.data.apiKey;
    const apiKeyId = keyRes.body.data.id;
    expect(fullApiKey.startsWith('kba_test_')).toBe(true);

    // 2. Use the API Key to access /api/v1/assessments
    const authKeyRes = await request(app)
      .get('/api/v1/assessments')
      .set('Authorization', `Bearer ${fullApiKey}`);
    expect(authKeyRes.status).toBe(200);

    // 3. Revoke the API Key
    const revokeRes = await request(app)
      .delete(`/api/v1/api-keys/${apiKeyId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revokeRes.status).toBe(200);

    // 4. Using revoked key must fail with 401
    const revokedUseRes = await request(app)
      .get('/api/v1/assessments')
      .set('Authorization', `Bearer ${fullApiKey}`);
    expect(revokedUseRes.status).toBe(401);
  });

  // 5. Support Access Grants
  it('6. Tenant can issue time-limited support grant and revoke it', async () => {
    const grantRes = await request(app)
      .post('/api/v1/support-grants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        grantedToEmail: 'admin@kombee.io',
        durationHours: 12,
        reason: 'Investigate integration webhook failure'
      });
    expect(grantRes.status).toBe(201);
    const grantId = grantRes.body.data.id;

    // List grants
    const listRes = await request(app)
      .get('/api/v1/support-grants')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((g: any) => g.id === grantId)).toBe(true);

    // Revoke grant
    const revokeRes = await request(app)
      .delete(`/api/v1/support-grants/${grantId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revokeRes.status).toBe(200);
  });

  // 6. Platform Admin APIs & Tenant Lifecycle
  it('7. Non-platform users cannot access Platform Admin APIs, while Platform Admin can manage lifecycle', async () => {
    // Non-admin rejected
    const forbiddenRes = await request(app)
      .get('/api/v1/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe('FORBIDDEN_PLATFORM_ADMIN');

    // Platform Admin lists tenants
    const listRes = await request(app)
      .get('/api/v1/admin/tenants')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    // Platform Admin updates billing status
    const billingRes = await request(app)
      .patch(`/api/v1/admin/tenants/${acmeTenantId}/billing`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ billingStatus: 'paid' });
    expect(billingRes.status).toBe(200);
    expect(billingRes.body.data.billing_status).toBe('paid');

    // Platform Admin data export for tenant
    const exportRes = await request(app)
      .get(`/api/v1/admin/tenants/${acmeTenantId}/export`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.data.assessments).toBeDefined();
  });
});
