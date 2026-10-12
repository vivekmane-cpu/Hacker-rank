import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { superuserPool, appPool } from '../src/db/pool.js';

describe('Kombee Assess - Invitations & Candidate Runtime API Suite', () => {
  let recruiterToken: string;
  let tenantId: string;
  let publishedAssessmentId: string;
  let publishedVersionId: string;
  let sampleQuestionId: string;
  let inviteRawToken: string;
  let candidateId: string;
  let invitationId: string;
  let activeAttemptId: string;
  let resumeToken: string;

  let ownerToken: string;

  beforeAll(async () => {
    // 1. Login Acme Owner (to author question & assessment)
    const ownerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });
    ownerToken = ownerRes.body.token;
    tenantId = ownerRes.body.tenant.id;

    // 2. Login Acme Recruiter (to issue invitations)
    const recRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'recruiter@acme.com', password: 'Password123!' });
    recruiterToken = recRes.body.token;

    // 3. Create and publish a test question
    const qRes = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'multiple_choice',
        title: 'Cloud Architecture Basics',
        description: 'What is horizontal scaling?',
        difficulty: 'medium',
        content: {
          isMultiSelect: false,
          options: [
            { id: '1', text: 'Adding more machines to the pool', isCorrect: true },
            { id: '2', text: 'Adding more RAM to single machine', isCorrect: false }
          ]
        }
      });
    sampleQuestionId = qRes.body.data.id;
    await request(app)
      .post(`/api/v1/questions/${sampleQuestionId}/versions/1/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // 4. Create and publish an assessment
    const assessRes = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Full Stack Engineering Evaluation',
        duration_minutes: 60,
        pass_score: 70.0,
        ai_policy: 'guarded'
      });
    publishedAssessmentId = assessRes.body.data.assessment.id;
    publishedVersionId = assessRes.body.data.version.id;

    // Add section
    const secRes = await request(app)
      .post(`/api/v1/assessments/${publishedAssessmentId}/versions/${publishedVersionId}/sections`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'System Architecture', order_index: 0, duration_minutes: 60 });

    // Add pool
    const poolRes = await request(app)
      .post(`/api/v1/assessments/${publishedAssessmentId}/sections/${secRes.body.data.id}/pools`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Architecture Pool', select_count: 1, strategy: 'random' });

    // Add question to pool
    await request(app)
      .post(`/api/v1/assessments/${publishedAssessmentId}/pools/${poolRes.body.data.id}/questions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ question_ids: [sampleQuestionId] });

    // Publish assessment version
    await request(app)
      .post(`/api/v1/assessments/${publishedAssessmentId}/versions/${publishedVersionId}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);
  });

  afterAll(async () => {
    await appPool.end();
    await superuserPool.end();
  });

  // 1. Recruiter Creates Candidate Invitation
  it('1. Recruiter issues candidate invitation with single-use cryptographic token', async () => {
    const res = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        assessment_id: publishedAssessmentId,
        candidate: {
          first_name: 'John',
          last_name: 'Doe',
          email: `candidate.john.${Date.now()}@example.com`
        },
        expires_in_hours: 48
      });

    expect(res.status).toBe(201);
    expect(res.body.data.rawToken).toBeDefined();
    expect(res.body.data.rawToken).toMatch(/^kbi_/);
    expect(res.body.data.invitation).toBeDefined();
    expect(res.body.data.invitation.status).toBe('pending');
    expect(res.body.data.candidate).toBeDefined();

    inviteRawToken = res.body.data.rawToken;
    invitationId = res.body.data.invitation.id;
    candidateId = res.body.data.candidate.id;

    // Verify token hash is stored, not plaintext
    const dbCheck = await superuserPool.query(
      `SELECT token_hash FROM invitations WHERE id = $1`,
      [invitationId]
    );
    expect(dbCheck.rows[0].token_hash).not.toBe(inviteRawToken);
  });

  // 2. Candidate Verifies Token and Inspects Assessment Details
  it('2. Candidate verifies invite token and retrieves metadata', async () => {
    const res = await request(app)
      .get(`/api/v1/candidate/verify?token=${inviteRawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.assessment_title).toBe('Full Stack Engineering Evaluation');
    expect(res.body.data.duration_minutes).toBe(60);
    expect(res.body.data.ai_policy).toBe('guarded');
    expect(res.body.data.first_name).toBe('John');

    // Invalid token returns 401 / 400
    const failRes = await request(app)
      .get(`/api/v1/candidate/verify?token=kbi_invalid_tampered_token`);
    expect(failRes.status).toBeGreaterThanOrEqual(400);
  });

  // 3. Candidate Submits Consent and Runs Pre-flight Check
  it('3. Records candidate consent and pre-flight diagnostic checks', async () => {
    // A. Submit Consent
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
    expect(consentRes.body.data.consent_type).toBe('data_processing');
    expect(consentRes.body.data.consented).toBe(true);

    // B. Pre-flight Check
    const preflightRes = await request(app)
      .post('/api/v1/candidate/pre-flight')
      .set('x-candidate-token', inviteRawToken)
      .send({
        camera_working: true,
        mic_working: true,
        browser_compatible: true,
        network_bandwidth_kbps: 15000
      });
    expect(preflightRes.status).toBe(200);
    expect(preflightRes.body.data.status).toBe('passed');
  });

  // 4. Candidate Starts Test Attempt Session & Timer Starts
  it('4. Candidate starts test attempt session and initializes server timer', async () => {
    const res = await request(app)
      .post('/api/v1/candidate/start')
      .set('x-candidate-token', inviteRawToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
    expect(res.body.data.isResume).toBe(false);
    expect(res.body.data.attemptId).toBeDefined();
    expect(res.body.data.resumeToken).toBeDefined();
    expect(res.body.data.resumeToken).toMatch(/^kbr_/);
    expect(res.body.data.remainingSeconds).toBeGreaterThan(3500); // ~3600 seconds
    expect(res.body.data.manifest.length).toBe(1); // 1 section
    expect(res.body.data.manifest[0].pools[0].selectedQuestions.length).toBe(1);

    activeAttemptId = res.body.data.attemptId;
    resumeToken = res.body.data.resumeToken;

    // Verify invitation marked started
    const invCheck = await superuserPool.query(
      `SELECT status FROM invitations WHERE id = $1`,
      [invitationId]
    );
    expect(invCheck.rows[0].status).toBe('started');

    // Verify attempt.started event logged
    const eventCheck = await superuserPool.query(
      `SELECT event_type FROM attempt_events WHERE attempt_id = $1 AND event_type = 'attempt.started'`,
      [activeAttemptId]
    );
    expect(eventCheck.rows.length).toBe(1);
  });

  // 5. Autosave Answers with Question Version Binding
  it('5. Autosaves candidate answers and binds question version', async () => {
    const res = await request(app)
      .post(`/api/v1/candidate/attempt/${activeAttemptId}/autosave`)
      .set('x-candidate-token', inviteRawToken)
      .send({
        question_id: sampleQuestionId,
        answer_data: { selectedOptionId: '1' }
      });

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);

    // Verify answer record in DB
    const ansCheck = await superuserPool.query(
      `SELECT question_id, answer_data, question_version_id FROM attempt_answers WHERE attempt_id = $1`,
      [activeAttemptId]
    );
    expect(ansCheck.rows.length).toBe(1);
    expect(ansCheck.rows[0].answer_data.selectedOptionId).toBe('1');
    expect(ansCheck.rows[0].question_version_id).toBeDefined();

    // Verify attempt.autosave event was logged append-only
    const evCheck = await superuserPool.query(
      `SELECT event_type FROM attempt_events WHERE attempt_id = $1 AND event_type = 'attempt.autosave'`,
      [activeAttemptId]
    );
    expect(evCheck.rows.length).toBe(1);
  });

  // 6. Telemetry and Event Stream Ingestion
  it('6. Ingests candidate focus/blur telemetry events append-only', async () => {
    const res = await request(app)
      .post(`/api/v1/candidate/attempt/${activeAttemptId}/events`)
      .set('x-candidate-token', inviteRawToken)
      .send({
        events: [
          { event_type: 'window.blur', event_data: { duration_ms: 1200 } },
          { event_type: 'window.focus', event_data: {} },
          { event_type: 'clipboard.paste', event_data: { text_length: 42 } }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.data.recorded).toBe(3);

    // Database append-only trigger prohibits updating or deleting attempt_events
    await expect(
      superuserPool.query(
        `UPDATE attempt_events SET event_type = 'tampered' WHERE attempt_id = $1`,
        [activeAttemptId]
      )
    ).rejects.toThrow(/strictly append-only/i);
  });

  // 7. Disconnection Recovery with Resume Token
  it('7. Reconnects disconnected candidate using resume token', async () => {
    const res = await request(app)
      .post('/api/v1/candidate/resume')
      .send({ resumeToken });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
    expect(res.body.data.attemptId).toBe(activeAttemptId);
    expect(res.body.data.remainingSeconds).toBeGreaterThan(0);
    expect(res.body.data.answers.length).toBe(1);
    expect(res.body.data.answers[0].answer_data.selectedOptionId).toBe('1');

    // Verify reconnected event was logged
    const recEv = await superuserPool.query(
      `SELECT event_type FROM attempt_events WHERE attempt_id = $1 AND event_type = 'attempt.reconnected'`,
      [activeAttemptId]
    );
    expect(recEv.rows.length).toBe(1);
  });

  // 8. Server-Side Timer Expiry Rejects Late Autosave
  it('8. Server-side timer expiry automatically marks attempt timed_out and blocks autosave', async () => {
    // Manually expire attempt in DB
    await superuserPool.query(
      `UPDATE attempts SET expires_at = NOW() - INTERVAL '5 seconds' WHERE id = $1`,
      [activeAttemptId]
    );

    // Attempting to autosave now must be rejected with 403
    const lateAutosave = await request(app)
      .post(`/api/v1/candidate/attempt/${activeAttemptId}/autosave`)
      .set('x-candidate-token', inviteRawToken)
      .send({
        question_id: sampleQuestionId,
        answer_data: { selectedOptionId: '2' }
      });

    expect(lateAutosave.status).toBe(403);
    expect(lateAutosave.body.error.message).toMatch(/timed out/i);

    // Check attempt status is timed_out
    const statusRes = await request(app)
      .get(`/api/v1/candidate/attempt/${activeAttemptId}`)
      .set('x-candidate-token', inviteRawToken);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.attempt.status).toBe('timed_out');
    expect(statusRes.body.data.remainingSeconds).toBe(0);
  });

  // 9. Final Submission Lifecycle
  it('9. Submits completed test attempt and seals session', async () => {
    // Create new invitation & attempt to test clean submission
    const invRes = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        assessment_id: publishedAssessmentId,
        candidate: {
          first_name: 'Sarah',
          last_name: 'Connor',
          email: `sarah.connor.${Date.now()}@example.com`
        }
      });
    const sToken = invRes.body.data.rawToken;

    // Start attempt
    const startRes = await request(app)
      .post('/api/v1/candidate/start')
      .set('x-candidate-token', sToken)
      .send({});
    const sAttemptId = startRes.body.data.attemptId;

    // Submit attempt
    const submitRes = await request(app)
      .post(`/api/v1/candidate/attempt/${sAttemptId}/submit`)
      .set('x-candidate-token', sToken)
      .send({ feedback: 'Great platform experience!' });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.success).toBe(true);
    expect(submitRes.body.data.status).toBe('completed');

    // Attempt status in DB is completed
    const attCheck = await superuserPool.query(
      `SELECT status, completed_at FROM attempts WHERE id = $1`,
      [sAttemptId]
    );
    expect(attCheck.rows[0].status).toBe('completed');
    expect(attCheck.rows[0].completed_at).not.toBeNull();

    // Invitation status in DB is completed
    const invCheck = await superuserPool.query(
      `SELECT status FROM invitations WHERE id = $1`,
      [invRes.body.data.invitation.id]
    );
    expect(invCheck.rows[0].status).toBe('completed');
  });
});
