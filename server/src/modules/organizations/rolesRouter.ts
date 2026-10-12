import { Router } from 'express';
import { getTenantContext, tenantQuery } from '../../context/tenantContext.js';
import { requirePermission, clearRolePermCache } from '../../middleware/rbac.js';
import { auditMiddleware } from '../../middleware/auditLogger.js';

export const rolesRouter = Router();

// List all permissions available on platform
rolesRouter.get('/permissions', (_req, res) => {
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
    'audit:read', 'billing:read'
  ];
  res.json({ data: permissions });
});

// List roles (system default roles + tenant-specific custom roles)
rolesRouter.get('/roles', async (_req, res) => {
  try {
    const { rows: roles } = await tenantQuery(`
      SELECT r.id, r.name, r.description, r.is_system, r.tenant_id,
             COALESCE(json_agg(rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '[]') as permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      GROUP BY r.id, r.name, r.description, r.is_system, r.tenant_id
      ORDER BY r.is_system DESC, r.name ASC
    `);
    res.json({ data: roles });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

// Create tenant custom role
rolesRouter.post('/roles', requirePermission('roles:manage'), auditMiddleware('role.create', 'role'), async (req, res) => {
  const { name, description, permissions } = req.body;
  const ctx = getTenantContext()!;

  if (!name || !Array.isArray(permissions)) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Name and permissions array are required.' }
    });
  }

  // Prevent creation of platform admin permission in custom roles
  if (permissions.includes('platform:admin')) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Cannot assign platform:admin permission to tenant custom roles.' }
    });
  }

  try {
    const roleRes = await tenantQuery(
      `INSERT INTO roles (tenant_id, name, description, is_system)
       VALUES ($1, $2, $3, false)
       RETURNING id, name, description, is_system`,
      [ctx.tenantId, name, description || null]
    );
    const newRole = roleRes.rows[0];

    for (const perm of permissions) {
      await tenantQuery(
        `INSERT INTO role_permissions (role_id, permission)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [newRole.id, perm]
      );
    }

    clearRolePermCache(ctx.tenantId);

    res.status(201).json({
      data: {
        ...newRole,
        permissions
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'ROLE_CREATE_ERROR', message: err.message } });
  }
});
