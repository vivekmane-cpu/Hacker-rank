import { Router } from 'express';
import { requireModule } from '../../middleware/entitlement.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditMiddleware } from '../../middleware/auditLogger.js';
import { getTenantContext } from '../../context/tenantContext.js';
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
  listWebhookDeliveries,
  dispatchWebhookEvent
} from './webhookService.js';
import { getWidgetConfig, generateWidgetSnippet } from './widgetService.js';
import { GreenhouseAdapter, LeverAdapter } from './atsAdapters.js';
import {
  recordUsageEvent,
  getTenantUsageRollup,
  getBillingSummary
} from './meteringService.js';

export const integrationsRouter = Router();

// ==========================================
// 1. WEBHOOK MANAGEMENT
// ==========================================

// Create Webhook Endpoint
integrationsRouter.post(
  '/webhooks',
  requirePermission('webhooks:manage'),
  auditMiddleware('webhook.create', 'webhook_endpoint'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const result = await createWebhookEndpoint(ctx.tenantId, req.body);
      res.status(201).json({ data: result });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'WEBHOOK_CREATE_ERROR', message: err.message } });
    }
  }
);

// List Webhook Endpoints
integrationsRouter.get(
  '/webhooks',
  requirePermission('webhooks:manage'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const endpoints = await listWebhookEndpoints(ctx.tenantId);
      res.json({ data: endpoints });
    } catch (err: any) {
      res.status(500).json({ error: { code: 'WEBHOOK_LIST_ERROR', message: err.message } });
    }
  }
);

// List Webhook Deliveries
integrationsRouter.get(
  '/webhooks/:id/deliveries',
  requirePermission('webhooks:manage'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const endpointId = req.params.id as string;
      const deliveries = await listWebhookDeliveries(ctx.tenantId, endpointId);
      res.json({ data: deliveries });
    } catch (err: any) {
      res.status(500).json({ error: { code: 'DELIVERIES_LIST_ERROR', message: err.message } });
    }
  }
);

// Test Webhook Dispatch
integrationsRouter.post(
  '/webhooks/:id/test',
  requirePermission('webhooks:manage'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const deliveries = await dispatchWebhookEvent(ctx.tenantId, 'ping', {
        event: 'ping',
        message: 'Kombee Assess webhook test verification',
        timestamp: new Date().toISOString()
      });
      res.json({ data: { message: 'Test event dispatched', deliveries } });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'TEST_DISPATCH_ERROR', message: err.message } });
    }
  }
);

// ==========================================
// 2. CANDIDATE EMBEDDABLE WIDGET
// ==========================================

// Get Widget Snippet & Embed Code
integrationsRouter.get(
  '/widget/snippet/:token',
  async (req, res) => {
    try {
      const token = req.params.token as string;
      const { height, width, containerId } = req.query;
      const snippet = generateWidgetSnippet(token, {
        height: height as string,
        width: width as string,
        containerId: containerId as string
      });
      res.json({ data: snippet });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'SNIPPET_ERROR', message: err.message } });
    }
  }
);

// Get Widget Config for Embed Player
integrationsRouter.get(
  '/widget/config',
  async (req, res) => {
    try {
      const token = (req.query.token as string) || (req.headers['x-candidate-token'] as string);
      if (!token) return res.status(400).json({ error: { code: 'MISSING_TOKEN' } });

      const config = await getWidgetConfig(token);
      res.json({ data: config });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'WIDGET_CONFIG_ERROR', message: err.message } });
    }
  }
);

// ==========================================
// 3. ATS ADAPTERS (Greenhouse & Lever)
// ==========================================

// Greenhouse Inbound Webhook
integrationsRouter.post(
  '/integrations/ats/greenhouse/webhook',
  async (req, res) => {
    try {
      const event = GreenhouseAdapter.parseInboundWebhook(req.headers, req.body);
      res.json({
        data: {
          received: true,
          event
        }
      });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'GREENHOUSE_ERROR', message: err.message } });
    }
  }
);

// Lever Inbound Webhook
integrationsRouter.post(
  '/integrations/ats/lever/webhook',
  async (req, res) => {
    try {
      const event = LeverAdapter.parseInboundWebhook(req.headers, req.body);
      res.json({
        data: {
          received: true,
          event
        }
      });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'LEVER_ERROR', message: err.message } });
    }
  }
);

// Export Result to ATS
integrationsRouter.post(
  '/integrations/ats/export',
  requirePermission('reviews:read'),
  async (req, res) => {
    try {
      const { ats, candidateData, result } = req.body;
      let formatted;
      if (ats === 'greenhouse') {
        formatted = GreenhouseAdapter.formatOutboundResult(candidateData, result);
      } else if (ats === 'lever') {
        formatted = LeverAdapter.formatOutboundResult(candidateData, result);
      } else {
        return res.status(400).json({ error: { code: 'UNKNOWN_ATS', message: 'Supported ATS: greenhouse, lever' } });
      }

      res.json({ data: formatted });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'EXPORT_ERROR', message: err.message } });
    }
  }
);

// ==========================================
// 4. USAGE METERING & BILLING ROLL-UP
// ==========================================

// Get Tenant Usage Roll-up
integrationsRouter.get(
  '/billing/usage',
  requirePermission('billing:read'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const { startDate, endDate } = req.query;
      const usage = await getTenantUsageRollup(
        ctx.tenantId,
        startDate as string,
        endDate as string
      );
      res.json({ data: usage });
    } catch (err: any) {
      res.status(500).json({ error: { code: 'USAGE_ERROR', message: err.message } });
    }
  }
);

// Get Billing Tier & Quota Summary
integrationsRouter.get(
  '/billing/summary',
  requirePermission('billing:read'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const summary = await getBillingSummary(ctx.tenantId);
      res.json({ data: summary });
    } catch (err: any) {
      res.status(500).json({ error: { code: 'BILLING_SUMMARY_ERROR', message: err.message } });
    }
  }
);

// Record Usage Event (API / Service SDK)
integrationsRouter.post(
  '/billing/usage',
  requirePermission('billing:read'),
  async (req, res) => {
    try {
      const ctx = getTenantContext();
      if (!ctx) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

      const recorded = await recordUsageEvent(ctx.tenantId, req.body);
      res.status(201).json({ data: recorded });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'RECORD_USAGE_ERROR', message: err.message } });
    }
  }
);
