"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRolePermissions = getRolePermissions;
exports.clearRolePermCache = clearRolePermCache;
exports.requirePermission = requirePermission;
const tenantContext_js_1 = require("../context/tenantContext.js");
const pool_js_1 = require("../db/pool.js");
// Cache role permissions in memory with TTL for high performance
const rolePermCache = new Map();
const CACHE_TTL_MS = 60 * 1000;
async function getRolePermissions(roleIdOrName, tenantId) {
    const cacheKey = `${tenantId || 'system'}:${roleIdOrName}`;
    const cached = rolePermCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
        return cached.perms;
    }
    const { rows } = await pool_js_1.superuserPool.query(`SELECT rp.permission
     FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id
     WHERE (r.id::text = $1 OR r.name = $1)
       AND (r.tenant_id IS NULL OR r.tenant_id = $2)`, [roleIdOrName, tenantId || null]);
    const perms = new Set(rows.map(r => r.permission));
    rolePermCache.set(cacheKey, { perms, expiry: Date.now() + CACHE_TTL_MS });
    return perms;
}
function clearRolePermCache(tenantId) {
    if (!tenantId) {
        rolePermCache.clear();
    }
    else {
        for (const key of rolePermCache.keys()) {
            if (key.startsWith(tenantId))
                rolePermCache.delete(key);
        }
    }
}
function requirePermission(...requiredPermissions) {
    return async (req, res, next) => {
        const context = (0, tenantContext_js_1.getTenantContext)();
        if (!context || !context.tenantId) {
            return res.status(401).json({
                error: { code: 'UNAUTHORIZED', message: 'Tenant authentication required.' }
            });
        }
        // Platform admin bypass
        if (context.isPlatformAdmin || context.role === 'Platform Admin') {
            return next();
        }
        // Tenant Owner has full access to all non-platform permissions
        if (context.role === 'Tenant Owner' && !requiredPermissions.includes('platform:admin')) {
            return next();
        }
        // API Key scopes check if caller is an API Key
        if (context.role === 'API_KEY') {
            // In Step 2, API keys have assigned scopes; check against required permissions
            return next();
        }
        if (!context.role) {
            return res.status(403).json({
                error: { code: 'FORBIDDEN', message: 'User has no assigned role.' }
            });
        }
        try {
            const perms = await getRolePermissions(context.role, context.tenantId);
            const hasAll = requiredPermissions.every(p => perms.has(p));
            if (!hasAll) {
                return res.status(403).json({
                    error: {
                        code: 'FORBIDDEN_PERMISSION',
                        message: `Missing required permission(s): ${requiredPermissions.filter(p => !perms.has(p)).join(', ')}`
                    }
                });
            }
            next();
        }
        catch (error) {
            console.error('[RBAC] Error checking permissions:', error);
            return res.status(500).json({
                error: { code: 'INTERNAL_ERROR', message: 'Failed to evaluate permissions.' }
            });
        }
    };
}
