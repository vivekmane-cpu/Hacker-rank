import { Router } from 'express';
import { requireModule } from '../../middleware/entitlement.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditMiddleware } from '../../middleware/auditLogger.js';
import { getTenantContext } from '../../context/tenantContext.js';
import { runSignalsPipeline, getIntegritySummary } from './signalsPipeline.js';
import {
  getEvidenceTimeline,
  calculateAndSaveScore,
  overrideScore,
  submitRubricReview,
  recordHiringDecision,
  updateIntegrityReview,
  submitCandidateExplanation,
  generateAttemptReport
} from './reviewService.js';

export const reviewRouter = Router();

// Module entitlement guard
reviewRouter.use(requireModule('integrity'));

// 1. Run Signals Pipeline on Attempt
reviewRouter.post(
  '/attempts/:id/signals/run',
  requirePermission('integrity:read'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const attemptId = req.params.id as string;
      const summary = await runSignalsPipeline(ctx.tenantId, attemptId);
      res.json({ data: summary });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'PIPELINE_ERROR', message: err.message } });
    }
  }
);

// 2. Get Combined Integrity Summary
reviewRouter.get(
  '/attempts/:id/integrity',
  requirePermission('integrity:read'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const attemptId = req.params.id as string;
      const summary = await getIntegritySummary(ctx.tenantId, attemptId);
      res.json({ data: summary });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'SUMMARY_ERROR', message: err.message } });
    }
  }
);

// 3. Update Integrity Review Status
reviewRouter.put(
  '/attempts/:id/integrity',
  requirePermission('integrity:review'),
  auditMiddleware('integrity.review', 'integrity_review'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx || !ctx.userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const attemptId = req.params.id as string;
      const updated = await updateIntegrityReview(ctx.tenantId, attemptId, ctx.userId, req.body);
      res.json({ data: updated });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'REVIEW_UPDATE_ERROR', message: err.message } });
    }
  }
);

// 4. Candidate Explanation
reviewRouter.post(
  '/attempts/:id/explanation',
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const attemptId = req.params.id as string;
      const explanation = await submitCandidateExplanation(ctx.tenantId, attemptId, req.body.explanation_text);
      res.status(201).json({ data: explanation });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'EXPLANATION_ERROR', message: err.message } });
    }
  }
);

// 5. Evidence Timeline
reviewRouter.get(
  '/attempts/:id/timeline',
  requirePermission('reviews:read'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const attemptId = req.params.id as string;
      const timeline = await getEvidenceTimeline(ctx.tenantId, attemptId);
      res.json({ data: timeline });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'TIMELINE_ERROR', message: err.message } });
    }
  }
);

// 6. Calculate & Persist Deterministic Score
reviewRouter.post(
  '/attempts/:id/score',
  requirePermission('reviews:write'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const attemptId = req.params.id as string;
      const scoreData = await calculateAndSaveScore(ctx.tenantId, attemptId);
      res.json({ data: scoreData });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'SCORE_CALC_ERROR', message: err.message } });
    }
  }
);

// 7. Manual Score Override
reviewRouter.post(
  '/attempts/:id/override',
  requirePermission('reviews:override'),
  auditMiddleware('score.override', 'score'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx || !ctx.userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const attemptId = req.params.id as string;
      const override = await overrideScore(ctx.tenantId, attemptId, ctx.userId, req.body);
      res.json({ data: override });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'OVERRIDE_ERROR', message: err.message } });
    }
  }
);

// 8. Submit Rubric Subjective Review
reviewRouter.post(
  '/attempts/:id/rubric',
  requirePermission('reviews:write'),
  auditMiddleware('rubric.review', 'review'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx || !ctx.userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const attemptId = req.params.id as string;
      const review = await submitRubricReview(ctx.tenantId, attemptId, ctx.userId, req.body);
      res.status(201).json({ data: review });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'RUBRIC_ERROR', message: err.message } });
    }
  }
);

// 9. Record Human Hiring Decision (THE ABSOLUTE RULE)
reviewRouter.post(
  '/attempts/:id/decision',
  requirePermission('decisions:write'),
  auditMiddleware('decision.record', 'decision'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx || !ctx.userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const attemptId = req.params.id as string;
      const decision = await recordHiringDecision(ctx.tenantId, attemptId, ctx.userId, req.body);
      res.json({ data: decision });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'DECISION_ERROR', message: err.message } });
    }
  }
);

// 10. Generate Evaluation Summary Report
reviewRouter.get(
  '/attempts/:id/report',
  requirePermission('reviews:read'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const attemptId = req.params.id as string;
      const report = await generateAttemptReport(ctx.tenantId, attemptId);
      res.json({ data: report });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'REPORT_ERROR', message: err.message } });
    }
  }
);
