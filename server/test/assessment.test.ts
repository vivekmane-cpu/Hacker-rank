import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { superuserPool, appPool } from '../src/db/pool.js';
import {
  calculateAccommodatedDuration,
  resolvePolicySettings
} from '../src/modules/assessments/assessmentService.js';

describe('Kombee Assess - Assessment Builder & Versioning Suite', () => {
  let acmeToken: string;
  let acmeTenantId: string;
  let betaToken: string;
  let betaTenantId: string;
  let sharedQuestionId1: string;
  let sharedQuestionId2: string;
  let retiredQuestionId: string;

  beforeAll(async () => {
    // 1. Login Acme Owner
    const acmeRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });
    acmeToken = acmeRes.body.token;
    acmeTenantId = acmeRes.body.tenant.id;

    // 2. Login Beta Owner
    const betaRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@beta.com', password: 'Password123!' });
    betaToken = betaRes.body.token;
    betaTenantId = betaRes.body.tenant.id;

    // 3. Create active published questions for tests
    const q1Res = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        type: 'multiple_choice',
        title: 'Algorithms Q1: Big-O Complexity',
        description: 'What is the time complexity of binary search?',
        difficulty: 'medium',
        content: {
          isMultiSelect: false,
          options: [
            { id: '1', text: 'O(log n)', isCorrect: true },
            { id: '2', text: 'O(n)', isCorrect: false }
          ]
        }
      });
    sharedQuestionId1 = q1Res.body.data.id;
    await request(app)
      .post(`/api/v1/questions/${sharedQuestionId1}/versions/1/publish`)
      .set('Authorization', `Bearer ${acmeToken}`);

    const q2Res = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        type: 'multiple_choice',
        title: 'System Design Q2: Caching Strategy',
        description: 'What is write-through caching?',
        difficulty: 'hard',
        content: {
          isMultiSelect: false,
          options: [
            { id: '1', text: 'Writes to cache and storage at once', isCorrect: true },
            { id: '2', text: 'Writes to storage only', isCorrect: false }
          ]
        }
      });
    sharedQuestionId2 = q2Res.body.data.id;
    await request(app)
      .post(`/api/v1/questions/${sharedQuestionId2}/versions/1/publish`)
      .set('Authorization', `Bearer ${acmeToken}`);

    // Create a retired question
    const retiredRes = await superuserPool.query(
      `INSERT INTO questions (tenant_id, type)
       VALUES ($1, 'multiple_choice')
       RETURNING id`,
      [acmeTenantId]
    );
    retiredQuestionId = retiredRes.rows[0].id;

    await superuserPool.query(
      `INSERT INTO question_versions (
         question_id, version, title, description, content, difficulty, status
       )
       VALUES ($1, 1, 'Retired Question', 'Retired Question Description', '{"options":[]}', 'easy', 'retired')`,
      [retiredQuestionId]
    );
  });

  afterAll(async () => {
    await appPool.end();
    await superuserPool.end();
  });

  // 1. Assessment Creation & Multi-section Builder
  it('1. Creates assessment with draft v1, sections, pools, and pool questions', async () => {
    // A. Create Assessment
    const createRes = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        title: 'Senior Full Stack Engineer Assessment',
        description: 'Comprehensive technical assessment for Senior Full Stack role',
        duration_minutes: 60,
        pass_score: 75.0,
        ai_policy: 'guarded'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.assessment).toBeDefined();
    expect(createRes.body.data.assessment.status).toBe('draft');
    expect(createRes.body.data.version.version).toBe(1);
    expect(createRes.body.data.version.status).toBe('draft');

    const assessmentId = createRes.body.data.assessment.id;
    const versionId = createRes.body.data.version.id;

    // B. Add Section 1: Problem Solving
    const sec1Res = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/versions/${versionId}/sections`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        title: 'Section 1: Data Structures & Algorithms',
        order_index: 0,
        duration_minutes: 30
      });
    expect(sec1Res.status).toBe(201);
    const section1Id = sec1Res.body.data.id;

    // C. Add Section 2: System Architecture
    const sec2Res = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/versions/${versionId}/sections`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        title: 'Section 2: Architecture & System Design',
        order_index: 1,
        duration_minutes: 30
      });
    expect(sec2Res.status).toBe(201);
    const section2Id = sec2Res.body.data.id;

    // D. Add Pool to Section 1
    const pool1Res = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/sections/${section1Id}/pools`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        name: 'Algorithms Pool',
        select_count: 1,
        strategy: 'random'
      });
    expect(pool1Res.status).toBe(201);
    const pool1Id = pool1Res.body.data.id;

    // E. Add Question 1 to Pool 1
    const addQ1Res = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/pools/${pool1Id}/questions`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ question_ids: [sharedQuestionId1] });
    expect(addQ1Res.status).toBe(201);

    // F. Add Pool to Section 2
    const pool2Res = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/sections/${section2Id}/pools`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        name: 'Architecture Pool',
        select_count: 1,
        strategy: 'random'
      });
    expect(pool2Res.status).toBe(201);
    const pool2Id = pool2Res.body.data.id;

    // G. Add Question 2 to Pool 2
    const addQ2Res = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/pools/${pool2Id}/questions`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ question_ids: [sharedQuestionId2] });
    expect(addQ2Res.status).toBe(201);

    // H. Verify full details via GET
    const getRes = await request(app)
      .get(`/api/v1/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${acmeToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.sections.length).toBe(2);
    expect(getRes.body.data.sections[0].pools.length).toBe(1);
    expect(getRes.body.data.sections[0].pools[0].questions.length).toBe(1);
  });

  // 2. Validation Gates Before Publishing
  it('2. Validation gates reject publishing incomplete or invalid assessments', async () => {
    // Case A: Assessment without any sections
    const emptyRes = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ title: 'Empty Assessment' });
    const emptyAssessId = emptyRes.body.data.assessment.id;
    const emptyVerId = emptyRes.body.data.version.id;

    const pubEmpty = await request(app)
      .post(`/api/v1/assessments/${emptyAssessId}/versions/${emptyVerId}/publish`)
      .set('Authorization', `Bearer ${acmeToken}`);
    expect(pubEmpty.status).toBe(400);
    expect(pubEmpty.body.error.message).toMatch(/at least one section/i);

    // Case B: Section without any pools
    const secRes = await request(app)
      .post(`/api/v1/assessments/${emptyAssessId}/versions/${emptyVerId}/sections`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ title: 'Section Without Pools' });
    const secId = secRes.body.data.id;

    const pubNoPools = await request(app)
      .post(`/api/v1/assessments/${emptyAssessId}/versions/${emptyVerId}/publish`)
      .set('Authorization', `Bearer ${acmeToken}`);
    expect(pubNoPools.status).toBe(400);
    expect(pubNoPools.body.error.message).toMatch(/has no question pools/i);

    // Case C: Pool requires select_count = 2, but only has 1 question
    const poolRes = await request(app)
      .post(`/api/v1/assessments/${emptyAssessId}/sections/${secId}/pools`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ name: 'Deficient Pool', select_count: 2, strategy: 'random' });
    const poolId = poolRes.body.data.id;

    await request(app)
      .post(`/api/v1/assessments/${emptyAssessId}/pools/${poolId}/questions`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ question_ids: [sharedQuestionId1] });

    const pubDeficient = await request(app)
      .post(`/api/v1/assessments/${emptyAssessId}/versions/${emptyVerId}/publish`)
      .set('Authorization', `Bearer ${acmeToken}`);
    expect(pubDeficient.status).toBe(400);
    expect(pubDeficient.body.error.message).toMatch(/requires at least 2 questions, but only has 1/i);

    // Case D: Pool containing retired question fails publishing
    await request(app)
      .post(`/api/v1/assessments/${emptyAssessId}/pools/${poolId}/questions`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ question_ids: [retiredQuestionId] });

    const pubRetired = await request(app)
      .post(`/api/v1/assessments/${emptyAssessId}/versions/${emptyVerId}/publish`)
      .set('Authorization', `Bearer ${acmeToken}`);
    expect(pubRetired.status).toBe(400);
    expect(pubRetired.body.error.message).toMatch(/is retired/i);
  });

  // 3. Successful Publishing and Immutability Lock
  it('3. Successful publishing locks version; database trigger prevents mutation', async () => {
    // Create valid assessment
    const assessRes = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        title: 'Backend Systems Assessment',
        duration_minutes: 45,
        pass_score: 80.0
      });
    const aId = assessRes.body.data.assessment.id;
    const vId = assessRes.body.data.version.id;

    // Add section
    const sRes = await request(app)
      .post(`/api/v1/assessments/${aId}/versions/${vId}/sections`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ title: 'Section 1' });

    // Add pool with select_count = 1
    const pRes = await request(app)
      .post(`/api/v1/assessments/${aId}/sections/${sRes.body.data.id}/pools`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ name: 'Backend Pool', select_count: 1 });

    // Add question 1
    await request(app)
      .post(`/api/v1/assessments/${aId}/pools/${pRes.body.data.id}/questions`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ question_ids: [sharedQuestionId1] });

    // Publish!
    const pubRes = await request(app)
      .post(`/api/v1/assessments/${aId}/versions/${vId}/publish`)
      .set('Authorization', `Bearer ${acmeToken}`);
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.status).toBe('published');
    expect(pubRes.body.data.published_at).not.toBeNull();

    // A. Attempting to update published version via API is blocked (409)
    const updateAttempt = await request(app)
      .put(`/api/v1/assessments/${aId}/versions/${vId}`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ duration_minutes: 90 });
    expect(updateAttempt.status).toBe(409);
    expect(updateAttempt.body.error.message).toMatch(/IMMUTABLE_VERSION/i);

    // B. Direct SQL update is blocked by PostgreSQL immutability trigger
    await expect(
      superuserPool.query(
        `UPDATE assessment_versions SET title = 'Illicit Change' WHERE id = $1`,
        [vId]
      )
    ).rejects.toThrow(/is immutable and cannot be updated/i);
  });

  // 4. Version Forking / Cloning
  it('4. Forking published version creates draft v2 with cloned sections and pools', async () => {
    // Find published assessment from test 3
    const listRes = await request(app)
      .get('/api/v1/assessments?status=published')
      .set('Authorization', `Bearer ${acmeToken}`);
    const pubAssess = listRes.body.data[0];
    expect(pubAssess).toBeDefined();

    // Fork published version
    const forkRes = await request(app)
      .post(`/api/v1/assessments/${pubAssess.id}/versions`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({});
    expect(forkRes.status).toBe(201);
    expect(forkRes.body.data.version).toBe(2);
    expect(forkRes.body.data.status).toBe('draft');
    const v2Id = forkRes.body.data.id;

    // Verify sections and pools cloned to v2
    const getV2Res = await request(app)
      .get(`/api/v1/assessments/${pubAssess.id}?versionId=${v2Id}`)
      .set('Authorization', `Bearer ${acmeToken}`);
    expect(getV2Res.status).toBe(200);
    expect(getV2Res.body.data.sections.length).toBeGreaterThanOrEqual(1);
    expect(getV2Res.body.data.sections[0].pools.length).toBeGreaterThanOrEqual(1);

    // v2 is in draft, so updating draft is allowed
    const updateV2Res = await request(app)
      .put(`/api/v1/assessments/${pubAssess.id}/versions/${v2Id}`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        title: 'Backend Systems Assessment v2 (Revised)',
        duration_minutes: 75
      });
    expect(updateV2Res.status).toBe(200);
    expect(updateV2Res.body.data.title).toBe('Backend Systems Assessment v2 (Revised)');
    expect(updateV2Res.body.data.duration_minutes).toBe(75);
  });

  // 5. Guarded vs Unguarded Policy Enforcement
  it('5. Enforces Guarded vs Unguarded AI policies and proctoring profile assignment', async () => {
    // Guarded mode
    const guardedSettings = resolvePolicySettings('guarded');
    expect(guardedSettings.ai_code_detection).toBe(true);
    expect(guardedSettings.code_similarity).toBe(true);
    expect(guardedSettings.track_tab_switches).toBe(true);
    expect(guardedSettings.track_paste).toBe(true);

    // Unguarded mode
    const unguardedSettings = resolvePolicySettings('unguarded');
    expect(unguardedSettings.ai_code_detection).toBe(false);
    expect(unguardedSettings.code_similarity).toBe(false);
    expect(unguardedSettings.track_paste).toBe(false);
    expect(unguardedSettings.secure_mode).toBe(false);

    // Create via API with Unguarded policy
    const createUnguarded = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        title: 'Open Book AI-Assisted Architecture Challenge',
        ai_policy: 'unguarded'
      });
    expect(createUnguarded.status).toBe(201);
    expect(createUnguarded.body.data.version.ai_policy).toBe('unguarded');
    expect(createUnguarded.body.data.version.integrity_settings.ai_code_detection).toBe(false);
  });

  // 6. Candidate Accommodations Calculation
  it('6. Calculates accommodated duration with multipliers and explicit custom overrides', () => {
    const baseDuration = 60; // 60 minutes

    // 1.0x standard time
    const stdDuration = calculateAccommodatedDuration(baseDuration, { extra_time_multiplier: 1.0, accessible_text_mode: false });
    expect(stdDuration).toBe(60);

    // 1.5x time-and-a-half accommodation
    const extraDuration = calculateAccommodatedDuration(baseDuration, { extra_time_multiplier: 1.5, accessible_text_mode: true });
    expect(extraDuration).toBe(90);

    // 2.0x double time accommodation
    const doubleDuration = calculateAccommodatedDuration(baseDuration, { extra_time_multiplier: 2.0, accessible_text_mode: false });
    expect(doubleDuration).toBe(120);

    // Explicit custom override overrides multiplier
    const overridden = calculateAccommodatedDuration(baseDuration, { extra_time_multiplier: 1.5, accessible_text_mode: false }, 45);
    expect(overridden).toBe(45);
  });

  // 7. Test Variants and Routing Rules Evaluation
  it('7. Evaluates routing rules to direct candidates to appropriate test variants', async () => {
    // Create assessment
    const assessRes = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ title: 'Adaptive Role Assessment' });
    const aId = assessRes.body.data.assessment.id;
    const vId = assessRes.body.data.version.id;

    // Create two variants
    const var1Res = await request(app)
      .post(`/api/v1/assessments/${aId}/versions/${vId}/variants`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ name: 'Senior Staff Variant', pool_slice: {} });
    expect(var1Res.status).toBe(201);
    const seniorVariantId = var1Res.body.data.id;

    const var2Res = await request(app)
      .post(`/api/v1/assessments/${aId}/versions/${vId}/variants`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ name: 'Associate Engineer Variant', pool_slice: {} });
    expect(var2Res.status).toBe(201);
    const associateVariantId = var2Res.body.data.id;

    // Create routing rule: experience_level == 'senior' -> seniorVariantId
    const rule1Res = await request(app)
      .post(`/api/v1/assessments/${aId}/versions/${vId}/routing-rules`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        condition: { experience_level: 'senior' },
        target_variant_id: seniorVariantId
      });
    expect(rule1Res.status).toBe(201);

    // Create routing rule: experience_level == 'associate' -> associateVariantId
    const rule2Res = await request(app)
      .post(`/api/v1/assessments/${aId}/versions/${vId}/routing-rules`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        condition: { experience_level: 'associate' },
        target_variant_id: associateVariantId
      });
    expect(rule2Res.status).toBe(201);

    // Evaluate for Senior Candidate
    const evalSenior = await request(app)
      .post(`/api/v1/assessments/${aId}/versions/${vId}/evaluate-routing`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        candidate_attributes: { experience_level: 'senior', name: 'Alice' }
      });
    expect(evalSenior.status).toBe(200);
    expect(evalSenior.body.data.targetVariantId).toBe(seniorVariantId);

    // Evaluate for Associate Candidate
    const evalAssociate = await request(app)
      .post(`/api/v1/assessments/${aId}/versions/${vId}/evaluate-routing`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        candidate_attributes: { experience_level: 'associate', name: 'Bob' }
      });
    expect(evalAssociate.status).toBe(200);
    expect(evalAssociate.body.data.targetVariantId).toBe(associateVariantId);

    // Evaluate for Unknown Attribute Candidate -> returns null
    const evalUnknown = await request(app)
      .post(`/api/v1/assessments/${aId}/versions/${vId}/evaluate-routing`)
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({
        candidate_attributes: { experience_level: 'intern' }
      });
    expect(evalUnknown.status).toBe(200);
    expect(evalUnknown.body.data.targetVariantId).toBeNull();
  });

  // 8. Multi-Tenant Isolation
  it('8. Cross-tenant isolation blocks Tenant B from accessing or altering Tenant A assessments', async () => {
    // Acme creates a private assessment
    const acmeAssess = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ title: 'Acme Proprietary Internal Benchmark', visibility: 'tenant' });
    const acmeAssessmentId = acmeAssess.body.data.assessment.id;
    const acmeVersionId = acmeAssess.body.data.version.id;

    // Beta attempts to GET Acme's assessment -> 404
    const betaGet = await request(app)
      .get(`/api/v1/assessments/${acmeAssessmentId}`)
      .set('Authorization', `Bearer ${betaToken}`);
    expect(betaGet.status).toBe(404);

    // Beta attempts to update Acme's draft version -> 400 Access denied
    const betaUpdate = await request(app)
      .put(`/api/v1/assessments/${acmeAssessmentId}/versions/${acmeVersionId}`)
      .set('Authorization', `Bearer ${betaToken}`)
      .send({ title: 'Hacked Title' });
    expect(betaUpdate.status).toBe(400);
    expect(betaUpdate.body.error.message).toMatch(/access denied/i);

    // Beta attempts to add a section to Acme's assessment -> 400 Access denied
    const betaAddSection = await request(app)
      .post(`/api/v1/assessments/${acmeAssessmentId}/versions/${acmeVersionId}/sections`)
      .set('Authorization', `Bearer ${betaToken}`)
      .send({ title: 'Unauthorized Section' });
    expect(betaAddSection.status).toBe(400);
    expect(betaAddSection.body.error.message).toMatch(/access denied/i);
  });
});
