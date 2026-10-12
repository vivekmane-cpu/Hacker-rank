"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRouter = void 0;
const express_1 = require("express");
const entitlement_js_1 = require("../../middleware/entitlement.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
const tenantContext_js_1 = require("../../context/tenantContext.js");
const signalsPipeline_js_1 = require("./signalsPipeline.js");
const reviewService_js_1 = require("./reviewService.js");
exports.reviewRouter = (0, express_1.Router)();
// Module entitlement guard
exports.reviewRouter.use((0, entitlement_js_1.requireModule)('integrity'));
// 1. Run Signals Pipeline on Attempt
exports.reviewRouter.post('/attempts/:id/signals/run', (0, rbac_js_1.requirePermission)('integrity:read'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.id;
        const summary = await (0, signalsPipeline_js_1.runSignalsPipeline)(ctx.tenantId, attemptId);
        res.json({ data: summary });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'PIPELINE_ERROR', message: err.message } });
    }
});
// 2. Get Combined Integrity Summary
exports.reviewRouter.get('/attempts/:id/integrity', (0, rbac_js_1.requirePermission)('integrity:read'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.id;
        const summary = await (0, signalsPipeline_js_1.getIntegritySummary)(ctx.tenantId, attemptId);
        res.json({ data: summary });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'SUMMARY_ERROR', message: err.message } });
    }
});
// 3. Update Integrity Review Status
exports.reviewRouter.put('/attempts/:id/integrity', (0, rbac_js_1.requirePermission)('integrity:review'), (0, auditLogger_js_1.auditMiddleware)('integrity.review', 'integrity_review'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx || !ctx.userId)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.id;
        const updated = await (0, reviewService_js_1.updateIntegrityReview)(ctx.tenantId, attemptId, ctx.userId, req.body);
        res.json({ data: updated });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'REVIEW_UPDATE_ERROR', message: err.message } });
    }
});
// 4. Candidate Explanation
exports.reviewRouter.post('/attempts/:id/explanation', async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.id;
        const explanation = await (0, reviewService_js_1.submitCandidateExplanation)(ctx.tenantId, attemptId, req.body.explanation_text);
        res.status(201).json({ data: explanation });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'EXPLANATION_ERROR', message: err.message } });
    }
});
// 5. Evidence Timeline
exports.reviewRouter.get('/attempts/:id/timeline', (0, rbac_js_1.requirePermission)('reviews:read'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.id;
        const timeline = await (0, reviewService_js_1.getEvidenceTimeline)(ctx.tenantId, attemptId);
        res.json({ data: timeline });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'TIMELINE_ERROR', message: err.message } });
    }
});
// 6. Calculate & Persist Deterministic Score
exports.reviewRouter.post('/attempts/:id/score', (0, rbac_js_1.requirePermission)('reviews:write'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.id;
        const scoreData = await (0, reviewService_js_1.calculateAndSaveScore)(ctx.tenantId, attemptId);
        res.json({ data: scoreData });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'SCORE_CALC_ERROR', message: err.message } });
    }
});
// 7. Manual Score Override
exports.reviewRouter.post('/attempts/:id/override', (0, rbac_js_1.requirePermission)('reviews:override'), (0, auditLogger_js_1.auditMiddleware)('score.override', 'score'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx || !ctx.userId)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.id;
        const override = await (0, reviewService_js_1.overrideScore)(ctx.tenantId, attemptId, ctx.userId, req.body);
        res.json({ data: override });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'OVERRIDE_ERROR', message: err.message } });
    }
});
// 8. Submit Rubric Subjective Review
exports.reviewRouter.post('/attempts/:id/rubric', (0, rbac_js_1.requirePermission)('reviews:write'), (0, auditLogger_js_1.auditMiddleware)('rubric.review', 'review'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx || !ctx.userId)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.id;
        const review = await (0, reviewService_js_1.submitRubricReview)(ctx.tenantId, attemptId, ctx.userId, req.body);
        res.status(201).json({ data: review });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'RUBRIC_ERROR', message: err.message } });
    }
});
// 9. Record Human Hiring Decision (THE ABSOLUTE RULE)
exports.reviewRouter.post('/attempts/:id/decision', (0, rbac_js_1.requirePermission)('decisions:write'), (0, auditLogger_js_1.auditMiddleware)('decision.record', 'decision'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx || !ctx.userId)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.id;
        const decision = await (0, reviewService_js_1.recordHiringDecision)(ctx.tenantId, attemptId, ctx.userId, req.body);
        res.json({ data: decision });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'DECISION_ERROR', message: err.message } });
    }
});
// 10. Generate Evaluation Summary Report
exports.reviewRouter.get('/attempts/:id/report', (0, rbac_js_1.requirePermission)('reviews:read'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const attemptId = req.params.id;
        const report = await (0, reviewService_js_1.generateAttemptReport)(ctx.tenantId, attemptId);
        res.json({ data: report });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'REPORT_ERROR', message: err.message } });
    }
});
