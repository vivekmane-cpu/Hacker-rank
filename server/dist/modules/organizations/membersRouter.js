"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.membersRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const tenantContext_js_1 = require("../../context/tenantContext.js");
const pool_js_1 = require("../../db/pool.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
exports.membersRouter = (0, express_1.Router)();
exports.membersRouter.get('/members', async (_req, res) => {
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`
      SELECT m.id, m.user_id, u.email, u.full_name, u.status as user_status,
             r.id as role_id, r.name as role_name,
             t.id as team_id, t.name as team_name,
             m.created_at
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      JOIN roles r ON r.id = m.role_id
      LEFT JOIN teams t ON t.id = m.team_id
      ORDER BY m.created_at ASC
    `);
        res.json({ data: rows });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
exports.membersRouter.post('/members', (0, rbac_js_1.requirePermission)('members:manage'), (0, auditLogger_js_1.auditMiddleware)('member.add', 'membership'), async (req, res) => {
    const { email, fullName, roleId, teamId, tempPassword } = req.body;
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    if (!email || !roleId) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Email and roleId are required.' } });
    }
    try {
        // 1. Ensure user exists (or create them)
        const normEmail = email.toLowerCase().trim();
        let { rows: userRows } = await pool_js_1.superuserPool.query('SELECT id FROM users WHERE email = $1', [normEmail]);
        let userId;
        if (userRows.length === 0) {
            const defaultPass = tempPassword || 'Welcome123!';
            const hash = await bcryptjs_1.default.hash(defaultPass, 10);
            const newUser = await pool_js_1.superuserPool.query(`INSERT INTO users (email, password_hash, full_name, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id`, [normEmail, hash, fullName || normEmail.split('@')[0]]);
            userId = newUser.rows[0].id;
        }
        else {
            userId = userRows[0].id;
        }
        // 2. Insert membership for current tenant
        const { rows: memberRows } = await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO memberships (tenant_id, user_id, role_id, team_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, tenant_id, user_id, role_id, team_id, created_at`, [ctx.tenantId, userId, roleId, teamId || null]);
        res.status(201).json({ data: memberRows[0] });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'INSERT_ERROR', message: err.message } });
    }
});
exports.membersRouter.put('/members/:id/role', (0, rbac_js_1.requirePermission)('members:manage'), (0, auditLogger_js_1.auditMiddleware)('member.change_role', 'membership'), async (req, res) => {
    const { roleId } = req.body;
    if (!roleId) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'roleId is required.' } });
    }
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`UPDATE memberships SET role_id = $1 WHERE id = $2 RETURNING id, user_id, role_id`, [roleId, req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Membership not found.' } });
        }
        res.json({ data: rows[0] });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
    }
});
exports.membersRouter.delete('/members/:id', (0, rbac_js_1.requirePermission)('members:manage'), (0, auditLogger_js_1.auditMiddleware)('member.remove', 'membership'), async (req, res) => {
    try {
        await (0, tenantContext_js_1.tenantQuery)('DELETE FROM memberships WHERE id = $1', [req.params.id]);
        res.json({ message: 'Member removed from tenant.' });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'DELETE_ERROR', message: err.message } });
    }
});
