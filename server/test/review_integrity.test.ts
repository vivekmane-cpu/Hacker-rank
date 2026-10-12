import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { superuserPool, appPool } from '../src/db/pool.js';
import { calculateCodeSimilarity, detectAIGeneratedCode } from '../src/modules/reviews/signalsPipeline.js';

describe('Kombee Assess - Integrity, Evidence Timeline & Reviewer API Suite', () => {
  let ownerToken: string;
  let recruiterToken: string;
  let tenantId: string;
  let guardedAssessmentId: string;
  let unguardedAssessmentId: string;
  let questionId: string;
  let candidateInviteToken: string;
  let testAttemptId: string;

  beforeAll(async () => {
    // 1. Log in Acme Owner & Recruiter
    const ownerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });
    ownerToken = ownerRes.body.token;
    tenantId = ownerRes.body.tenant.id;

    const recRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'recruiter@acme.com', password: 'Password123!' });
    recruiterToken = recRes.body.token;

    // 2. Create and publish coding question with reference solution
    const qRes = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'coding',
        title: 'Reverse Words in String',
        description: 'Given an input string s, reverse the order of the words.',
        difficulty: 'medium',
        content: {
          allowedLanguages: ['javascript'],
          starterCode: { javascript: 'function reverseWords(s) {}' }
        },
        tests: [
          { testType: 'unit_test', input: '"the sky is blue"', expectedOutput: '"blue is sky the"', isHidden: false },
          { testType: 'unit_test', input: '"  hello world  "', expectedOutput: '"world hello"', isHidden: true }
        ],
        referenceSolution: {
          code: 'function reverseWords(s) { return s.trim().split(/\\s+/).reverse().join(" "); }'
        }
      });
    questionId = qRes.body.data.id;
    await request(app)
      .post(`/api/v1/questions/${questionId}/versions/1/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // 3. Create Guarded Assessment
    const gAssess = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Senior Algorithm Assessment (Guarded)',
        ai_policy: 'guarded',
        duration_minutes: 60
      });
    guardedAssessmentId = gAssess.body.data.assessment.id;
    const gVerId = gAssess.body.data.version.id;

    const gSec = await request(app)
      .post(`/api/v1/assessments/${guardedAssessmentId}/versions/${gVerId}/sections`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Coding Section', order_index: 0 });

    const gPool = await request(app)
      .post(`/api/v1/assessments/${guardedAssessmentId}/sections/${gSec.body.data.id}/pools`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Algorithms', select_count: 1 });

    await request(app)
      .post(`/api/v1/assessments/${guardedAssessmentId}/pools/${gPool.body.data.id}/questions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ question_ids: [questionId] });

    await request(app)
      .post(`/api/v1/assessments/${guardedAssessmentId}/versions/${gVerId}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // 4. Create Unguarded Assessment
    const uAssess = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Open Innovation Challenge (Unguarded)',
        ai_policy: 'unguarded',
        duration_minutes: 60
      });
    unguardedAssessmentId = uAssess.body.data.assessment.id;
    const uVerId = uAssess.body.data.version.id;

    const uSec = await request(app)
      .post(`/api/v1/assessments/${unguardedAssessmentId}/versions/${uVerId}/sections`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Open Coding Section', order_index: 0 });

    const uPool = await request(app)
      .post(`/api/v1/assessments/${unguardedAssessmentId}/sections/${uSec.body.data.id}/pools`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Open Problem', select_count: 1 });

    await request(app)
      .post(`/api/v1/assessments/${unguardedAssessmentId}/pools/${uPool.body.data.id}/questions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ question_ids: [questionId] });

    await request(app)
      .post(`/api/v1/assessments/${unguardedAssessmentId}/versions/${uVerId}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // 5. Create Candidate & Invitation for Guarded Assessment
    const invRes = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        assessment_id: guardedAssessmentId,
        candidate: {
          first_name: 'Alex',
          last_name: 'Mercer',
          email: `alex.mercer.${Date.now()}@example.com`
        }
      });
    candidateInviteToken = invRes.body.data.rawToken;

    // Start attempt
    const startRes = await request(app)
      .post('/api/v1/candidate/start')
      .set('x-candidate-token', candidateInviteToken)
      .send({});
    testAttemptId = startRes.body.data.attemptId;
  });

  afterAll(async () => {
    await appPool.end();
    await superuserPool.end();
  });

  // 1. Signals Pipeline: Blur, Paste Burst, High Similarity & AI Heuristic
  it('1. Detects window blur, paste bursts, code similarity, and AI code patterns', async () => {
    // A. Submit telemetry events with tab blur and large paste burst
    await request(app)
      .post(`/api/v1/candidate/attempt/${testAttemptId}/events`)
      .set('x-candidate-token', candidateInviteToken)
      .send({
        events: [
          { event_type: 'window.blur', event_data: { duration_ms: 6000 } },
          { event_type: 'window.blur', event_data: { duration_ms: 8000 } },
          { event_type: 'window.blur', event_data: { duration_ms: 12000 } },
          { event_type: 'clipboard.paste', event_data: { text_length: 320 } }
        ]
      });

    // B. Autosave code that is highly similar to reference solution and contains LLM markers
    const llmCode = `
      // Here is the optimal solution with O(n) time complexity:
      // Edge cases handled: multiple spaces between words
      function reverseWords(s) {
        return s.trim().split(/\\s+/).reverse().join(" ");
      }
    `;

    await request(app)
      .post(`/api/v1/candidate/attempt/${testAttemptId}/autosave`)
      .set('x-candidate-token', candidateInviteToken)
      .send({
        question_id: questionId,
        answer_data: { code: llmCode }
      });

    // C. Run Signals Pipeline
    const runRes = await request(app)
      .post(`/api/v1/attempts/${testAttemptId}/signals/run`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(runRes.status).toBe(200);
    expect(runRes.body.data.signals.length).toBeGreaterThanOrEqual(3);

    const signalTypes = runRes.body.data.signals.map((s: any) => s.signal_type);
    expect(signalTypes).toContain('window_blur');
    expect(signalTypes).toContain('paste_burst');
    expect(signalTypes).toContain('similarity_high');
    expect(signalTypes).toContain('ai_generated_code');
  });

  // 2. Guarded vs Unguarded AI Policy
  it('2. Guarded policy flags AI patterns while Unguarded policy permits AI assistance', async () => {
    const aiSampleCode = `
      // Here is the explanation and step-by-step optimal solution:
      function test() { return 42; }
    `;

    // Static heuristic check
    const check = detectAIGeneratedCode(aiSampleCode);
    expect(check.isAiSuspected).toBe(true);
    expect(check.probability).toBeGreaterThan(0.5);

    // Create attempt for Unguarded assessment
    const invRes = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        assessment_id: unguardedAssessmentId,
        candidate: {
          first_name: 'Jordan',
          last_name: 'Bell',
          email: `jordan.${Date.now()}@example.com`
        }
      });
    const uToken = invRes.body.data.rawToken;

    const startRes = await request(app)
      .post('/api/v1/candidate/start')
      .set('x-candidate-token', uToken)
      .send({});
    const uAttemptId = startRes.body.data.attemptId;

    // Autosave same AI code
    await request(app)
      .post(`/api/v1/candidate/attempt/${uAttemptId}/autosave`)
      .set('x-candidate-token', uToken)
      .send({
        question_id: questionId,
        answer_data: { code: aiSampleCode }
      });

    // Run pipeline on unguarded attempt
    const runRes = await request(app)
      .post(`/api/v1/attempts/${uAttemptId}/signals/run`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(runRes.status).toBe(200);
    const signalTypes = runRes.body.data.signals.map((s: any) => s.signal_type);
    // In unguarded mode, ai_generated_code is NOT flagged
    expect(signalTypes).not.toContain('ai_generated_code');
  });

  // 3. Combined Integrity Summary & Advisory Status
  it('3. Generates combined integrity summary marked strictly advisory', async () => {
    const res = await request(app)
      .get(`/api/v1/attempts/${testAttemptId}/integrity`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.overallRisk).toBeDefined();
    expect(res.body.data.isAdvisoryOnly).toBe(true);
    expect(res.body.data.counts.total).toBeGreaterThanOrEqual(3);
    expect(res.body.data.review.status).toBe('open');

    // Candidate submits explanation for the flags
    const explRes = await request(app)
      .post(`/api/v1/attempts/${testAttemptId}/explanation`)
      .set('x-candidate-token', candidateInviteToken)
      .send({
        explanation_text: 'I switched windows briefly to refer to official MDN documentation on String split.'
      });
    expect(explRes.status).toBe(201);

    // Summary now includes candidate explanation
    const resAfterExpl = await request(app)
      .get(`/api/v1/attempts/${testAttemptId}/integrity`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(resAfterExpl.body.data.candidateExplanation).not.toBeNull();
    expect(resAfterExpl.body.data.candidateExplanation.explanation_text).toContain('official MDN documentation');
  });

  // 4. THE ABSOLUTE RULE Verification
  it('4. Enforces THE ABSOLUTE RULE: Automated decisions are prohibited; requires human author', async () => {
    // Direct attempt to record decision without a human reviewer ID is rejected
    await expect(
      import('../src/modules/reviews/reviewService.js').then(m =>
        m.recordHiringDecision(tenantId, testAttemptId, '', {
          outcome: 'reject',
          reason: 'Automated disqualification due to high risk'
        })
      )
    ).rejects.toThrow(/ABSOLUTE_RULE_VIOLATION/i);

    // Verify database has no decision for this attempt yet
    const dbCheck = await superuserPool.query(
      `SELECT * FROM decisions WHERE attempt_id = $1`,
      [testAttemptId]
    );
    expect(dbCheck.rows.length).toBe(0);
  });

  // 5. Evidence Timeline Reconstruction
  it('5. Reconstructs chronological evidence timeline across events and signals', async () => {
    const res = await request(app)
      .get(`/api/v1/attempts/${testAttemptId}/timeline`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);

    const categories = res.body.data.map((t: any) => t.category);
    expect(categories).toContain('event');
    expect(categories).toContain('signal');

    // Chronologically ascending
    for (let i = 1; i < res.body.data.length; i++) {
      const prev = new Date(res.body.data[i - 1].timestamp).getTime();
      const curr = new Date(res.body.data[i].timestamp).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  // 6. Rubric Grading & Qualitative Review
  it('6. Records rubric score grading and reviewer notes', async () => {
    const res = await request(app)
      .post(`/api/v1/attempts/${testAttemptId}/rubric`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        rubric_scores: {
          code_quality: 9,
          problem_solving: 8,
          system_thinking: 7
        },
        notes: 'Strong candidate with clear logic and efficient solution structure.'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.rubric_scores.code_quality).toBe(9);
    expect(res.body.data.notes).toContain('Strong candidate');
  });

  // 7. Deterministic Scoring & Manual Score Overrides
  it('7. Calculates deterministic scores and records manual overrides with audit log', async () => {
    // Calculate initial score
    const scoreRes = await request(app)
      .post(`/api/v1/attempts/${testAttemptId}/score`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(scoreRes.status).toBe(200);

    // Override score
    const overrideRes = await request(app)
      .post(`/api/v1/attempts/${testAttemptId}/override`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        new_score: 95.0,
        reason: 'Adjusted score upwards following live interview demonstration of edge cases.'
      });

    expect(overrideRes.status).toBe(200);
    expect(Number(overrideRes.body.data.new_score)).toBe(95);

    // Verify DB override entry
    const dbOv = await superuserPool.query(
      `SELECT * FROM overrides WHERE attempt_id = $1`,
      [testAttemptId]
    );
    expect(dbOv.rows.length).toBe(1);
    expect(Number(dbOv.rows[0].new_score)).toBe(95);

    // Verify attempt score updated
    const attCheck = await superuserPool.query(
      `SELECT score FROM attempts WHERE id = $1`,
      [testAttemptId]
    );
    expect(Number(attCheck.rows[0].score)).toBe(95);
  });

  // 8. Human Hiring Decision Authoring
  it('8. Human hiring manager records hiring decision with rationale', async () => {
    const res = await request(app)
      .post(`/api/v1/attempts/${testAttemptId}/decision`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        outcome: 'advance',
        reason: 'Candidate exhibited superior technical depth; MDN window switches were reviewed and validated.'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('advance');
    expect(res.body.data.reason).toContain('superior technical depth');

    // Verify DB entry
    const decDb = await superuserPool.query(
      `SELECT * FROM decisions WHERE attempt_id = $1`,
      [testAttemptId]
    );
    expect(decDb.rows.length).toBe(1);
    expect(decDb.rows[0].outcome).toBe('advance');
  });

  // 9. Evaluation Summary & PDF Report Export
  it('9. Generates evaluation summary report document with advisory notice and decision', async () => {
    const res = await request(app)
      .get(`/api/v1/attempts/${testAttemptId}/report`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.htmlReport).toBeDefined();
    expect(res.body.data.htmlReport).toContain('Absolute Rule Notice');
    expect(res.body.data.htmlReport).toContain('Alex Mercer');
    expect(res.body.data.data.decision).toBe('advance');

    // Verify saved in reports table
    const repDb = await superuserPool.query(
      `SELECT * FROM reports WHERE id = $1`,
      [res.body.data.reportId]
    );
    expect(repDb.rows.length).toBe(1);
    expect(repDb.rows[0].status).toBe('ready');
  });
});
