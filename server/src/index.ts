import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { tenantResolverMiddleware } from './middleware/tenantResolver.js';
import { requireModule } from './middleware/entitlement.js';
import { tenantQuery, getTenantContext } from './context/tenantContext.js';
import { auditMiddleware } from './middleware/auditLogger.js';

import { authRouter } from './modules/auth/authRouter.js';
import { rolesRouter } from './modules/organizations/rolesRouter.js';
import { teamsRouter } from './modules/organizations/teamsRouter.js';
import { membersRouter } from './modules/organizations/membersRouter.js';
import { hiringControlsRouter } from './modules/organizations/hiringControlsRouter.js';
import { apiKeysRouter } from './modules/apiKeys/apiKeysRouter.js';
import { supportRouter } from './modules/support/supportRouter.js';
import { platformAdminRouter } from './modules/admin/platformAdminRouter.js';
import { skillsRouter } from './modules/skills/skillsRouter.js';
import { questionsRouter } from './modules/questions/questionsRouter.js';
import { executionRouter } from './modules/execution/executionRouter.js';
import { assessmentRouter } from './modules/assessments/assessmentRouter.js';
import { invitationRouter } from './modules/candidates/invitationRouter.js';
import { candidateRouter } from './modules/candidates/candidateRouter.js';
import { reviewRouter } from './modules/reviews/reviewRouter.js';
import { integrationsRouter } from './modules/integrations/integrationsRouter.js';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

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
app.use('/api/v1', tenantResolverMiddleware);

// 3. Mount auth router
app.use('/api/v1/auth', authRouter);

// 4. Mount organization & administration routers
app.use('/api/v1', rolesRouter);
app.use('/api/v1', teamsRouter);
app.use('/api/v1', membersRouter);
app.use('/api/v1/organization', hiringControlsRouter);
app.use('/api/v1', apiKeysRouter);
app.use('/api/v1', supportRouter);
app.use('/api/v1/admin', platformAdminRouter);

// 5. Mount Assessment Builder & Versioning router
app.use('/api/v1', assessmentRouter);

// 6. Mount Skills & Roles Taxonomy router
app.use('/api/v1', skillsRouter);

// 7. Mount Question Bank router
app.use('/api/v1', questionsRouter);

// 8. Mount Execution Engine router
app.use('/api/v1', executionRouter);

// 9. Mount Recruiter Invitations & Candidate Runtime routers
app.use('/api/v1', invitationRouter);
app.use('/api/v1', candidateRouter);

// 10. Mount Reviews, Integrity & Decision router
app.use('/api/v1', reviewRouter);

// 11. Mount Integrations, Webhooks, ATS, Widget & Billing Metering router
app.use('/api/v1', integrationsRouter);

// 7. Audit log routes
app.get('/api/v1/audit', async (_req, res) => {
  try {
    const { rows } = await tenantQuery('SELECT id, actor_id, actor_type, action, entity_type, entity_id, metadata, created_at FROM audit_log ORDER BY created_at DESC LIMIT 50');
    res.json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Server] Kombee Assess API server running on port ${PORT}`);
  });
}

export default app;
