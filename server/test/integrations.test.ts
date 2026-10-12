import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { superuserPool, appPool } from '../src/db/pool.js';
import {
  signWebhookPayload,
  verifyWebhookSignature
} from '../src/modules/integrations/webhookService.js';

describe('Kombee Assess - Integrations, Webhooks, ATS, Widget & Metering Suite', () => {
  let ownerToken: string;
  let tenantId: string;
  let testInvitationToken: string;
  let webhookEndpointId: string;
  let webhookSecret: string;

  beforeAll(async () => {
    // 1. Log in Acme Owner
    const ownerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });
    ownerToken = ownerRes.body.token;
    tenantId = ownerRes.body.tenant.id;

    // 2. Create question & assessment to generate an invitation token
    const qRes = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'multiple_choice',
        title: 'Networking Basics',
        description: 'What is DNS?',
        difficulty: 'easy',
        content: {
          isMultiSelect: false,
          options: [
            { id: '1', text: 'Domain Name System', isCorrect: true },
            { id: '2', text: 'Dynamic Naming System', isCorrect: false }
          ]
        }
      });
    const qId = qRes.body.data.id;
    await request(app)
      .post(`/api/v1/questions/${qId}/versions/1/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const aRes = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Infrastructure Engineering' });
    const aId = aRes.body.data.assessment.id;
    const vId = aRes.body.data.version.id;

    const sRes = await request(app)
      .post(`/api/v1/assessments/${aId}/versions/${vId}/sections`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Section 1' });

    const pRes = await request(app)
      .post(`/api/v1/assessments/${aId}/sections/${sRes.body.data.id}/pools`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Pool 1', select_count: 1 });

    await request(app)
      .post(`/api/v1/assessments/${aId}/pools/${pRes.body.data.id}/questions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ question_ids: [qId] });

    await request(app)
      .post(`/api/v1/assessments/${aId}/versions/${vId}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const invRes = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        assessment_id: aId,
        candidate: {
          first_name: 'Elena',
          last_name: 'Rostova',
          email: `elena.${Date.now()}@example.com`
        }
      });
    testInvitationToken = invRes.body.data.rawToken;
  });

  afterAll(async () => {
    await appPool.end();
    await superuserPool.end();
  });

  // 1. Webhook Endpoint Registration & Delivery Dispatch
  it('1. Registers webhook endpoint with HMAC secret and dispatches signed events', async () => {
    const createRes = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        url: 'https://webhook.site/kombee-test-receiver',
        event_types: ['attempt.completed', 'review.decided', 'ping']
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.endpoint).toBeDefined();
    expect(createRes.body.data.rawSecret).toBeDefined();
    expect(createRes.body.data.rawSecret).toMatch(/^whsec_/);

    webhookEndpointId = createRes.body.data.endpoint.id;
    webhookSecret = createRes.body.data.rawSecret;

    // Test ping dispatch
    const testRes = await request(app)
      .post(`/api/v1/webhooks/${webhookEndpointId}/test`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(testRes.status).toBe(200);
    expect(testRes.body.data.deliveries.length).toBeGreaterThanOrEqual(1);
    expect(testRes.body.data.deliveries[0].signatureHeader).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);

    // List deliveries
    const listDelRes = await request(app)
      .get(`/api/v1/webhooks/${webhookEndpointId}/deliveries`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(listDelRes.status).toBe(200);
    expect(listDelRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listDelRes.body.data[0].status).toBe('delivered');
  });

  // 2. HMAC-SHA256 Signature Verification & Replay Protection
  it('2. Enforces HMAC-SHA256 signature verification and timestamp replay protection', () => {
    const payload = { event: 'attempt.completed', attemptId: 'test-123', score: 88.5 };
    const rawBody = JSON.stringify(payload);
    const secret = 'whsec_test_secret_key_1234567890abcdef';

    // Sign
    const nowTs = Math.floor(Date.now() / 1000);
    const signed = signWebhookPayload(rawBody, secret, nowTs);
    expect(signed.headerValue).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);

    // Verify valid signature
    const isValid = verifyWebhookSignature(rawBody, signed.headerValue, secret);
    expect(isValid).toBe(true);

    // Tampered body fails verification
    const isTamperedValid = verifyWebhookSignature(JSON.stringify({ ...payload, score: 100 }), signed.headerValue, secret);
    expect(isTamperedValid).toBe(false);

    // Wrong secret fails verification
    const isWrongSecretValid = verifyWebhookSignature(rawBody, signed.headerValue, 'whsec_wrong_secret');
    expect(isWrongSecretValid).toBe(false);

    // Expired timestamp (> 300 seconds) is rejected
    const expiredTs = nowTs - 600; // 10 minutes ago
    const expiredSigned = signWebhookPayload(rawBody, secret, expiredTs);
    expect(() =>
      verifyWebhookSignature(rawBody, expiredSigned.headerValue, secret, 300)
    ).toThrow(/timestamp expired/i);
  });

  // 3. Embeddable Candidate Widget Snippet & Config
  it('3. Generates embeddable widget snippet and runtime config', async () => {
    // A. Generate snippet
    const snipRes = await request(app)
      .get(`/api/v1/widget/snippet/${testInvitationToken}?height=800px&width=100%`);

    expect(snipRes.status).toBe(200);
    expect(snipRes.body.data.iframeSnippet).toContain('<iframe');
    expect(snipRes.body.data.iframeSnippet).toContain(testInvitationToken);
    expect(snipRes.body.data.scriptSnippet).toContain('<script src=');

    // B. Get widget config
    const confRes = await request(app)
      .get(`/api/v1/widget/config?token=${testInvitationToken}`);

    expect(confRes.status).toBe(200);
    expect(confRes.body.data.assessmentTitle).toBe('Infrastructure Engineering');
    expect(confRes.body.data.candidateName).toBe('Elena Rostova');
    expect(confRes.body.data.theme.primaryColor).toBeDefined();
  });

  // 4. Greenhouse ATS Adapter
  it('4. Parses Greenhouse inbound webhooks and formats outbound candidate scorecards', async () => {
    // Inbound Greenhouse stage change webhook
    const inboundPayload = {
      action: 'candidate_stage_change',
      payload: {
        application: {
          id: 987654,
          candidate: {
            id: 12345,
            first_name: 'David',
            last_name: 'Hassel',
            email: 'david.hassel@example.com'
          },
          current_stage: { name: 'Technical Assessment' }
        }
      }
    };

    const inRes = await request(app)
      .post('/api/v1/integrations/ats/greenhouse/webhook')
      .send(inboundPayload);

    expect(inRes.status).toBe(200);
    expect(inRes.body.data.event.ats).toBe('greenhouse');
    expect(inRes.body.data.event.candidateEmail).toBe('david.hassel@example.com');
    expect(inRes.body.data.event.candidateName).toBe('David Hassel');

    // Outbound scorecard export
    const outRes = await request(app)
      .post('/api/v1/integrations/ats/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ats: 'greenhouse',
        candidateData: { applicationId: '987654', candidateName: 'David Hassel' },
        result: { score: 92.0, passScore: 70, passed: true, reportUrl: 'https://kombee.io/report/123' }
      });

    expect(outRes.status).toBe(200);
    expect(outRes.body.data.ats).toBe('greenhouse');
    expect(outRes.body.data.payload.overall_recommendation).toBe('definitely_yes');
    expect(outRes.body.data.payload.ratings[0].rating).toBe('strong_yes');
  });

  // 5. Lever ATS Adapter
  it('5. Parses Lever inbound webhooks and formats outbound candidate feedback notes', async () => {
    // Inbound Lever webhook
    const leverInbound = {
      event: 'candidate_stage_change',
      data: {
        candidateId: 'cand_abc123',
        opportunityId: 'opp_xyz789',
        contact: {
          name: 'Sarah Connor',
          email: 'sarah.connor@sky.net'
        },
        stage: 'Technical Takehome'
      }
    };

    const inRes = await request(app)
      .post('/api/v1/integrations/ats/lever/webhook')
      .send(leverInbound);

    expect(inRes.status).toBe(200);
    expect(inRes.body.data.event.ats).toBe('lever');
    expect(inRes.body.data.event.candidateEmail).toBe('sarah.connor@sky.net');
    expect(inRes.body.data.event.externalApplicationId).toBe('opp_xyz789');

    // Outbound export
    const outRes = await request(app)
      .post('/api/v1/integrations/ats/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ats: 'lever',
        candidateData: { opportunityId: 'opp_xyz789', candidateName: 'Sarah Connor' },
        result: { score: 85.0, passScore: 70, passed: true }
      });

    expect(outRes.status).toBe(200);
    expect(outRes.body.data.ats).toBe('lever');
    expect(outRes.body.data.payload.fields.assessment_score).toBe(85.0);
    expect(outRes.body.data.payload.fields.assessment_passed).toBe(true);
  });

  // 6. Usage Metering & Append-Only Billing Roll-up
  it('6. Records billable usage events and aggregates billing roll-up metrics', async () => {
    // Record usage events
    await request(app)
      .post('/api/v1/billing/usage')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        module: 'candidate_testing',
        event_type: 'attempt.completed',
        quantity: 3
      });

    await request(app)
      .post('/api/v1/billing/usage')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        module: 'execution',
        event_type: 'code_execution.runtime_seconds',
        quantity: 120
      });

    // Query roll-up
    const rollupRes = await request(app)
      .get('/api/v1/billing/usage')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(rollupRes.status).toBe(200);
    expect(rollupRes.body.data.metrics.totalAttempts).toBeGreaterThanOrEqual(3);
    expect(rollupRes.body.data.metrics.totalComputeSeconds).toBeGreaterThanOrEqual(120);
    expect(rollupRes.body.data.estimatedCostUsd).toBeGreaterThan(0);

    // Database append-only trigger prohibits updating or deleting usage_events
    await expect(
      superuserPool.query(
        `UPDATE usage_events SET quantity = 0 WHERE tenant_id = $1`,
        [tenantId]
      )
    ).rejects.toThrow(/strictly append-only/i);
  });

  // 7. Tenant Billing Summary & Quotas
  it('7. Returns tenant billing tier, quota utilization, and invoice summary', async () => {
    const res = await request(app)
      .get('/api/v1/billing/summary')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tenant.billingStatus).toBe('paid');
    expect(res.body.data.tier.name).toBe('Enterprise Pro');
    expect(res.body.data.quotaRemaining).toBeDefined();
    expect(res.body.data.estimatedCostUsd).toBeGreaterThanOrEqual(0);
  });
});
