"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessmentRouter = void 0;
const express_1 = require("express");
const entitlement_js_1 = require("../../middleware/entitlement.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
const tenantContext_js_1 = require("../../context/tenantContext.js");
const assessmentService_js_1 = require("./assessmentService.js");
exports.assessmentRouter = (0, express_1.Router)();
// Module entitlement guard
exports.assessmentRouter.use((0, entitlement_js_1.requireModule)('assessments'));
// 1. Create Assessment + Draft v1
exports.assessmentRouter.post('/assessments', (0, rbac_js_1.requirePermission)('assessments:write'), (0, auditLogger_js_1.auditMiddleware)('assessment.create', 'assessment'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const result = await (0, assessmentService_js_1.createAssessment)(ctx.tenantId, req.body);
        res.status(201).json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'CREATE_ERROR', message: err.message } });
    }
});
// 2. List Assessments
exports.assessmentRouter.get('/assessments', (0, rbac_js_1.requirePermission)('assessments:read'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const { status, visibility } = req.query;
        const list = await (0, assessmentService_js_1.listAssessments)(ctx.tenantId, {
            status: status,
            visibility: visibility
        });
        res.json({ data: list });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'LIST_ERROR', message: err.message } });
    }
});
// 3. Get Assessment Details
exports.assessmentRouter.get('/assessments/:id', (0, rbac_js_1.requirePermission)('assessments:read'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const id = req.params.id;
        const { versionId } = req.query;
        const details = await (0, assessmentService_js_1.getAssessment)(ctx.tenantId, id, versionId);
        res.json({ data: details });
    }
    catch (err) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }
});
// 4. Update Draft Version
exports.assessmentRouter.put('/assessments/:id/versions/:versionId', (0, rbac_js_1.requirePermission)('assessments:write'), (0, auditLogger_js_1.auditMiddleware)('assessment.version_update', 'assessment'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const id = req.params.id;
        const versionId = req.params.versionId;
        const updated = await (0, assessmentService_js_1.updateDraftVersion)(ctx.tenantId, id, versionId, req.body);
        res.json({ data: updated });
    }
    catch (err) {
        const status = err.message.includes('IMMUTABLE_VERSION') ? 409 : 400;
        res.status(status).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
    }
});
// 5. Fork / Create New Draft Version
exports.assessmentRouter.post('/assessments/:id/versions', (0, rbac_js_1.requirePermission)('assessments:write'), (0, auditLogger_js_1.auditMiddleware)('assessment.fork_version', 'assessment'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const id = req.params.id;
        const { sourceVersionId } = req.body;
        const newVersion = await (0, assessmentService_js_1.createDraftVersion)(ctx.tenantId, id, sourceVersionId);
        res.status(201).json({ data: newVersion });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'FORK_ERROR', message: err.message } });
    }
});
// 6. Add Section to Version
exports.assessmentRouter.post('/assessments/:id/versions/:versionId/sections', (0, rbac_js_1.requirePermission)('assessments:write'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const versionId = req.params.versionId;
        const section = await (0, assessmentService_js_1.addSection)(ctx.tenantId, versionId, req.body);
        res.status(201).json({ data: section });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'SECTION_CREATE_ERROR', message: err.message } });
    }
});
// 7. Delete Section
exports.assessmentRouter.delete('/assessments/:id/sections/:sectionId', (0, rbac_js_1.requirePermission)('assessments:write'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const sectionId = req.params.sectionId;
        const result = await (0, assessmentService_js_1.deleteSection)(ctx.tenantId, sectionId);
        res.json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'SECTION_DELETE_ERROR', message: err.message } });
    }
});
// 8. Add Pool to Section
exports.assessmentRouter.post('/assessments/:id/sections/:sectionId/pools', (0, rbac_js_1.requirePermission)('assessments:write'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const sectionId = req.params.sectionId;
        const pool = await (0, assessmentService_js_1.createPool)(ctx.tenantId, sectionId, req.body);
        res.status(201).json({ data: pool });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'POOL_CREATE_ERROR', message: err.message } });
    }
});
// 9. Add Questions to Pool
exports.assessmentRouter.post('/assessments/:id/pools/:poolId/questions', (0, rbac_js_1.requirePermission)('assessments:write'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const poolId = req.params.poolId;
        const { question_ids } = req.body;
        const result = await (0, assessmentService_js_1.addQuestionsToPool)(ctx.tenantId, poolId, question_ids);
        res.status(201).json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'POOL_QUESTIONS_ERROR', message: err.message } });
    }
});
// 10. Create Variant
exports.assessmentRouter.post('/assessments/:id/versions/:versionId/variants', (0, rbac_js_1.requirePermission)('assessments:write'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const versionId = req.params.versionId;
        const variant = await (0, assessmentService_js_1.createVariant)(ctx.tenantId, versionId, req.body);
        res.status(201).json({ data: variant });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'VARIANT_CREATE_ERROR', message: err.message } });
    }
});
// 11. Create Routing Rule
exports.assessmentRouter.post('/assessments/:id/versions/:versionId/routing-rules', (0, rbac_js_1.requirePermission)('assessments:write'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const versionId = req.params.versionId;
        const rule = await (0, assessmentService_js_1.createRoutingRule)(ctx.tenantId, versionId, req.body);
        res.status(201).json({ data: rule });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'ROUTING_RULE_ERROR', message: err.message } });
    }
});
// 12. Evaluate Routing Rules
exports.assessmentRouter.post('/assessments/:id/versions/:versionId/evaluate-routing', (0, rbac_js_1.requirePermission)('assessments:read'), async (req, res) => {
    try {
        const versionId = req.params.versionId;
        const { candidate_attributes } = req.body;
        const targetVariantId = await (0, assessmentService_js_1.evaluateRouting)(versionId, candidate_attributes || {});
        res.json({ data: { targetVariantId } });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'ROUTING_EVAL_ERROR', message: err.message } });
    }
});
// 13. Publish Assessment Version
exports.assessmentRouter.post('/assessments/:id/versions/:versionId/publish', (0, rbac_js_1.requirePermission)('assessments:publish'), (0, auditLogger_js_1.auditMiddleware)('assessment.publish', 'assessment'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const id = req.params.id;
        const versionId = req.params.versionId;
        const published = await (0, assessmentService_js_1.publishAssessmentVersion)(ctx.tenantId, id, versionId);
        res.json({ data: published });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'PUBLISH_GATE_FAILED', message: err.message } });
    }
});
// 14. Sample Questions Manifest for Version
exports.assessmentRouter.get('/assessments/:id/versions/:versionId/sample', (0, rbac_js_1.requirePermission)('assessments:read'), async (req, res) => {
    try {
        const versionId = req.params.versionId;
        const { variantId } = req.query;
        const manifest = await (0, assessmentService_js_1.sampleQuestionsForCandidate)(versionId, variantId);
        res.json({ data: manifest });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'SAMPLE_ERROR', message: err.message } });
    }
});
