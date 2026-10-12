"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executionRouter = void 0;
const express_1 = require("express");
const entitlement_js_1 = require("../../middleware/entitlement.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
const executionService_js_1 = require("./executionService.js");
const pool_js_1 = require("../../db/pool.js");
const tenantContext_js_1 = require("../../context/tenantContext.js");
exports.executionRouter = (0, express_1.Router)();
// Gated behind candidate_testing module entitlement
exports.executionRouter.use((0, entitlement_js_1.requireModule)('candidate_testing'));
// 1. Interactive direct run (Priority interactive execution)
exports.executionRouter.post('/execution/run', async (req, res) => {
    const { language, code, files, entrypoint, stdin, sqlParams, attemptId, questionVersionId } = req.body;
    if (!language) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'language is required.' } });
    }
    try {
        const result = await (0, executionService_js_1.executeCodeDirectly)({
            language,
            code,
            files,
            entrypoint,
            stdin,
            sqlParams,
            attemptId,
            questionVersionId,
            isSubmission: false
        });
        res.json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'EXECUTION_FAILED', message: err.message } });
    }
});
// 2. Submit for batch asynchronous grading
exports.executionRouter.post('/execution/submit', (0, auditLogger_js_1.auditMiddleware)('attempt.code_submit', 'execution'), async (req, res) => {
    const { language, code, files, attemptId, questionVersionId, sqlParams } = req.body;
    if (!language) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'language is required.' } });
    }
    try {
        const result = await (0, executionService_js_1.submitForAsyncGrading)({
            language,
            code,
            files,
            attemptId,
            questionVersionId,
            sqlParams,
            isSubmission: true
        });
        res.status(202).json({ data: result });
    }
    catch (err) {
        res.status(429).json({ error: { code: 'SUBMIT_FAILED', message: err.message } });
    }
});
// 3. Check status of enqueued batch job
exports.executionRouter.get('/execution/jobs/:id', async (req, res) => {
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    try {
        const { rows } = await pool_js_1.superuserPool.query(`SELECT id, priority, status, attempts, error_message, created_at, completed_at
       FROM jobs
       WHERE id = $1 AND (payload->>'tenantId') = $2`, [req.params.id, ctx.tenantId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Execution job not found.' } });
        }
        res.json({ data: rows[0] });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
