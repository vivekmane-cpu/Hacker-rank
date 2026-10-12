"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitationRouter = void 0;
const express_1 = require("express");
const entitlement_js_1 = require("../../middleware/entitlement.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
const tenantContext_js_1 = require("../../context/tenantContext.js");
const invitationService_js_1 = require("./invitationService.js");
exports.invitationRouter = (0, express_1.Router)();
// Gated behind candidate_testing module
exports.invitationRouter.use((0, entitlement_js_1.requireModule)('candidate_testing'));
// 1. Create Invitation & Candidate
exports.invitationRouter.post('/invitations', (0, rbac_js_1.requirePermission)('candidates:invite'), (0, auditLogger_js_1.auditMiddleware)('invitation.create', 'invitation'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const result = await (0, invitationService_js_1.createInvitation)(ctx.tenantId, req.body);
        res.status(201).json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'INVITATION_CREATE_ERROR', message: err.message } });
    }
});
// 2. List Invitations
exports.invitationRouter.get('/invitations', (0, rbac_js_1.requirePermission)('candidates:read'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const { assessmentId } = req.query;
        const list = await (0, invitationService_js_1.listInvitations)(ctx.tenantId, assessmentId);
        res.json({ data: list });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'LIST_ERROR', message: err.message } });
    }
});
// 3. Revoke Invitation
exports.invitationRouter.post('/invitations/:id/revoke', (0, rbac_js_1.requirePermission)('candidates:invite'), (0, auditLogger_js_1.auditMiddleware)('invitation.revoke', 'invitation'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const id = req.params.id;
        const result = await (0, invitationService_js_1.revokeInvitation)(ctx.tenantId, id);
        res.json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'REVOKE_ERROR', message: err.message } });
    }
});
