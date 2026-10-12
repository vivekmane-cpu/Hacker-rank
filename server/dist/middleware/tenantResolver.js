"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantResolverMiddleware = tenantResolverMiddleware;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const pool_js_1 = require("../db/pool.js");
const tenantContext_js_1 = require("../context/tenantContext.js");
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-minimum-32-chars-long-kombee-assess';
// Explicitly exempt public routes that do not require an ambient tenant context
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
async function tenantResolverMiddleware(req, res, next) {
    // 1. Check for exempt paths using both originalUrl and req.path
    const fullPath = (req.originalUrl || req.path).split('?')[0];
    if (EXEMPT_PATHS.some(path => fullPath.startsWith(path) || req.path.startsWith(path) || fullPath.endsWith(path))) {
        return next();
    }
    let resolvedTenantId = null;
    let resolvedUserId;
    let resolvedRole;
    let resolvedEmail;
    let resolvedEnv = 'production';
    let isPlatformAdmin = false;
    const authHeader = req.headers.authorization;
    const sessionCookie = req.cookies?.kombee_session;
    const candidateToken = req.headers['x-candidate-token'] || req.query.token || req.body?.token || req.body?.resumeToken;
    try {
        // 2. Resolve via API Key (starts with 'kba_')
        if (authHeader && authHeader.startsWith('Bearer kba_')) {
            const rawKey = authHeader.replace('Bearer ', '').trim();
            const keyHash = crypto_1.default.createHash('sha256').update(rawKey).digest('hex');
            // Use system pool for tenant credential lookup
            const { rows } = await pool_js_1.superuserPool.query(`SELECT a.tenant_id, a.environment, a.scopes, t.status as tenant_status
         FROM api_keys a
         JOIN tenants t ON t.id = a.tenant_id
         WHERE a.key_hash = $1 AND a.revoked_at IS NULL`, [keyHash]);
            if (rows.length > 0) {
                if (rows[0].tenant_status === 'suspended' && req.method === 'POST') {
                    return res.status(403).json({
                        error: { code: 'TENANT_SUSPENDED', message: 'Tenant is suspended. New actions are prohibited.' }
                    });
                }
                resolvedTenantId = rows[0].tenant_id;
                resolvedEnv = rows[0].environment;
                resolvedRole = 'API_KEY';
            }
        }
        // 3. Resolve via JWT Session (Bearer Token or Cookie)
        else if (authHeader?.startsWith('Bearer ') || sessionCookie) {
            const token = authHeader ? authHeader.replace('Bearer ', '').trim() : sessionCookie;
            try {
                const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                if (decoded && decoded.tenantId) {
                    resolvedTenantId = decoded.tenantId;
                    resolvedUserId = decoded.userId;
                    resolvedRole = decoded.role;
                    resolvedEmail = decoded.email;
                    isPlatformAdmin = !!decoded.isPlatformAdmin;
                }
            }
            catch (tokenErr) {
                // Invalid token - fall through to fail closed
            }
        }
        // 4. Resolve via Candidate Invite or Resume Token
        else if (candidateToken) {
            const tokenHash = crypto_1.default.createHash('sha256').update(candidateToken).digest('hex');
            const { rows } = await pool_js_1.superuserPool.query(`SELECT i.tenant_id, i.candidate_id, i.status, t.status as tenant_status
         FROM invitations i
         JOIN tenants t ON t.id = i.tenant_id
         WHERE i.token_hash = $1 AND i.expires_at > NOW() AND i.status != 'revoked'`, [tokenHash]);
            if (rows.length > 0) {
                resolvedTenantId = rows[0].tenant_id;
                resolvedUserId = rows[0].candidate_id;
                resolvedRole = 'Candidate';
            }
            else {
                const { rows: attRows } = await pool_js_1.superuserPool.query(`SELECT a.tenant_id, a.candidate_id, a.status, t.status as tenant_status
           FROM attempts a
           JOIN tenants t ON t.id = a.tenant_id
           WHERE a.resume_token_hash = $1 AND a.expires_at > NOW()`, [tokenHash]);
                if (attRows.length > 0) {
                    resolvedTenantId = attRows[0].tenant_id;
                    resolvedUserId = attRows[0].candidate_id;
                    resolvedRole = 'Candidate';
                }
            }
        }
        // 5. Fail closed if tenant could not be resolved
        // NOTE: X-Tenant-Id header from untrusted clients is intentionally ignored to prevent spoofing
        if (!resolvedTenantId) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED_TENANT',
                    message: 'Tenant context could not be resolved. A valid API key, session, or invite token is required.'
                }
            });
        }
        // 6. Bind to transaction on appPool with SET LOCAL app.tenant_id
        const client = await pool_js_1.appPool.connect();
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [resolvedTenantId]);
        const context = {
            tenantId: resolvedTenantId,
            userId: resolvedUserId,
            role: resolvedRole,
            userEmail: resolvedEmail,
            environment: resolvedEnv,
            isPlatformAdmin,
            client
        };
        let released = false;
        const cleanup = async (commit) => {
            if (released)
                return;
            released = true;
            try {
                if (commit) {
                    await client.query('COMMIT');
                }
                else {
                    await client.query('ROLLBACK');
                }
            }
            catch (err) {
                await client.query('ROLLBACK').catch(() => { });
            }
            finally {
                client.release();
            }
        };
        res.on('finish', () => {
            const success = res.statusCode < 400;
            cleanup(success);
        });
        res.on('close', () => {
            if (!released)
                cleanup(false);
        });
        // Run the rest of the request within the ambient AsyncLocalStorage
        (0, tenantContext_js_1.runWithTenantContext)(context, () => {
            next();
        });
    }
    catch (error) {
        console.error('[TenantResolver] Internal Error:', error);
        return res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Failed to initialize tenant session transaction.' }
        });
    }
}
