"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.candidateRouter = void 0;
const express_1 = require("express");
const entitlement_js_1 = require("../../middleware/entitlement.js");
const tenantContext_js_1 = require("../../context/tenantContext.js");
const invitationService_js_1 = require("./invitationService.js");
const runtimeService_js_1 = require("./runtimeService.js");
const types_js_1 = require("./types.js");
exports.candidateRouter = (0, express_1.Router)();
// Module entitlement guard
exports.candidateRouter.use((0, entitlement_js_1.requireModule)('candidate_testing'));
// Helper to extract candidate token
function getRequestToken(req) {
    return req.headers['x-candidate-token'] || req.query.token || req.body?.token || null;
}
// 1. Verify Invitation Token
exports.candidateRouter.get('/candidate/verify', async (req, res) => {
    try {
        const token = getRequestToken(req);
        if (!token)
            return res.status(401).json({ error: { code: 'MISSING_TOKEN', message: 'Token is required' } });
        const details = await (0, invitationService_js_1.verifyInvitationToken)(token);
        res.json({ data: details });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'VERIFICATION_FAILED', message: err.message } });
    }
});
// 2. Record Consent
exports.candidateRouter.post('/candidate/consent', async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const candidateId = ctx.userId || req.body.candidateId;
        if (!candidateId)
            return res.status(400).json({ error: { code: 'MISSING_CANDIDATE' } });
        const consent = await (0, runtimeService_js_1.recordConsent)(ctx.tenantId, candidateId, req.body, {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            attemptId: req.body.attemptId
        });
        res.status(201).json({ data: consent });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'CONSENT_ERROR', message: err.message } });
    }
});
// 3. Pre-Flight Diagnostic Checks
exports.candidateRouter.post('/candidate/pre-flight', async (req, res) => {
    try {
        const validated = types_js_1.PreFlightCheckSchema.parse(req.body);
        res.json({
            data: {
                status: 'passed',
                checks: validated,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'PREFLIGHT_ERROR', message: err.message } });
    }
});
// 4. Start Assessment Attempt Session
exports.candidateRouter.post('/candidate/start', async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const token = getRequestToken(req);
        if (!token)
            return res.status(400).json({ error: { code: 'MISSING_TOKEN' } });
        const result = await (0, runtimeService_js_1.startAttempt)(ctx.tenantId, token);
        res.status(200).json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'START_ERROR', message: err.message } });
    }
});
// 5. Get Active Attempt Status & Server Timer
exports.candidateRouter.get('/candidate/attempt/:attemptId', async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.attemptId;
        const status = await (0, runtimeService_js_1.getAttemptStatus)(ctx.tenantId, attemptId);
        res.json({ data: status });
    }
    catch (err) {
        res.status(404).json({ error: { code: 'ATTEMPT_NOT_FOUND', message: err.message } });
    }
});
// 6. Autosave Answer
exports.candidateRouter.post('/candidate/attempt/:attemptId/autosave', async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.attemptId;
        const result = await (0, runtimeService_js_1.autosaveAnswer)(ctx.tenantId, attemptId, req.body);
        res.json({ data: result });
    }
    catch (err) {
        const status = err.message.includes('timed out') ? 403 : 400;
        res.status(status).json({ error: { code: 'AUTOSAVE_ERROR', message: err.message } });
    }
});
// 7. Ingest Telemetry / Integrity Events (Append-only)
exports.candidateRouter.post('/candidate/attempt/:attemptId/events', async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.attemptId;
        const validated = types_js_1.IngestEventsSchema.parse(req.body);
        const result = await (0, runtimeService_js_1.ingestCandidateEvents)(ctx.tenantId, attemptId, validated.events);
        res.status(201).json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'EVENTS_INGEST_ERROR', message: err.message } });
    }
});
// 8. Reconnect & Resume Attempt Session
exports.candidateRouter.post('/candidate/resume', async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const resumeToken = req.body.resumeToken || req.headers['x-candidate-token'];
        if (!resumeToken)
            return res.status(400).json({ error: { code: 'MISSING_RESUME_TOKEN' } });
        const result = await (0, runtimeService_js_1.resumeAttempt)(ctx.tenantId, resumeToken);
        res.json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'RESUME_ERROR', message: err.message } });
    }
});
// 9. Submit Assessment Attempt
exports.candidateRouter.post('/candidate/attempt/:attemptId/submit', async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.attemptId;
        const result = await (0, runtimeService_js_1.submitAttempt)(ctx.tenantId, attemptId, req.body?.feedback);
        res.json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'SUBMIT_ERROR', message: err.message } });
    }
});
