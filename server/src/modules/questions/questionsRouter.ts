import { Router } from 'express';
import { requireModule } from '../../middleware/entitlement.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditMiddleware } from '../../middleware/auditLogger.js';
import { questionTypeRegistry } from './typeRegistry.js';
import {
  createQuestion,
  publishQuestionVersion,
  editQuestion,
  searchQuestions
} from './questionsService.js';
import { runLeakScanForQuestion, reviewLeakFinding } from './leakScanner.js';
import { superuserPool } from '../../db/pool.js';
import { getTenantContext } from '../../context/tenantContext.js';

export const questionsRouter = Router();

// Gated behind question_bank module entitlement
questionsRouter.use(requireModule('question_bank'));

// 1. Get question types registry definition
questionsRouter.get('/questions/types', (_req, res) => {
  const types = Object.values(questionTypeRegistry).map(t => ({
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
questionsRouter.get('/questions', async (req, res) => {
  const { nlQuery, type, difficulty, status, skillId } = req.query;
  try {
    const questions = await searchQuestions({
      nlQuery: nlQuery as string,
      type: type as string,
      difficulty: difficulty as string,
      status: status as string,
      skillId: skillId as string
    });
    res.json({ data: questions });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SEARCH_ERROR', message: err.message } });
  }
});

// 3. Create draft question
questionsRouter.post('/questions', requirePermission('questions:write'), auditMiddleware('question.create', 'question'), async (req, res) => {
  try {
    const result = await createQuestion(req.body);
    res.status(201).json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'CREATE_ERROR', message: err.message } });
  }
});

// 4. Edit question (draft update or creates new version if published)
questionsRouter.put('/questions/:id', requirePermission('questions:write'), auditMiddleware('question.edit', 'question'), async (req, res) => {
  try {
    const result = await editQuestion(req.params.id as string, req.body);
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'EDIT_ERROR', message: err.message } });
  }
});

// 5. Publish question version with validation gates
questionsRouter.post('/questions/:id/versions/:version/publish', requirePermission('questions:publish'), auditMiddleware('question.publish', 'question'), async (req, res) => {
  const { id, version } = req.params;
  try {
    const published = await publishQuestionVersion(id as string, Number(version));
    res.json({
      data: published,
      message: `Version ${version} published and permanently locked.`
    });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'PUBLISH_GATE_FAILED', message: err.message } });
  }
});

// 6. Trigger leak scan for a published question
questionsRouter.post('/questions/:id/scan-leak', async (req, res) => {
  try {
    const result = await runLeakScanForQuestion(req.params.id);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SCAN_ERROR', message: err.message } });
  }
});

// 7. Leak findings human review queue
questionsRouter.get('/questions/leaks/queue', async (_req, res) => {
  try {
    const { rows } = await superuserPool.query(`
      SELECT lf.id, lf.question_id, qv.title as question_title,
             lf.source_url, lf.snippet, lf.confidence, lf.status, lf.detected_at
      FROM leak_findings lf
      JOIN question_versions qv ON qv.question_id = lf.question_id AND qv.status = 'published'
      WHERE lf.status = 'pending'
      ORDER BY lf.confidence DESC
    `);
    res.json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

// 8. Human review action for leak finding (confirmed_leak -> retires question, or dismissed)
questionsRouter.post('/questions/leaks/:id/review', requirePermission('questions:publish'), auditMiddleware('question.leak_review', 'leak_finding'), async (req, res) => {
  const { action, note } = req.body;
  const ctx = getTenantContext()!;
  if (!action || !['confirmed_leak', 'dismissed'].includes(action)) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: "Action must be 'confirmed_leak' or 'dismissed'." } });
  }
  try {
    const result = await reviewLeakFinding(req.params.id as string, ctx.userId || ctx.tenantId, action, note || '');
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'REVIEW_ERROR', message: err.message } });
  }
});
