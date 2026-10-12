"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.questionsRouter = void 0;
const express_1 = require("express");
const entitlement_js_1 = require("../../middleware/entitlement.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
const typeRegistry_js_1 = require("./typeRegistry.js");
const questionsService_js_1 = require("./questionsService.js");
const leakScanner_js_1 = require("./leakScanner.js");
const pool_js_1 = require("../../db/pool.js");
const tenantContext_js_1 = require("../../context/tenantContext.js");
exports.questionsRouter = (0, express_1.Router)();
// Gated behind question_bank module entitlement
exports.questionsRouter.use((0, entitlement_js_1.requireModule)('question_bank'));
// 1. Get question types registry definition
exports.questionsRouter.get('/questions/types', (_req, res) => {
    const types = Object.values(typeRegistry_js_1.questionTypeRegistry).map(t => ({
        type: t.type,
        label: t.label,
        category: t.category,
        isAutoGraded: t.isAutoGraded,
        requiresTestCases: t.requiresTestCases,
        requiresReferenceSolution: t.requiresReferenceSolution
    }));
    res.json({ data: types });
});
// 2. Search & filter questions (natural language search supported)
exports.questionsRouter.get('/questions', async (req, res) => {
    const { nlQuery, type, difficulty, status, skillId } = req.query;
    try {
        const questions = await (0, questionsService_js_1.searchQuestions)({
            nlQuery: nlQuery,
            type: type,
            difficulty: difficulty,
            status: status,
            skillId: skillId
        });
        res.json({ data: questions });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'SEARCH_ERROR', message: err.message } });
    }
});
// 3. Create draft question
exports.questionsRouter.post('/questions', (0, rbac_js_1.requirePermission)('questions:write'), (0, auditLogger_js_1.auditMiddleware)('question.create', 'question'), async (req, res) => {
    try {
        const result = await (0, questionsService_js_1.createQuestion)(req.body);
        res.status(201).json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'CREATE_ERROR', message: err.message } });
    }
});
// 4. Edit question (draft update or creates new version if published)
exports.questionsRouter.put('/questions/:id', (0, rbac_js_1.requirePermission)('questions:write'), (0, auditLogger_js_1.auditMiddleware)('question.edit', 'question'), async (req, res) => {
    try {
        const result = await (0, questionsService_js_1.editQuestion)(req.params.id, req.body);
        res.json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'EDIT_ERROR', message: err.message } });
    }
});
// 5. Publish question version with validation gates
exports.questionsRouter.post('/questions/:id/versions/:version/publish', (0, rbac_js_1.requirePermission)('questions:publish'), (0, auditLogger_js_1.auditMiddleware)('question.publish', 'question'), async (req, res) => {
    const { id, version } = req.params;
    try {
        const published = await (0, questionsService_js_1.publishQuestionVersion)(id, Number(version));
        res.json({
            data: published,
            message: `Version ${version} published and permanently locked.`
        });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'PUBLISH_GATE_FAILED', message: err.message } });
    }
});
// 6. Trigger leak scan for a published question
exports.questionsRouter.post('/questions/:id/scan-leak', async (req, res) => {
    try {
        const result = await (0, leakScanner_js_1.runLeakScanForQuestion)(req.params.id);
        res.json({ data: result });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'SCAN_ERROR', message: err.message } });
    }
});
// 7. Leak findings human review queue
exports.questionsRouter.get('/questions/leaks/queue', async (_req, res) => {
    try {
        const { rows } = await pool_js_1.superuserPool.query(`
      SELECT lf.id, lf.question_id, qv.title as question_title,
             lf.source_url, lf.snippet, lf.confidence, lf.status, lf.detected_at
      FROM leak_findings lf
      JOIN question_versions qv ON qv.question_id = lf.question_id AND qv.status = 'published'
      WHERE lf.status = 'pending'
      ORDER BY lf.confidence DESC
    `);
        res.json({ data: rows });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
// 8. Human review action for leak finding (confirmed_leak -> retires question, or dismissed)
exports.questionsRouter.post('/questions/leaks/:id/review', (0, rbac_js_1.requirePermission)('questions:publish'), (0, auditLogger_js_1.auditMiddleware)('question.leak_review', 'leak_finding'), async (req, res) => {
    const { action, note } = req.body;
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    if (!action || !['confirmed_leak', 'dismissed'].includes(action)) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: "Action must be 'confirmed_leak' or 'dismissed'." } });
    }
    try {
        const result = await (0, leakScanner_js_1.reviewLeakFinding)(req.params.id, ctx.userId || ctx.tenantId, action, note || '');
        res.json({ data: result });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'REVIEW_ERROR', message: err.message } });
    }
});
