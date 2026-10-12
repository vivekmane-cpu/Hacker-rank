import { Router } from 'express';
import { getTenantContext, tenantQuery } from '../../context/tenantContext.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditMiddleware } from '../../middleware/auditLogger.js';

export const hiringControlsRouter = Router();

hiringControlsRouter.get('/hiring-controls', async (_req, res) => {
  const ctx = getTenantContext()!;
  try {
    const { rows } = await tenantQuery(`
      SELECT branding, region, billing_status FROM tenants WHERE id = $1
    `, [ctx.tenantId]);

    const branding = rows[0]?.branding || {};
    const controls = {
      defaultAiPolicy: branding.defaultAiPolicy || 'guarded',
      defaultPassScore: branding.defaultPassScore || 70,
      defaultDurationMinutes: branding.defaultDurationMinutes || 60,
      integritySettings: branding.integritySettings || {
        secureMode: false,
        trackTabSwitches: true,
        trackPaste: true,
        codeSimilarity: true,
        aiCodeDetection: true,
        cameraCheck: false,
        screenshotMonitoring: false
      },
      accommodationsPolicy: branding.accommodationsPolicy || {
        allowAccessibleTextMode: true,
        maxExtraTimeMultiplier: 2.0
      }
    };
    res.json({ data: controls });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

hiringControlsRouter.put('/hiring-controls', requirePermission('settings:manage'), auditMiddleware('settings.update_hiring_controls', 'tenant'), async (req, res) => {
  const ctx = getTenantContext()!;
  const newControls = req.body;

  try {
    const { rows: current } = await tenantQuery('SELECT branding FROM tenants WHERE id = $1', [ctx.tenantId]);
    const branding = current[0]?.branding || {};

    const updatedBranding = {
      ...branding,
      ...newControls
    };

    await tenantQuery('UPDATE tenants SET branding = $1 WHERE id = $2', [updatedBranding, ctx.tenantId]);

    res.json({ data: newControls, message: 'Hiring controls successfully updated.' });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
  }
});
