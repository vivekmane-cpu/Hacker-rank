import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { superuserPool, appPool } from '../src/db/pool.js';

describe('Kombee Assess - Question Bank & Validation Gates Suite', () => {
  let ownerToken: string;
  let tenantId: string;

  beforeAll(async () => {
    // Login Acme Owner
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@acme.com', password: 'Password123!' });
    ownerToken = res.body.token;
    tenantId = res.body.tenant.id;
  });

  afterAll(async () => {
    await appPool.end();
    await superuserPool.end();
  });

  // 1. Type Registry
  it('1. Returns complete registry of all 20 first-class question types', async () => {
    const res = await request(app)
      .get('/api/v1/questions/types')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(20);

    const types = res.body.data.map((t: any) => t.type);
    expect(types).toContain('multiple_choice');
    expect(types).toContain('coding');
    expect(types).toContain('database_sql');
    expect(types).toContain('subjective');
    expect(types).toContain('code_repository');
    expect(types).toContain('whiteboard');
    expect(types).toContain('prompt_engineering');
  });

  // 2. MCQ Validation Gate
  it('2. Multiple choice question without a correct option fails validation', async () => {
    const res = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'multiple_choice',
        title: 'Invalid MCQ Question',
        description: 'What is 2 + 2?',
        difficulty: 'easy',
        content: {
          isMultiSelect: false,
          options: [
            { id: '1', text: 'Three', isCorrect: false },
            { id: '2', text: 'Five', isCorrect: false }
          ]
        }
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/at least one correct option/i);
  });

  // 3. Coding Validation Gate: Hidden Tests & Reference Solution
  it('3. Coding question cannot be published without hidden test cases and verified reference solution', async () => {
    // Step A: Create valid draft coding question
    const createRes = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'coding',
        title: 'Two Sum Problem',
        description: 'Given an array of integers, return indices of two numbers that add up to target.',
        difficulty: 'medium',
        content: {
          allowedLanguages: ['javascript', 'python'],
          starterCode: {
            javascript: 'function twoSum(nums, target) { return []; }'
          }
        },
        tests: [
          { testType: 'unit_test', input: '[2,7,11,15], 9', expectedOutput: '[0,1]', isHidden: false }
          // Missing hidden tests!
        ]
      });

    expect(createRes.status).toBe(201);
    const questionId = createRes.body.data.id;

    // Step B: Attempt to publish without hidden test cases -> Rejection
    const failPublishRes = await request(app)
      .post(`/api/v1/questions/${questionId}/versions/1/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(failPublishRes.status).toBe(400);
    expect(failPublishRes.body.error.message).toMatch(/must include hidden test cases/i);

    // Step C: Edit to add hidden test and broken reference solution
    await request(app)
      .put(`/api/v1/questions/${questionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        referenceSolution: { code: 'BROKEN_SOLUTION_SYNTAX_ERROR' }
      });

    // Add hidden test via DB for test verification
    const vRes = await superuserPool.query('SELECT id FROM question_versions WHERE question_id = $1', [questionId]);
    await superuserPool.query(
      `INSERT INTO question_tests (question_version_id, test_type, input, expected_output, is_hidden)
       VALUES ($1, 'unit_test', '[3,3], 6', '[0,1]', true)`,
      [vRes.rows[0].id]
    );

    // Step D: Attempt publish with failing reference solution -> Rejection
    const failRefRes = await request(app)
      .post(`/api/v1/questions/${questionId}/versions/1/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(failRefRes.status).toBe(400);
    expect(failRefRes.body.error.message).toMatch(/reference solution fails/i);

    // Step E: Fix reference solution and successfully publish
    await superuserPool.query(
      `UPDATE question_versions SET reference_solution = '{"code": "function twoSum(n, t) { return [0, 1]; }"}' WHERE id = $1`,
      [vRes.rows[0].id]
    );

    const publishSuccessRes = await request(app)
      .post(`/api/v1/questions/${questionId}/versions/1/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(publishSuccessRes.status).toBe(200);
    expect(publishSuccessRes.body.data.status).toBe('published');
  });

  // 4. Content-Safety Screening Gate (FR-CONT-08)
  it('4. Content safety gate rejects questions containing prohibited terms touching protected characteristics', async () => {
    const res = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'subjective',
        title: 'Inquiry on candidate caste and marital status',
        description: 'Please describe your religion and caste background for team diversity.',
        difficulty: 'easy',
        content: {
          minWordCount: 50,
          maxWordCount: 500
        }
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Content safety screening failed/i);
    expect(res.body.error.message).toMatch(/caste|marital status/i);
  });

  // 5. Immutability of Published Versions & Versioning (FR-CONT-01)
  it('5. Published question versions are locked; editing creates a new version while locking v1', async () => {
    // 1. Create and publish a question
    const createRes = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'multiple_choice',
        title: 'REST Semantics',
        description: 'Which HTTP method is idempotent?',
        difficulty: 'easy',
        content: {
          isMultiSelect: false,
          options: [
            { id: '1', text: 'POST', isCorrect: false },
            { id: '2', text: 'PUT', isCorrect: true }
          ]
        }
      });

    const questionId = createRes.body.data.id;

    // Publish v1
    await request(app)
      .post(`/api/v1/questions/${questionId}/versions/1/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // Verify v1 rejects direct UPDATE due to database trigger
    const vRes = await superuserPool.query(
      `SELECT id FROM question_versions WHERE question_id = $1 AND version = 1`,
      [questionId]
    );
    const v1Id = vRes.rows[0].id;

    await expect(
      superuserPool.query(`UPDATE question_versions SET title = 'Tampered' WHERE id = $1`, [v1Id])
    ).rejects.toThrow(/Published version .* is immutable/i);

    // 2. Edit through API -> must create version 2 in draft
    const editRes = await request(app)
      .put(`/api/v1/questions/${questionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'REST Semantics (Updated for HTTP/3)'
      });

    expect(editRes.status).toBe(200);
    expect(editRes.body.data.version.version).toBe(2);
    expect(editRes.body.data.version.status).toBe('draft');

    // Confirm v1 is still published and unchanged
    const v1Check = await superuserPool.query(`SELECT status, title FROM question_versions WHERE id = $1`, [v1Id]);
    expect(v1Check.rows[0].status).toBe('published');
    expect(v1Check.rows[0].title).toBe('REST Semantics');
  });

  // 6. Natural Language Search & Filtering (FR-CONT-02)
  it('6. Natural-language search parses intent (difficulty, type, topic) into structured filters', async () => {
    // Create a medium coding question with "recursion" in title
    await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'coding',
        title: 'Binary Tree Inorder Traversal using Recursion',
        description: 'Implement a recursive traversal of a binary search tree.',
        difficulty: 'medium',
        content: {
          allowedLanguages: ['javascript'],
          starterCode: { javascript: 'function traverse() {}' }
        }
      });

    // Query in natural language
    const searchRes = await request(app)
      .get('/api/v1/questions?nlQuery=medium coding question about recursion')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThan(0);

    const match = searchRes.body.data[0];
    expect(match.difficulty).toBe('medium');
    expect(match.type).toBe('coding');
    expect(match.summary).toBeDefined();
  });

  // 7. Web Leak Scanner & Review Queue (FR-CONT-03)
  it('7. Leak scan flags suspicious public matches, and human review confirms retirement', async () => {
    // 1. Create and publish a question with simulated public leak keyword
    const createRes = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'multiple_choice',
        title: 'Question with known_leaked_algorithm',
        description: 'What is the asymptotic complexity of the known_leaked_algorithm problem?',
        difficulty: 'hard',
        content: {
          isMultiSelect: false,
          options: [
            { id: '1', text: 'O(N)', isCorrect: true },
            { id: '2', text: 'O(N^2)', isCorrect: false }
          ]
        }
      });

    const questionId = createRes.body.data.id;
    await request(app)
      .post(`/api/v1/questions/${questionId}/versions/1/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // 2. Trigger leak scan
    const scanRes = await request(app)
      .post(`/api/v1/questions/${questionId}/scan-leak`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(scanRes.status).toBe(200);
    expect(scanRes.body.data.findings.length).toBeGreaterThan(0);
    const findingId = scanRes.body.data.findings[0].id;
    expect(Number(scanRes.body.data.findings[0].confidence)).toBeGreaterThan(0.9);

    // 3. Inspect leak review queue
    const queueRes = await request(app)
      .get('/api/v1/questions/leaks/queue')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.data.some((f: any) => f.id === findingId)).toBe(true);

    // 4. Human confirms leak -> question must be retired
    const reviewRes = await request(app)
      .post(`/api/v1/questions/leaks/${findingId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        action: 'confirmed_leak',
        note: 'Confirmed exact statement found on Pastebin. Retiring from active pools.'
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.questionRetired).toBe(true);

    // Verify status is now 'retired' in database (never deleted!)
    const qCheck = await superuserPool.query(
      `SELECT status FROM question_versions WHERE question_id = $1`,
      [questionId]
    );
    expect(qCheck.rows[0].status).toBe('retired');
  });
});
