"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationsRouter = void 0;
const express_1 = require("express");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
const tenantContext_js_1 = require("../../context/tenantContext.js");
const webhookService_js_1 = require("./webhookService.js");
const widgetService_js_1 = require("./widgetService.js");
const atsAdapters_js_1 = require("./atsAdapters.js");
const meteringService_js_1 = require("./meteringService.js");
exports.integrationsRouter = (0, express_1.Router)();
// ==========================================
// 1. WEBHOOK MANAGEMENT
// ==========================================
// Create Webhook Endpoint
exports.integrationsRouter.post('/webhooks', (0, rbac_js_1.requirePermission)('webhooks:manage'), (0, auditLogger_js_1.auditMiddleware)('webhook.create', 'webhook_endpoint'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const result = await (0, webhookService_js_1.createWebhookEndpoint)(ctx.tenantId, req.body);
        res.status(201).json({ data: result });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'WEBHOOK_CREATE_ERROR', message: err.message } });
    }
});
// List Webhook Endpoints
exports.integrationsRouter.get('/webhooks', (0, rbac_js_1.requirePermission)('webhooks:manage'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const endpoints = await (0, webhookService_js_1.listWebhookEndpoints)(ctx.tenantId);
        res.json({ data: endpoints });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'WEBHOOK_LIST_ERROR', message: err.message } });
    }
});
// List Webhook Deliveries
exports.integrationsRouter.get('/webhooks/:id/deliveries', (0, rbac_js_1.requirePermission)('webhooks:manage'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const endpointId = req.params.id;
        const deliveries = await (0, webhookService_js_1.listWebhookDeliveries)(ctx.tenantId, endpointId);
        res.json({ data: deliveries });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'DELIVERIES_LIST_ERROR', message: err.message } });
    }
});
// Test Webhook Dispatch
exports.integrationsRouter.post('/webhooks/:id/test', (0, rbac_js_1.requirePermission)('webhooks:manage'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const deliveries = await (0, webhookService_js_1.dispatchWebhookEvent)(ctx.tenantId, 'ping', {
            event: 'ping',
            message: 'Kombee Assess webhook test verification',
            timestamp: new Date().toISOString()
        });
        res.json({ data: { message: 'Test event dispatched', deliveries } });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'TEST_DISPATCH_ERROR', message: err.message } });
    }
});
// ==========================================
// 2. CANDIDATE EMBEDDABLE WIDGET
// ==========================================
// Get Widget Snippet & Embed Code
exports.integrationsRouter.get('/widget/snippet/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const { height, width, containerId } = req.query;
        const snippet = (0, widgetService_js_1.generateWidgetSnippet)(token, {
            height: height,
            width: width,
            containerId: containerId
        });
        res.json({ data: snippet });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'SNIPPET_ERROR', message: err.message } });
    }
});
// Get Widget Config for Embed Player
exports.integrationsRouter.get('/widget/config', async (req, res) => {
    try {
        const token = req.query.token || req.headers['x-candidate-token'];
        if (!token)
            return res.status(400).json({ error: { code: 'MISSING_TOKEN' } });
        const config = await (0, widgetService_js_1.getWidgetConfig)(token);
        res.json({ data: config });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'WIDGET_CONFIG_ERROR', message: err.message } });
    }
});
// ==========================================
// 3. ATS ADAPTERS (Greenhouse & Lever)
// ==========================================
// Greenhouse Inbound Webhook
exports.integrationsRouter.post('/integrations/ats/greenhouse/webhook', async (req, res) => {
    try {
        const event = atsAdapters_js_1.GreenhouseAdapter.parseInboundWebhook(req.headers, req.body);
        res.json({
            data: {
                received: true,
                event
            }
        });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'GREENHOUSE_ERROR', message: err.message } });
    }
});
// Lever Inbound Webhook
exports.integrationsRouter.post('/integrations/ats/lever/webhook', async (req, res) => {
    try {
        const event = atsAdapters_js_1.LeverAdapter.parseInboundWebhook(req.headers, req.body);
        res.json({
            data: {
                received: true,
                event
            }
        });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'LEVER_ERROR', message: err.message } });
    }
});
// Export Result to ATS
exports.integrationsRouter.post('/integrations/ats/export', (0, rbac_js_1.requirePermission)('reviews:read'), async (req, res) => {
    try {
        const { ats, candidateData, result } = req.body;
        let formatted;
        if (ats === 'greenhouse') {
            formatted = atsAdapters_js_1.GreenhouseAdapter.formatOutboundResult(candidateData, result);
        }
        else if (ats === 'lever') {
            formatted = atsAdapters_js_1.LeverAdapter.formatOutboundResult(candidateData, result);
        }
        else {
            return res.status(400).json({ error: { code: 'UNKNOWN_ATS', message: 'Supported ATS: greenhouse, lever' } });
        }
        res.json({ data: formatted });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'EXPORT_ERROR', message: err.message } });
    }
});
// ==========================================
// 4. USAGE METERING & BILLING ROLL-UP
// ==========================================
// Get Tenant Usage Roll-up
exports.integrationsRouter.get('/billing/usage', (0, rbac_js_1.requirePermission)('billing:read'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const { startDate, endDate } = req.query;
        const usage = await (0, meteringService_js_1.getTenantUsageRollup)(ctx.tenantId, startDate, endDate);
        res.json({ data: usage });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'USAGE_ERROR', message: err.message } });
    }
});
// Get Billing Tier & Quota Summary
exports.integrationsRouter.get('/billing/summary', (0, rbac_js_1.requirePermission)('billing:read'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const summary = await (0, meteringService_js_1.getBillingSummary)(ctx.tenantId);
        res.json({ data: summary });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'BILLING_SUMMARY_ERROR', message: err.message } });
    }
});
// Record Usage Event (API / Service SDK)
exports.integrationsRouter.post('/billing/usage', (0, rbac_js_1.requirePermission)('billing:read'), async (req, res) => {
    try {
        const ctx = (0, tenantContext_js_1.getTenantContext)();
        if (!ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
        const recorded = await (0, meteringService_js_1.recordUsageEvent)(ctx.tenantId, req.body);
        res.status(201).json({ data: recorded });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'RECORD_USAGE_ERROR', message: err.message } });
    }
});
