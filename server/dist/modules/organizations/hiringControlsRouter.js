"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hiringControlsRouter = void 0;
const express_1 = require("express");
const tenantContext_js_1 = require("../../context/tenantContext.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
exports.hiringControlsRouter = (0, express_1.Router)();
exports.hiringControlsRouter.get('/hiring-controls', async (_req, res) => {
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)(`
      SELECT branding, region, billing_status FROM tenants WHERE id = $1
    `, [ctx.tenantId]);
        const branding = rows[0]?.branding || {};
        const controls = {
            defaultAiPolicy: branding.defaultAiPolicy || 'guarded',
            defaultPassScore: branding.defaultPassScore || 70,
            defaultDurationMinutes: branding.defaultDurationMinutes || 60,
            integritySettings: branding.integritySettings || {
                secureMode: false,
                trackTabSwitches: true,
                trackPaste: true,
                codeSimilarity: true,
                aiCodeDetection: true,
                cameraCheck: false,
                screenshotMonitoring: false
            },
            accommodationsPolicy: branding.accommodationsPolicy || {
                allowAccessibleTextMode: true,
                maxExtraTimeMultiplier: 2.0
            }
        };
        res.json({ data: controls });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
exports.hiringControlsRouter.put('/hiring-controls', (0, rbac_js_1.requirePermission)('settings:manage'), (0, auditLogger_js_1.auditMiddleware)('settings.update_hiring_controls', 'tenant'), async (req, res) => {
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    const newControls = req.body;
    try {
        const { rows: current } = await (0, tenantContext_js_1.tenantQuery)('SELECT branding FROM tenants WHERE id = $1', [ctx.tenantId]);
        const branding = current[0]?.branding || {};
        const updatedBranding = {
            ...branding,
            ...newControls
        };
        await (0, tenantContext_js_1.tenantQuery)('UPDATE tenants SET branding = $1 WHERE id = $2', [updatedBranding, ctx.tenantId]);
        res.json({ data: newControls, message: 'Hiring controls successfully updated.' });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
    }
});
