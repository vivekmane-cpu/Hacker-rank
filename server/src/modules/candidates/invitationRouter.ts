import { Router } from 'express';
import { requireModule } from '../../middleware/entitlement.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditMiddleware } from '../../middleware/auditLogger.js';
import { getTenantContext } from '../../context/tenantContext.js';
import {
  createInvitation,
  listInvitations,
  revokeInvitation
} from './invitationService.js';

export const invitationRouter = Router();

// Gated behind candidate_testing module
invitationRouter.use(requireModule('candidate_testing'));

// 1. Create Invitation & Candidate
invitationRouter.post(
  '/invitations',
  requirePermission('candidates:invite'),
  auditMiddleware('invitation.create', 'invitation'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const result = await createInvitation(ctx.tenantId, req.body);
      res.status(201).json({ data: result });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'INVITATION_CREATE_ERROR', message: err.message } });
    }
  }
);

// 2. List Invitations
invitationRouter.get(
  '/invitations',
  requirePermission('candidates:read'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const { assessmentId } = req.query;
      const list = await listInvitations(ctx.tenantId, assessmentId as string);
      res.json({ data: list });
    } catch (err: any) {
      res.status(500).json({ error: { code: 'LIST_ERROR', message: err.message } });
    }
  }
);

// 3. Revoke Invitation
invitationRouter.post(
  '/invitations/:id/revoke',
  requirePermission('candidates:invite'),
  auditMiddleware('invitation.revoke', 'invitation'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const id = req.params.id as string;
      const result = await revokeInvitation(ctx.tenantId, id);
      res.json({ data: result });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'REVOKE_ERROR', message: err.message } });
    }
  }
);
