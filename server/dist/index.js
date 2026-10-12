"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const tenantResolver_js_1 = require("./middleware/tenantResolver.js");
const tenantContext_js_1 = require("./context/tenantContext.js");
const authRouter_js_1 = require("./modules/auth/authRouter.js");
const rolesRouter_js_1 = require("./modules/organizations/rolesRouter.js");
const teamsRouter_js_1 = require("./modules/organizations/teamsRouter.js");
const membersRouter_js_1 = require("./modules/organizations/membersRouter.js");
const hiringControlsRouter_js_1 = require("./modules/organizations/hiringControlsRouter.js");
const apiKeysRouter_js_1 = require("./modules/apiKeys/apiKeysRouter.js");
const supportRouter_js_1 = require("./modules/support/supportRouter.js");
const platformAdminRouter_js_1 = require("./modules/admin/platformAdminRouter.js");
const skillsRouter_js_1 = require("./modules/skills/skillsRouter.js");
const questionsRouter_js_1 = require("./modules/questions/questionsRouter.js");
const executionRouter_js_1 = require("./modules/execution/executionRouter.js");
const assessmentRouter_js_1 = require("./modules/assessments/assessmentRouter.js");
const invitationRouter_js_1 = require("./modules/candidates/invitationRouter.js");
const candidateRouter_js_1 = require("./modules/candidates/candidateRouter.js");
const reviewRouter_js_1 = require("./modules/reviews/reviewRouter.js");
const integrationsRouter_js_1 = require("./modules/integrations/integrationsRouter.js");
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
// 1. Health check - explicitly exempt
app.get('/api/v1/health', (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        product: 'Kombee Assess',
        version: '1.0.0'
    });
});
// 2. Apply fail-closed tenant resolver (exempts health, login, reset-password, docs)
app.use('/api/v1', tenantResolver_js_1.tenantResolverMiddleware);
// 3. Mount auth router
app.use('/api/v1/auth', authRouter_js_1.authRouter);
// 4. Mount organization & administration routers
app.use('/api/v1', rolesRouter_js_1.rolesRouter);
app.use('/api/v1', teamsRouter_js_1.teamsRouter);
app.use('/api/v1', membersRouter_js_1.membersRouter);
app.use('/api/v1/organization', hiringControlsRouter_js_1.hiringControlsRouter);
app.use('/api/v1', apiKeysRouter_js_1.apiKeysRouter);
app.use('/api/v1', supportRouter_js_1.supportRouter);
app.use('/api/v1/admin', platformAdminRouter_js_1.platformAdminRouter);
// 5. Mount Assessment Builder & Versioning router
app.use('/api/v1', assessmentRouter_js_1.assessmentRouter);
// 6. Mount Skills & Roles Taxonomy router
app.use('/api/v1', skillsRouter_js_1.skillsRouter);
// 7. Mount Question Bank router
app.use('/api/v1', questionsRouter_js_1.questionsRouter);
// 8. Mount Execution Engine router
app.use('/api/v1', executionRouter_js_1.executionRouter);
// 9. Mount Recruiter Invitations & Candidate Runtime routers
app.use('/api/v1', invitationRouter_js_1.invitationRouter);
app.use('/api/v1', candidateRouter_js_1.candidateRouter);
// 10. Mount Reviews, Integrity & Decision router
app.use('/api/v1', reviewRouter_js_1.reviewRouter);
// 11. Mount Integrations, Webhooks, ATS, Widget & Billing Metering router
app.use('/api/v1', integrationsRouter_js_1.integrationsRouter);
// 7. Audit log routes
app.get('/api/v1/audit', async (_req, res) => {
    try {
        const { rows } = await (0, tenantContext_js_1.tenantQuery)('SELECT id, actor_id, actor_type, action, entity_type, entity_id, metadata, created_at FROM audit_log ORDER BY created_at DESC LIMIT 50');
        res.json({ data: rows });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`[Server] Kombee Assess API server running on port ${PORT}`);
    });
}
exports.default = app;
