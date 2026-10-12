import { Router } from 'express';
import { requireModule } from '../../middleware/entitlement.js';
import { auditMiddleware } from '../../middleware/auditLogger.js';
import { executeCodeDirectly, submitForAsyncGrading } from './executionService.js';
import { superuserPool } from '../../db/pool.js';
import { getTenantContext } from '../../context/tenantContext.js';

export const executionRouter = Router();

// Gated behind candidate_testing module entitlement
executionRouter.use(requireModule('candidate_testing'));

// 1. Interactive direct run (Priority interactive execution)
executionRouter.post('/execution/run', async (req, res) => {
  const { language, code, files, entrypoint, stdin, sqlParams, attemptId, questionVersionId } = req.body;
  if (!language) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'language is required.' } });
  }

  try {
    const result = await executeCodeDirectly({
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
  } catch (err: any) {
    res.status(400).json({ error: { code: 'EXECUTION_FAILED', message: err.message } });
  }
});

// 2. Submit for batch asynchronous grading
executionRouter.post('/execution/submit', auditMiddleware('attempt.code_submit', 'execution'), async (req, res) => {
  const { language, code, files, attemptId, questionVersionId, sqlParams } = req.body;
  if (!language) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'language is required.' } });
  }

  try {
    const result = await submitForAsyncGrading({
      language,
      code,
      files,
      attemptId,
      questionVersionId,
      sqlParams,
      isSubmission: true
    });
    res.status(202).json({ data: result });
  } catch (err: any) {
    res.status(429).json({ error: { code: 'SUBMIT_FAILED', message: err.message } });
  }
});

// 3. Check status of enqueued batch job
executionRouter.get('/execution/jobs/:id', async (req, res) => {
  const ctx = getTenantContext()!;
  try {
    const { rows } = await superuserPool.query(
      `SELECT id, priority, status, attempts, error_message, created_at, completed_at
       FROM jobs
       WHERE id = $1 AND (payload->>'tenantId') = $2`,
      [req.params.id, ctx.tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Execution job not found.' } });
    }

    res.json({ data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});
