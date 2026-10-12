import { Router } from 'express';
import { requireModule } from '../../middleware/entitlement.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditMiddleware } from '../../middleware/auditLogger.js';
import { getTenantContext } from '../../context/tenantContext.js';
import {
  createAssessment,
  getAssessment,
  listAssessments,
  updateDraftVersion,
  createDraftVersion,
  addSection,
  deleteSection,
  createPool,
  addQuestionsToPool,
  createVariant,
  createRoutingRule,
  evaluateRouting,
  publishAssessmentVersion,
  sampleQuestionsForCandidate
} from './assessmentService.js';

export const assessmentRouter = Router();

// Module entitlement guard
assessmentRouter.use(requireModule('assessments'));

// 1. Create Assessment + Draft v1
assessmentRouter.post(
  '/assessments',
  requirePermission('assessments:write'),
  auditMiddleware('assessment.create', 'assessment'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const result = await createAssessment(ctx.tenantId, req.body);
      res.status(201).json({ data: result });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'CREATE_ERROR', message: err.message } });
    }
  }
);

// 2. List Assessments
assessmentRouter.get(
  '/assessments',
  requirePermission('assessments:read'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const { status, visibility } = req.query;
      const list = await listAssessments(ctx.tenantId, {
        status: status as string,
        visibility: visibility as string
      });
      res.json({ data: list });
    } catch (err: any) {
      res.status(500).json({ error: { code: 'LIST_ERROR', message: err.message } });
    }
  }
);

// 3. Get Assessment Details
assessmentRouter.get(
  '/assessments/:id',
  requirePermission('assessments:read'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const id = req.params.id as string;
      const { versionId } = req.query;
      const details = await getAssessment(ctx.tenantId, id, versionId as string);
      res.json({ data: details });
    } catch (err: any) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }
  }
);

// 4. Update Draft Version
assessmentRouter.put(
  '/assessments/:id/versions/:versionId',
  requirePermission('assessments:write'),
  auditMiddleware('assessment.version_update', 'assessment'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const id = req.params.id as string;
      const versionId = req.params.versionId as string;
      const updated = await updateDraftVersion(
        ctx.tenantId,
        id,
        versionId,
        req.body
      );
      res.json({ data: updated });
    } catch (err: any) {
      const status = err.message.includes('IMMUTABLE_VERSION') ? 409 : 400;
      res.status(status).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
    }
  }
);

// 5. Fork / Create New Draft Version
assessmentRouter.post(
  '/assessments/:id/versions',
  requirePermission('assessments:write'),
  auditMiddleware('assessment.fork_version', 'assessment'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const id = req.params.id as string;
      const { sourceVersionId } = req.body;
      const newVersion = await createDraftVersion(ctx.tenantId, id, sourceVersionId);
      res.status(201).json({ data: newVersion });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'FORK_ERROR', message: err.message } });
    }
  }
);

// 6. Add Section to Version
assessmentRouter.post(
  '/assessments/:id/versions/:versionId/sections',
  requirePermission('assessments:write'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const versionId = req.params.versionId as string;
      const section = await addSection(ctx.tenantId, versionId, req.body);
      res.status(201).json({ data: section });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'SECTION_CREATE_ERROR', message: err.message } });
    }
  }
);

// 7. Delete Section
assessmentRouter.delete(
  '/assessments/:id/sections/:sectionId',
  requirePermission('assessments:write'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const sectionId = req.params.sectionId as string;
      const result = await deleteSection(ctx.tenantId, sectionId);
      res.json({ data: result });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'SECTION_DELETE_ERROR', message: err.message } });
    }
  }
);

// 8. Add Pool to Section
assessmentRouter.post(
  '/assessments/:id/sections/:sectionId/pools',
  requirePermission('assessments:write'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const sectionId = req.params.sectionId as string;
      const pool = await createPool(ctx.tenantId, sectionId, req.body);
      res.status(201).json({ data: pool });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'POOL_CREATE_ERROR', message: err.message } });
    }
  }
);

// 9. Add Questions to Pool
assessmentRouter.post(
  '/assessments/:id/pools/:poolId/questions',
  requirePermission('assessments:write'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const poolId = req.params.poolId as string;
      const { question_ids } = req.body;
      const result = await addQuestionsToPool(ctx.tenantId, poolId, question_ids);
      res.status(201).json({ data: result });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'POOL_QUESTIONS_ERROR', message: err.message } });
    }
  }
);

// 10. Create Variant
assessmentRouter.post(
  '/assessments/:id/versions/:versionId/variants',
  requirePermission('assessments:write'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const versionId = req.params.versionId as string;
      const variant = await createVariant(ctx.tenantId, versionId, req.body);
      res.status(201).json({ data: variant });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'VARIANT_CREATE_ERROR', message: err.message } });
    }
  }
);

// 11. Create Routing Rule
assessmentRouter.post(
  '/assessments/:id/versions/:versionId/routing-rules',
  requirePermission('assessments:write'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const versionId = req.params.versionId as string;
      const rule = await createRoutingRule(ctx.tenantId, versionId, req.body);
      res.status(201).json({ data: rule });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'ROUTING_RULE_ERROR', message: err.message } });
    }
  }
);

// 12. Evaluate Routing Rules
assessmentRouter.post(
  '/assessments/:id/versions/:versionId/evaluate-routing',
  requirePermission('assessments:read'),
  async (req, res) => {
    try {
      const versionId = req.params.versionId as string;
      const { candidate_attributes } = req.body;
      const targetVariantId = await evaluateRouting(versionId, candidate_attributes || {});
      res.json({ data: { targetVariantId } });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'ROUTING_EVAL_ERROR', message: err.message } });
    }
  }
);

// 13. Publish Assessment Version
assessmentRouter.post(
  '/assessments/:id/versions/:versionId/publish',
  requirePermission('assessments:publish'),
  auditMiddleware('assessment.publish', 'assessment'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const id = req.params.id as string;
      const versionId = req.params.versionId as string;
      const published = await publishAssessmentVersion(ctx.tenantId, id, versionId);
      res.json({ data: published });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'PUBLISH_GATE_FAILED', message: err.message } });
    }
  }
);

// 14. Sample Questions Manifest for Version
assessmentRouter.get(
  '/assessments/:id/versions/:versionId/sample',
  requirePermission('assessments:read'),
  async (req, res) => {
    try {
      const versionId = req.params.versionId as string;
      const { variantId } = req.query;
      const manifest = await sampleQuestionsForCandidate(versionId, variantId as string);
      res.json({ data: manifest });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'SAMPLE_ERROR', message: err.message } });
    }
  }
);
