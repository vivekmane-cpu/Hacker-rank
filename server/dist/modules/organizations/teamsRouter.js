"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamsRouter = void 0;
const express_1 = require("express");
const tenantContext_js_1 = require("../../context/tenantContext.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
exports.teamsRouter = (0, express_1.Router)();
exports.teamsRouter.get('/teams', async (_req, res) => {
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`
      SELECT t.id, t.name, t.description, t.created_at,
             COUNT(m.id)::int as member_count
      FROM teams t
      LEFT JOIN memberships m ON m.team_id = t.id
      GROUP BY t.id, t.name, t.description, t.created_at
      ORDER BY t.name ASC
    `);
        res.json({ data: rows });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
exports.teamsRouter.post('/teams', (0, rbac_js_1.requirePermission)('teams:manage'), (0, auditLogger_js_1.auditMiddleware)('team.create', 'team'), async (req, res) => {
    const { name, description } = req.body;
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    if (!name) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Team name is required.' } });
    }
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO teams (tenant_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at`, [ctx.tenantId, name, description || null]);
        res.status(201).json({ data: rows[0] });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'INSERT_ERROR', message: err.message } });
    }
});
exports.teamsRouter.put('/teams/:id', (0, rbac_js_1.requirePermission)('teams:manage'), (0, auditLogger_js_1.auditMiddleware)('team.update', 'team'), async (req, res) => {
    const { name, description } = req.body;
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`UPDATE teams SET name = COALESCE($1, name), description = COALESCE($2, description)
       WHERE id = $3
       RETURNING id, name, description, created_at`, [name, description, req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found.' } });
        }
        res.json({ data: rows[0] });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
    }
});
exports.teamsRouter.delete('/teams/:id', (0, rbac_js_1.requirePermission)('teams:manage'), (0, auditLogger_js_1.auditMiddleware)('team.delete', 'team'), async (req, res) => {
    try {
        await (0, tenantContext_js_1.tenantQuery)('DELETE FROM teams WHERE id = $1', [req.params.id]);
        res.json({ message: 'Team deleted successfully.' });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'DELETE_ERROR', message: err.message } });
    }
});
