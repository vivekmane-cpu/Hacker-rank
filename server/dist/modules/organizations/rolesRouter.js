"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rolesRouter = void 0;
const express_1 = require("express");
const tenantContext_js_1 = require("../../context/tenantContext.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
exports.rolesRouter = (0, express_1.Router)();
// List all permissions available on platform
exports.rolesRouter.get('/permissions', (_req, res) => {
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
exports.rolesRouter.get('/roles', async (_req, res) => {
    try {
        const { rows: roles } = await (0, tenantContext_js_1.tenantQuery)(`
      SELECT r.id, r.name, r.description, r.is_system, r.tenant_id,
             COALESCE(json_agg(rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '[]') as permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      GROUP BY r.id, r.name, r.description, r.is_system, r.tenant_id
      ORDER BY r.is_system DESC, r.name ASC
    `);
        res.json({ data: roles });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
// Create tenant custom role
exports.rolesRouter.post('/roles', (0, rbac_js_1.requirePermission)('roles:manage'), (0, auditLogger_js_1.auditMiddleware)('role.create', 'role'), async (req, res) => {
    const { name, description, permissions } = req.body;
    const ctx = (0, tenantContext_js_1.getTenantContext)();
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
        const roleRes = await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO roles (tenant_id, name, description, is_system)
       VALUES ($1, $2, $3, false)
       RETURNING id, name, description, is_system`, [ctx.tenantId, name, description || null]);
        const newRole = roleRes.rows[0];
        for (const perm of permissions) {
            await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO role_permissions (role_id, permission)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`, [newRole.id, perm]);
        }
        (0, rbac_js_1.clearRolePermCache)(ctx.tenantId);
        res.status(201).json({
            data: {
                ...newRole,
                permissions
            }
        });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'ROLE_CREATE_ERROR', message: err.message } });
    }
});
