import { Router } from 'express';
import { getTenantContext, tenantQuery } from '../../context/tenantContext.js';
import { superuserPool } from '../../db/pool.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditMiddleware } from '../../middleware/auditLogger.js';

export const supportRouter = Router();

supportRouter.get('/support-grants', requirePermission('settings:manage'), async (_req, res) => {
  try {
    const { rows } = await tenantQuery(`
      SELECT sg.id, sg.reason, sg.expires_at, sg.revoked_at, sg.created_at,
             u_by.email as granted_by_email, u_to.email as granted_to_email
      FROM support_grants sg
      JOIN users u_by ON u_by.id = sg.granted_by_user_id
      JOIN users u_to ON u_to.id = sg.granted_to_user_id
      ORDER BY sg.created_at DESC
    `);
    res.json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

supportRouter.post('/support-grants', requirePermission('settings:manage'), auditMiddleware('support.grant', 'support_grant'), async (req, res) => {
  const { grantedToEmail, durationHours, reason } = req.body;
  const ctx = getTenantContext()!;

  if (!grantedToEmail || !reason) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'grantedToEmail and reason are required.' } });
  }

  const hours = Math.min(Math.max(Number(durationHours) || 8, 1), 72); // 1 - 72 hours

  try {
    const { rows: staffUser } = await superuserPool.query('SELECT id FROM users WHERE email = $1', [grantedToEmail.toLowerCase().trim()]);
    if (staffUser.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Support user not found.' } });
    }

    const { rows } = await tenantQuery(
      `INSERT INTO support_grants (tenant_id, granted_by_user_id, granted_to_user_id, reason, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5 || ' hours')::interval)
       RETURNING id, reason, expires_at, created_at`,
      [ctx.tenantId, ctx.userId || staffUser[0].id, staffUser[0].id, reason, hours.toString()]
    );

    res.status(201).json({
      data: rows[0],
      message: `Support access grant active for ${hours} hours. Access is strictly audited.`
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INSERT_ERROR', message: err.message } });
  }
});

supportRouter.delete('/support-grants/:id', requirePermission('settings:manage'), auditMiddleware('support.revoke', 'support_grant'), async (req, res) => {
  try {
    const { rows } = await tenantQuery(
      `UPDATE support_grants SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL RETURNING id, revoked_at`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Grant not found or already revoked.' } });
    }
    res.json({ data: rows[0], message: 'Support grant revoked immediately.' });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
  }
});
