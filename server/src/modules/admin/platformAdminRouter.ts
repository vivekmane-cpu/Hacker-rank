import { Router } from 'express';
import { getTenantContext } from '../../context/tenantContext.js';
import { superuserPool } from '../../db/pool.js';

export const platformAdminRouter = Router();

// Middleware: restrict to Platform Admins
platformAdminRouter.use((_req, res, next) => {
  const ctx = getTenantContext();
  if (!ctx || (!ctx.isPlatformAdmin && ctx.role !== 'Platform Admin')) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN_PLATFORM_ADMIN', message: 'Platform Administrator privileges required.' }
    });
  }
  next();
});

// List all tenants across the platform
platformAdminRouter.get('/tenants', async (_req, res) => {
  try {
    const { rows } = await superuserPool.query(`
      SELECT t.id, t.name, t.slug, t.billing_status, t.status, t.region, t.branding,
             t.suspended_at, t.offboard_at, t.created_at,
             COUNT(DISTINCT m.user_id)::int as user_count,
             COUNT(DISTINCT a.id)::int as assessment_count
      FROM tenants t
      LEFT JOIN memberships m ON m.tenant_id = t.id
      LEFT JOIN assessments a ON a.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    res.json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

// Create new tenant organization
platformAdminRouter.post('/tenants', async (req, res) => {
  const { name, slug, billingStatus, region, modules } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Name and slug are required.' } });
  }

  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');
    const { rows: tRows } = await client.query(
      `INSERT INTO tenants (name, slug, billing_status, region, status)
       VALUES ($1, $2, COALESCE($3, 'trial'), COALESCE($4, 'us-east-1'), 'active')
       RETURNING id, name, slug, billing_status, region, status, created_at`,
      [name, slug.toLowerCase().trim(), billingStatus, region]
    );
    const newTenant = tRows[0];

    const defaultModules = ['skills', 'question_bank', 'assessments', 'candidate_testing', 'integrity', 'api_access', 'analytics'];
    const activeModules = Array.isArray(modules) ? modules : defaultModules;

    for (const m of defaultModules) {
      await client.query(
        `INSERT INTO tenant_modules (tenant_id, module, enabled)
         VALUES ($1, $2, $3)`,
        [newTenant.id, m, activeModules.includes(m)]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ data: newTenant });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: { code: 'CREATE_TENANT_ERROR', message: err.message } });
  } finally {
    client.release();
  }
});

// Update tenant lifecycle status (active, suspended, offboarding, deleted)
platformAdminRouter.patch('/tenants/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['active', 'suspended', 'offboarding', 'deleted'];
  if (!status || !valid.includes(status)) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `Status must be one of: ${valid.join(', ')}` } });
  }

  try {
    const suspendedAt = status === 'suspended' ? 'NOW()' : 'NULL';
    const offboardAt = status === 'offboarding' ? 'NOW()' : 'NULL';

    const { rows } = await superuserPool.query(
      `UPDATE tenants
       SET status = $1,
           suspended_at = CASE WHEN $1 = 'suspended' THEN NOW() ELSE suspended_at END,
           offboard_at = CASE WHEN $1 = 'offboarding' THEN NOW() ELSE offboard_at END
       WHERE id = $2
       RETURNING id, name, slug, status, billing_status, suspended_at, offboard_at`,
      [status, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant not found.' } });
    }

    res.json({ data: rows[0], message: `Tenant status updated to ${status}.` });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
  }
});

// Update billing status (paid, trial, internal - strictly uniform across tenants)
platformAdminRouter.patch('/tenants/:id/billing', async (req, res) => {
  const { billingStatus } = req.body;
  const valid = ['paid', 'trial', 'internal'];
  if (!billingStatus || !valid.includes(billingStatus)) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `billingStatus must be one of: ${valid.join(', ')}` } });
  }

  try {
    const { rows } = await superuserPool.query(
      `UPDATE tenants SET billing_status = $1 WHERE id = $2 RETURNING id, name, slug, billing_status`,
      [billingStatus, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant not found.' } });
    }
    res.json({ data: rows[0], message: `Billing status updated to ${billingStatus}.` });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
  }
});

// Manage module entitlements per tenant
platformAdminRouter.get('/tenants/:id/modules', async (req, res) => {
  try {
    const { rows } = await superuserPool.query(
      'SELECT module, enabled FROM tenant_modules WHERE tenant_id = $1 ORDER BY module',
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

platformAdminRouter.put('/tenants/:id/modules', async (req, res) => {
  const { modules } = req.body; // e.g. { skills: true, assessments: false }
  if (typeof modules !== 'object') {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'modules object is required.' } });
  }

  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');
    for (const [mod, enabled] of Object.entries(modules)) {
      await client.query(
        `INSERT INTO tenant_modules (tenant_id, module, enabled)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, module) DO UPDATE SET enabled = EXCLUDED.enabled`,
        [req.params.id, mod, !!enabled]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Module entitlements updated successfully.' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
  } finally {
    client.release();
  }
});

// Full data export for tenant offboarding / compliance
platformAdminRouter.get('/tenants/:id/export', async (req, res) => {
  const tenantId = req.params.id;
  try {
    const tenantRes = await superuserPool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (tenantRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant not found.' } });
    }

    const assessmentsRes = await superuserPool.query('SELECT * FROM assessments WHERE tenant_id = $1', [tenantId]);
    const candidatesRes = await superuserPool.query('SELECT * FROM candidates WHERE tenant_id = $1', [tenantId]);
    const teamsRes = await superuserPool.query('SELECT * FROM teams WHERE tenant_id = $1', [tenantId]);
    const auditRes = await superuserPool.query('SELECT * FROM audit_log WHERE tenant_id = $1', [tenantId]);

    res.json({
      exportedAt: new Date().toISOString(),
      tenant: tenantRes.rows[0],
      data: {
        assessments: assessmentsRes.rows,
        candidates: candidatesRes.rows,
        teams: teamsRes.rows,
        auditLog: auditRes.rows
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'EXPORT_ERROR', message: err.message } });
  }
});
