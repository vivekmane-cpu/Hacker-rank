import { Router } from 'express';
import { requireModule } from '../../middleware/entitlement.js';
import { getTenantContext } from '../../context/tenantContext.js';
import { verifyInvitationToken } from './invitationService.js';
import {
  recordConsent,
  startAttempt,
  getAttemptStatus,
  autosaveAnswer,
  ingestCandidateEvents,
  resumeAttempt,
  submitAttempt
} from './runtimeService.js';
import { PreFlightCheckSchema, IngestEventsSchema } from './types.js';

export const candidateRouter = Router();

// Module entitlement guard
candidateRouter.use(requireModule('candidate_testing'));

// Helper to extract candidate token
function getRequestToken(req: any): string | null {
  return (req.headers['x-candidate-token'] as string) || (req.query.token as string) || req.body?.token || null;
}

// 1. Verify Invitation Token
candidateRouter.get('/candidate/verify', async (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) return res.status(401).json({ error: { code: 'MISSING_TOKEN', message: 'Token is required' } });

    const details = await verifyInvitationToken(token);
    res.json({ data: details });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'VERIFICATION_FAILED', message: err.message } });
  }
});

// 2. Record Consent
candidateRouter.post('/candidate/consent', async (req, res) => {
  try {
    const ctx = getTenantContext();
    if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

    const candidateId = ctx.userId || req.body.candidateId;
    if (!candidateId) return res.status(400).json({ error: { code: 'MISSING_CANDIDATE' } });

    const consent = await recordConsent(ctx.tenantId, candidateId, req.body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      attemptId: req.body.attemptId
    });
    res.status(201).json({ data: consent });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'CONSENT_ERROR', message: err.message } });
  }
});

// 3. Pre-Flight Diagnostic Checks
candidateRouter.post('/candidate/pre-flight', async (req, res) => {
  try {
    const validated = PreFlightCheckSchema.parse(req.body);
    res.json({
      data: {
        status: 'passed',
        checks: validated,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'PREFLIGHT_ERROR', message: err.message } });
  }
});

// 4. Start Assessment Attempt Session
candidateRouter.post('/candidate/start', async (req, res) => {
  try {
    const ctx = getTenantContext();
    if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

    const token = getRequestToken(req);
    if (!token) return res.status(400).json({ error: { code: 'MISSING_TOKEN' } });

    const result = await startAttempt(ctx.tenantId, token);
    res.status(200).json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'START_ERROR', message: err.message } });
  }
});

// 5. Get Active Attempt Status & Server Timer
candidateRouter.get('/candidate/attempt/:attemptId', async (req, res) => {
  try {
    const ctx = getTenantContext();
    if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

    const attemptId = req.params.attemptId as string;
    const status = await getAttemptStatus(ctx.tenantId, attemptId);
    res.json({ data: status });
  } catch (err: any) {
    res.status(404).json({ error: { code: 'ATTEMPT_NOT_FOUND', message: err.message } });
  }
});

// 6. Autosave Answer
candidateRouter.post('/candidate/attempt/:attemptId/autosave', async (req, res) => {
  try {
    const ctx = getTenantContext();
    if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

    const attemptId = req.params.attemptId as string;
    const result = await autosaveAnswer(ctx.tenantId, attemptId, req.body);
    res.json({ data: result });
  } catch (err: any) {
    const status = err.message.includes('timed out') ? 403 : 400;
    res.status(status).json({ error: { code: 'AUTOSAVE_ERROR', message: err.message } });
  }
});

// 7. Ingest Telemetry / Integrity Events (Append-only)
candidateRouter.post('/candidate/attempt/:attemptId/events', async (req, res) => {
  try {
    const ctx = getTenantContext();
    if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

    const attemptId = req.params.attemptId as string;
    const validated = IngestEventsSchema.parse(req.body);
    const result = await ingestCandidateEvents(ctx.tenantId, attemptId, validated.events);
    res.status(201).json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'EVENTS_INGEST_ERROR', message: err.message } });
  }
});

// 8. Reconnect & Resume Attempt Session
candidateRouter.post('/candidate/resume', async (req, res) => {
  try {
    const ctx = getTenantContext();
    if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

    const resumeToken = req.body.resumeToken || req.headers['x-candidate-token'];
    if (!resumeToken) return res.status(400).json({ error: { code: 'MISSING_RESUME_TOKEN' } });

    const result = await resumeAttempt(ctx.tenantId, resumeToken);
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'RESUME_ERROR', message: err.message } });
  }
});

// 9. Submit Assessment Attempt
candidateRouter.post('/candidate/attempt/:attemptId/submit', async (req, res) => {
  try {
    const ctx = getTenantContext();
    if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

    const attemptId = req.params.attemptId as string;
    const result = await submitAttempt(ctx.tenantId, attemptId, req.body?.feedback);
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'SUBMIT_ERROR', message: err.message } });
  }
});
