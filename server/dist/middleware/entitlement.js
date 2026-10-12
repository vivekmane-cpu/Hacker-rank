"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireModule = requireModule;
const tenantContext_js_1 = require("../context/tenantContext.js");
const pool_js_1 = require("../db/pool.js");
const EXEMPT_PATHS = [
    '/api/v1/health',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/sso/login',
    '/api/v1/docs',
    '/api/v1/widget/snippet',
    '/api/v1/integrations/ats/greenhouse/webhook',
    '/api/v1/integrations/ats/lever/webhook'
];
function requireModule(moduleName) {
    return async (req, res, next) => {
        const fullPath = (req.originalUrl || req.path).split('?')[0];
        if (EXEMPT_PATHS.some(path => fullPath.startsWith(path) || req.path.startsWith(path) || fullPath.endsWith(path))) {
            return next();
        }
        const context = (0, tenantContext_js_1.getTenantContext)();
        if (!context || !context.tenantId) {
            return res.status(401).json({
                error: { code: 'UNAUTHORIZED_TENANT', message: 'Tenant context is missing.' }
            });
        }
        // Platform admin bypass for system administration routes if flagged
        if (context.isPlatformAdmin) {
            return next();
        }
        try {
            const { rows } = await pool_js_1.superuserPool.query(`SELECT enabled FROM tenant_modules
         WHERE tenant_id = $1 AND module = $2`, [context.tenantId, moduleName]);
            const isEnabled = rows.length > 0 && rows[0].enabled === true;
            if (!isEnabled) {
                return res.status(403).json({
                    error: {
                        code: 'MODULE_NOT_ENTITLED',
                        message: `Tenant is not entitled to use the '${moduleName}' module. Please upgrade your subscription.`
                    }
                });
            }
            next();
        }
        catch (error) {
            console.error(`[Entitlement] Error verifying module ${moduleName}:`, error);
            return res.status(500).json({
                error: { code: 'INTERNAL_ERROR', message: 'Failed to verify module entitlement.' }
            });
        }
    };
}
