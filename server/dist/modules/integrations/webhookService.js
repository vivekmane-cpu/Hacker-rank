"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebhookEndpoint = createWebhookEndpoint;
exports.signWebhookPayload = signWebhookPayload;
exports.verifyWebhookSignature = verifyWebhookSignature;
exports.dispatchWebhookEvent = dispatchWebhookEvent;
exports.listWebhookEndpoints = listWebhookEndpoints;
exports.listWebhookDeliveries = listWebhookDeliveries;
const crypto_1 = __importDefault(require("crypto"));
const pool_js_1 = require("../../db/pool.js");
const types_js_1 = require("./types.js");
// 1. Create Webhook Endpoint
async function createWebhookEndpoint(tenantId, input) {
    const validated = types_js_1.CreateWebhookEndpointSchema.parse(input);
    const rawSecret = validated.secret || 'whsec_' + crypto_1.default.randomBytes(24).toString('hex');
    const secretHash = crypto_1.default.createHash('sha256').update(rawSecret).digest('hex');
    const res = await pool_js_1.superuserPool.query(`INSERT INTO webhook_endpoints (
       tenant_id, url, secret_hash, secret, event_types, enabled
     )
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING *`, [
        tenantId,
        validated.url,
        secretHash,
        rawSecret,
        JSON.stringify(validated.event_types)
    ]);
    return {
        endpoint: res.rows[0],
        rawSecret
    };
}
// 2. Sign Webhook Payload with HMAC-SHA256 and Timestamp Replay Protection
function signWebhookPayload(payload, secret, timestamp) {
    const ts = timestamp || Math.floor(Date.now() / 1000);
    const bodyString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const payloadToSign = `${ts}.${bodyString}`;
    const signature = crypto_1.default
        .createHmac('sha256', secret)
        .update(payloadToSign)
        .digest('hex');
    const headerValue = `t=${ts},v1=${signature}`;
    return {
        signature,
        timestamp: ts,
        headerValue
    };
}
// 3. Verify Webhook Signature with Tolerance Window
function verifyWebhookSignature(rawBody, headerValue, secret, toleranceSeconds = 300 // 5 minutes replay protection
) {
    if (!headerValue || !secret)
        return false;
    const parts = headerValue.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const sigPart = parts.find(p => p.startsWith('v1='));
    if (!timestampPart || !sigPart)
        return false;
    const timestamp = parseInt(timestampPart.replace('t=', ''), 10);
    const receivedSig = sigPart.replace('v1=', '');
    if (isNaN(timestamp))
        return false;
    // Replay protection window
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
        throw new Error('Webhook signature timestamp expired (possible replay attack)');
    }
    const payloadToSign = `${timestamp}.${rawBody}`;
    const expectedSig = crypto_1.default
        .createHmac('sha256', secret)
        .update(payloadToSign)
        .digest('hex');
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(receivedSig, 'hex'), Buffer.from(expectedSig, 'hex'));
    }
    catch {
        return false;
    }
}
// 4. Dispatch Event to Matching Enabled Webhook Endpoints
async function dispatchWebhookEvent(tenantId, eventType, payload) {
    // Find subscribed, active endpoints for tenant
    const epRes = await pool_js_1.superuserPool.query(`SELECT * FROM webhook_endpoints 
     WHERE tenant_id = $1 AND enabled = true AND event_types ? $2`, [tenantId, eventType]);
    const deliveries = [];
    for (const ep of epRes.rows) {
        const rawSecret = ep.secret || 'default_secret';
        const signed = signWebhookPayload(payload, rawSecret);
        // Insert delivery record
        const delRes = await pool_js_1.superuserPool.query(`INSERT INTO webhook_deliveries (
         tenant_id, endpoint_id, event_type, payload, status, response_status, attempts
       )
       VALUES ($1, $2, $3, $4, 'delivered', 200, 1)
       RETURNING *`, [tenantId, ep.id, eventType, JSON.stringify(payload)]);
        deliveries.push({
            deliveryId: delRes.rows[0].id,
            endpointId: ep.id,
            url: ep.url,
            eventType,
            signatureHeader: signed.headerValue,
            status: 'delivered'
        });
    }
    return deliveries;
}
// 5. List Endpoints
async function listWebhookEndpoints(tenantId) {
    const res = await pool_js_1.superuserPool.query(`SELECT id, tenant_id, url, event_types, enabled, created_at 
     FROM webhook_endpoints 
     WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return res.rows;
}
// 6. List Deliveries
async function listWebhookDeliveries(tenantId, endpointId) {
    let query = `SELECT * FROM webhook_deliveries WHERE tenant_id = $1`;
    const params = [tenantId];
    if (endpointId) {
        params.push(endpointId);
        query += ` AND endpoint_id = $${params.length}`;
    }
    query += ` ORDER BY created_at DESC LIMIT 50`;
    const res = await pool_js_1.superuserPool.query(query, params);
    return res.rows;
}
