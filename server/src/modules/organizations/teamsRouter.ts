import { Router } from 'express';
import { getTenantContext, tenantQuery } from '../../context/tenantContext.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditMiddleware } from '../../middleware/auditLogger.js';

export const teamsRouter = Router();

teamsRouter.get('/teams', async (_req, res) => {
  try {
    const { rows } = await tenantQuery(`
      SELECT t.id, t.name, t.description, t.created_at,
             COUNT(m.id)::int as member_count
      FROM teams t
      LEFT JOIN memberships m ON m.team_id = t.id
      GROUP BY t.id, t.name, t.description, t.created_at
      ORDER BY t.name ASC
    `);
    res.json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

teamsRouter.post('/teams', requirePermission('teams:manage'), auditMiddleware('team.create', 'team'), async (req, res) => {
  const { name, description } = req.body;
  const ctx = getTenantContext()!;

  if (!name) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Team name is required.' } });
  }

  try {
    const { rows } = await tenantQuery(
      `INSERT INTO teams (tenant_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at`,
      [ctx.tenantId, name, description || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INSERT_ERROR', message: err.message } });
  }
});

teamsRouter.put('/teams/:id', requirePermission('teams:manage'), auditMiddleware('team.update', 'team'), async (req, res) => {
  const { name, description } = req.body;
  try {
    const { rows } = await tenantQuery(
      `UPDATE teams SET name = COALESCE($1, name), description = COALESCE($2, description)
       WHERE id = $3
       RETURNING id, name, description, created_at`,
      [name, description, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found.' } });
    }
    res.json({ data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
  }
});

teamsRouter.delete('/teams/:id', requirePermission('teams:manage'), auditMiddleware('team.delete', 'team'), async (req, res) => {
  try {
    await tenantQuery('DELETE FROM teams WHERE id = $1', [req.params.id]);
    res.json({ message: 'Team deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'DELETE_ERROR', message: err.message } });
  }
});
