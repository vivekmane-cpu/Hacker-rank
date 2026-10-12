import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { superuserPool, appPool } from '../src/db/pool.js';

describe('Kombee Assess - End-to-End Enterprise Lifecycle & Absolute Rule Verification', () => {
  let ownerToken: string;
  let tenantId: string;
  let questionId: string;
  let assessmentId: string;
  let versionId: string;
  let sectionId: string;
  let poolId: string;
  let inviteRawToken: string;
  let candidateId: string;
  let attemptId: string;
  let resumeToken: string;

  beforeAll(async () => {
    // Authenticate as Acme Corp Owner
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });

    expect(loginRes.status).toBe(200);
    ownerToken = loginRes.body.token;
    tenantId = loginRes.body.tenant.id;
  });

  afterAll(async () => {
    await appPool.end();
    await superuserPool.end();
  });

  // Stage 1: Question Bank Authoring
  it('1. Authors question with test cases and publishes version', async () => {
    const qRes = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'coding',
        title: 'E2E Distributed Lock Implementation',
        description: 'Design a distributed lock acquire/release function with lease TTL.',
        difficulty: 'hard',
        visibility: 'tenant',
        content: {
          allowedLanguages: ['javascript'],
          starterCode: { javascript: 'function acquireLock(key, ttl) { return true; }' }
        },
        tests: [
          { testType: 'unit_test', input: 'lock_1, 1000', expectedOutput: 'true', isHidden: false },
          { testType: 'unit_test', input: 'lock_2, 2000', expectedOutput: 'true', isHidden: true }
        ],
        referenceSolution: {
          code: 'function acquireLock(key, ttl) { return true; }'
        }
      });

    expect(qRes.status).toBe(201);
    questionId = qRes.body.data.id;

    // Publish question version 1
    const pubRes = await request(app)
      .post(`/api/v1/questions/${questionId}/versions/1/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(pubRes.status).toBe(200);
  });

  // Stage 2: Assessment Builder, Sections & Version Publishing
  it('2. Builds multi-section assessment, variant pool, and publishes immutable version', async () => {
    // Create draft assessment
    const aRes = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Principal Systems Architect Takehome',
        description: 'End-to-end evaluation of distributed architectures',
        duration_minutes: 60,
        pass_score: 75
      });

    expect(aRes.status).toBe(201);
    assessmentId = aRes.body.data.assessment.id;
    versionId = aRes.body.data.version.id;

    // Add Section
    const sRes = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/versions/${versionId}/sections`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Distributed Concurrency',
        duration_minutes: 60
      });

    expect(sRes.status).toBe(201);
    sectionId = sRes.body.data.id;

    // Add Variant Pool
    const pRes = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/sections/${sectionId}/pools`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Concurrency Algorithms Pool',
        select_count: 1
      });

    expect(pRes.status).toBe(201);
    poolId = pRes.body.data.id;

    // Associate Question to Pool
    const addQRes = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/pools/${poolId}/questions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ question_ids: [questionId] });

    expect(addQRes.status).toBe(201);

    // Publish Version (enforces validation gates)
    const pubRes = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/versions/${versionId}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.status).toBe('published');
  });

  // Stage 3: Candidate Invitation
  it('3. Generates cryptographic invitation token for candidate', async () => {
    const invRes = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        assessment_id: assessmentId,
        candidate: {
          first_name: 'Marcus',
          last_name: 'Vance',
          email: `marcus.vance.${Date.now()}@example.com`
        },
        expires_in_hours: 48
      });

    expect(invRes.status).toBe(201);
    expect(invRes.body.data.rawToken).toBeDefined();
    expect(invRes.body.data.rawToken).toMatch(/^kbi_/);
    inviteRawToken = invRes.body.data.rawToken;
    candidateId = invRes.body.data.invitation.candidate_id;
  });

  // Stage 4: Candidate Verification & Consent
  it('4. Candidate verifies token, reviews environment disclosure, and logs consent', async () => {
    // Verify Token
    const verifyRes = await request(app)
      .get(`/api/v1/candidate/verify?token=${inviteRawToken}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.assessment_title).toBe('Principal Systems Architect Takehome');
    expect(verifyRes.body.data.first_name).toBe('Marcus');

    // Consent Screen
    const consentRes = await request(app)
      .post('/api/v1/candidate/consent')
      .set('x-candidate-token', inviteRawToken)
      .send({
        candidateId,
        consent_type: 'data_processing',
        consented: true,
        consent_text_version: 'v1.0'
      });

    expect(consentRes.status).toBe(201);
    expect(consentRes.body.data.consented).toBe(true);
  });

  // Stage 5: Candidate Test Session Start, Telemetry & Autosave
  it('5. Starts test attempt, captures window blur and paste events, and autosaves answer', async () => {
    const startRes = await request(app)
      .post('/api/v1/candidate/start')
      .set('x-candidate-token', inviteRawToken)
      .send({});

    expect(startRes.status).toBe(200);
    attemptId = startRes.body.data.attemptId;
    resumeToken = startRes.body.data.resumeToken;
    expect(resumeToken).toMatch(/^kbr_/);

    // Ingest Telemetry: Tab blur and paste events
    const ingestRes = await request(app)
      .post(`/api/v1/candidate/attempt/${attemptId}/events`)
      .set('x-candidate-token', inviteRawToken)
      .send({
        events: [
          { event_type: 'window.blur', event_data: { duration_ms: 5400 } },
          { event_type: 'clipboard.paste', event_data: { text_length: 145 } }
        ]
      });

    expect(ingestRes.status).toBe(201);
    expect(ingestRes.body.data.recorded).toBe(2);

    // Candidate Autosaves Answer
    const saveRes = await request(app)
      .post(`/api/v1/candidate/attempt/${attemptId}/autosave`)
      .set('x-candidate-token', inviteRawToken)
      .send({
        question_id: questionId,
        answer_data: {
          code: 'function acquireLock(key, ttl) {\n  return true;\n}',
          explanation: 'Implemented with lease expiry to prevent deadlock.'
        }
      });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.data.success).toBe(true);

    // Candidate Submits Assessment
    const submitRes = await request(app)
      .post(`/api/v1/candidate/attempt/${attemptId}/submit`)
      .set('x-candidate-token', inviteRawToken)
      .send({ feedback: 'All done.' });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('completed');
  });

  // Stage 6: Reviewer Integrity Signals Pipeline
  it('6. Reconstructs evidence timeline and computes advisory integrity summary', async () => {
    // Run signals
    const sigRes = await request(app)
      .post(`/api/v1/attempts/${attemptId}/signals/run`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(sigRes.status).toBe(200);
    expect(sigRes.body.data.signals).toBeDefined();

    // Fetch chronological timeline
    const timeRes = await request(app)
      .get(`/api/v1/attempts/${attemptId}/timeline`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(timeRes.status).toBe(200);
    expect(timeRes.body.data.length).toBeGreaterThanOrEqual(2);
  });

  // Stage 7: Rubric Evaluation & Score Override with Audit Log
  it('7. Submits rubric evaluation and overrides score with audit logging', async () => {
    // Rubric evaluation
    const evalRes = await request(app)
      .post(`/api/v1/attempts/${attemptId}/rubric`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        rubric_scores: {
          correctness: 9,
          architecture: 9
        },
        notes: 'Locking logic handles TTL correctly.'
      });

    expect(evalRes.status).toBe(201);
    expect(evalRes.body.data.notes).toContain('Locking logic');

    // Score calculation
    await request(app)
      .post(`/api/v1/attempts/${attemptId}/score`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // Score Override
    const overRes = await request(app)
      .post(`/api/v1/attempts/${attemptId}/override`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        new_score: 95.0,
        reason: 'Candidate provided exceptionally resilient lease renew mechanism.'
      });

    expect(overRes.status).toBe(200);
    expect(Number(overRes.body.data.new_score)).toBe(95);
  });

  // Stage 8: The Absolute Rule - Human Decision Authoring
  it('8. Enforces The Absolute Rule: Human reviewer authorizes final hiring decision', async () => {
    const decRes = await request(app)
      .post(`/api/v1/attempts/${attemptId}/decision`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        outcome: 'advance',
        reason: 'Strong candidate. Advance to final pairing round.'
      });

    expect(decRes.status).toBe(200);
    expect(decRes.body.data.outcome).toBe('advance');
  });

  // Stage 9: Outbound ATS Scorecard & Billable Metering
  it('9. Formats ATS scorecard and verifies billable usage roll-up metering', async () => {
    // Format Greenhouse scorecard
    const atsRes = await request(app)
      .post('/api/v1/integrations/ats/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ats: 'greenhouse',
        candidateData: { applicationId: 'app_123', candidateName: 'Marcus Vance' },
        result: { score: 95.0, passScore: 75, passed: true, reportUrl: `https://kombee.io/reports/${attemptId}` }
      });

    expect(atsRes.status).toBe(200);
    expect(atsRes.body.data.payload.overall_recommendation).toBe('definitely_yes');

    // Metering roll-up
    const meterRes = await request(app)
      .get('/api/v1/billing/summary')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(meterRes.status).toBe(200);
    expect(meterRes.body.data.tier.name).toBe('Enterprise Pro');
    expect(meterRes.body.data.quotaRemaining).toBeDefined();
  });
});
