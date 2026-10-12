"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeysRouter = void 0;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const tenantContext_js_1 = require("../../context/tenantContext.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const entitlement_js_1 = require("../../middleware/entitlement.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
exports.apiKeysRouter = (0, express_1.Router)();
// API keys require both the 'api_access' module and 'api_keys:manage' permission
exports.apiKeysRouter.use((0, entitlement_js_1.requireModule)('api_access'));
exports.apiKeysRouter.get('/api-keys', (0, rbac_js_1.requirePermission)('api_keys:manage'), async (_req, res) => {
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`
      SELECT id, name, key_prefix, scopes, environment, revoked_at, created_at
      FROM api_keys
      ORDER BY created_at DESC
    `);
        res.json({ data: rows });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
exports.apiKeysRouter.post('/api-keys', (0, rbac_js_1.requirePermission)('api_keys:manage'), (0, auditLogger_js_1.auditMiddleware)('api_key.create', 'api_key'), async (req, res) => {
    const { name, environment, scopes } = req.body;
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    if (!name) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Name is required.' } });
    }
    const env = environment === 'sandbox' ? 'sandbox' : 'production';
    const prefix = env === 'sandbox' ? 'kba_test' : 'kba_live';
    const randomSecret = crypto_1.default.randomBytes(24).toString('hex');
    const fullApiKey = `${prefix}_${randomSecret}`;
    const keyHash = crypto_1.default.createHash('sha256').update(fullApiKey).digest('hex');
    const assignedScopes = Array.isArray(scopes) && scopes.length > 0
        ? scopes
        : ['assessments:read', 'candidates:write', 'reviews:read'];
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO api_keys (tenant_id, name, key_prefix, key_hash, scopes, environment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, key_prefix, scopes, environment, created_at`, [ctx.tenantId, name, prefix, keyHash, JSON.stringify(assignedScopes), env]);
        // Return the full plaintext key once only
        res.status(201).json({
            data: {
                ...rows[0],
                apiKey: fullApiKey
            },
            warning: 'Store this API key safely. You will not be able to view it again.'
        });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'INSERT_ERROR', message: err.message } });
    }
});
exports.apiKeysRouter.delete('/api-keys/:id', (0, rbac_js_1.requirePermission)('api_keys:manage'), (0, auditLogger_js_1.auditMiddleware)('api_key.revoke', 'api_key'), async (req, res) => {
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`UPDATE api_keys SET revoked_at = NOW()
       WHERE id = $1 AND revoked_at IS NULL
       RETURNING id, name, revoked_at`, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API key not found or already revoked.' } });
        }
        res.json({ data: rows[0], message: 'API key revoked successfully.' });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'REVOKE_ERROR', message: err.message } });
    }
});
