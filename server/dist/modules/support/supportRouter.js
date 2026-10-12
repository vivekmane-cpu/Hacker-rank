"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportRouter = void 0;
const express_1 = require("express");
const tenantContext_js_1 = require("../../context/tenantContext.js");
const pool_js_1 = require("../../db/pool.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
exports.supportRouter = (0, express_1.Router)();
exports.supportRouter.get('/support-grants', (0, rbac_js_1.requirePermission)('settings:manage'), async (_req, res) => {
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`
      SELECT sg.id, sg.reason, sg.expires_at, sg.revoked_at, sg.created_at,
             u_by.email as granted_by_email, u_to.email as granted_to_email
      FROM support_grants sg
      JOIN users u_by ON u_by.id = sg.granted_by_user_id
      JOIN users u_to ON u_to.id = sg.granted_to_user_id
      ORDER BY sg.created_at DESC
    `);
        res.json({ data: rows });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
exports.supportRouter.post('/support-grants', (0, rbac_js_1.requirePermission)('settings:manage'), (0, auditLogger_js_1.auditMiddleware)('support.grant', 'support_grant'), async (req, res) => {
    const { grantedToEmail, durationHours, reason } = req.body;
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    if (!grantedToEmail || !reason) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'grantedToEmail and reason are required.' } });
    }
    const hours = Math.min(Math.max(Number(durationHours) || 8, 1), 72); // 1 - 72 hours
    try {
        const { rows: staffUser } = await pool_js_1.superuserPool.query('SELECT id FROM users WHERE email = $1', [grantedToEmail.toLowerCase().trim()]);
        if (staffUser.length === 0) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Support user not found.' } });
        }
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO support_grants (tenant_id, granted_by_user_id, granted_to_user_id, reason, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5 || ' hours')::interval)
       RETURNING id, reason, expires_at, created_at`, [ctx.tenantId, ctx.userId || staffUser[0].id, staffUser[0].id, reason, hours.toString()]);
        res.status(201).json({
            data: rows[0],
            message: `Support access grant active for ${hours} hours. Access is strictly audited.`
        });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'INSERT_ERROR', message: err.message } });
    }
});
exports.supportRouter.delete('/support-grants/:id', (0, rbac_js_1.requirePermission)('settings:manage'), (0, auditLogger_js_1.auditMiddleware)('support.revoke', 'support_grant'), async (req, res) => {
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`UPDATE support_grants SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL RETURNING id, revoked_at`, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Grant not found or already revoked.' } });
        }
        res.json({ data: rows[0], message: 'Support grant revoked immediately.' });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
    }
});
