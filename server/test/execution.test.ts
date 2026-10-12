import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { superuserPool, appPool } from '../src/db/pool.js';
import { executeInProcessSql, validateReadOnlySqlQuery } from '../src/modules/execution/sqlRunner.js';
import { enqueueJob, dequeueNextJob } from '../src/modules/execution/queue.js';

describe('Kombee Assess - Shared Execution Engine Suite', () => {
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

  // 1. Basic Interactive Execution
  it('1. Executes JavaScript code and captures stdout output', async () => {
    const res = await request(app)
      .post('/api/v1/execution/run')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        language: 'javascript',
        code: 'console.log("Hello from Kombee execution sandbox!");'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('passed');
    expect(res.body.data.stdout).toContain('Hello from Kombee execution sandbox!');
    expect(res.body.data.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  // 2. Infinite Loop / Timeout Limit Protection
  it('2. Infinite loop code is terminated and returned as timed_out', async () => {
    const res = await request(app)
      .post('/api/v1/execution/run')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        language: 'javascript',
        code: 'while(true) {}' // Infinite loop
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('timed_out');
    expect(res.body.data.stderr).toMatch(/exceeded limit/i);
  });

  // 3. Misuse Stop: Huge Output Buffer Truncation
  it('3. Huge stdout output is safely truncated to 64KB with truncated flag set', async () => {
    const res = await request(app)
      .post('/api/v1/execution/run')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        language: 'javascript',
        code: 'for(let i=0; i<15000; i++) { console.log("A very large string to flood the buffer 1234567890"); }'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.truncated).toBe(true);
    expect(res.body.data.stdout.length).toBeLessThanOrEqual(70 * 1024);
  });

  // 4. Multi-File Workspace Execution
  it('4. Executes multi-file repository with relative imports', async () => {
    const res = await request(app)
      .post('/api/v1/execution/run')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        language: 'javascript',
        entrypoint: 'index.js',
        files: {
          'utils/math.js': 'module.exports = { add: (a, b) => a + b };',
          'index.js': 'const { add } = require("./utils/math.js"); console.log("Result is:", add(40, 2));'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('passed');
    expect(res.body.data.stdout).toContain('Result is: 42');
  });

  // 5. In-Process SQL Runner & Read-Only Guard
  it('5. Executes in-process SQL query, comparing expected results', async () => {
    const schemaInitSql = `
      CREATE TABLE departments (id INT PRIMARY KEY, name TEXT);
      INSERT INTO departments VALUES (1, 'Engineering'), (2, 'Design'), (3, 'Finance');
    `;

    const candidateQuery = `SELECT name FROM departments ORDER BY name ASC;`;
    const expectedQuery = `SELECT name FROM departments ORDER BY name ASC;`;

    const result = await executeInProcessSql({
      schemaInitSql,
      candidateQuery,
      expectedQuery
    });

    expect(result.status).toBe('passed');
    expect(result.columns).toEqual(['name']);
    expect(result.values).toEqual([['Design'], ['Engineering'], ['Finance']]);
    expect(result.rowCount).toBe(3);
  });

  it('6. SQL read-only guard rejects mutation queries (DROP, DELETE, UPDATE)', () => {
    expect(() => validateReadOnlySqlQuery('DROP TABLE employees;')).toThrow(/strictly read-only/i);
    expect(() => validateReadOnlySqlQuery('DELETE FROM employees WHERE id = 1;')).toThrow(/strictly read-only/i);
    expect(() => validateReadOnlySqlQuery('UPDATE employees SET salary = 10000;')).toThrow(/strictly read-only/i);
  });

  // 6. Priority Queue Ordering (Interactive ahead of Batch)
  it('7. Interactive run (Priority 1) dequeues ahead of batch grading (Priority 10)', async () => {
    const queueName = `test_queue_${Date.now()}`;
    const priorityTenantId = `22222222-2222-2222-2222-${Date.now().toString().slice(-12).padStart(12, '0')}`;

    // Enqueue Batch Job first (Priority 10)
    await enqueueJob(queueName, 10, {
      tenantId: priorityTenantId,
      type: 'batch_grading',
      data: { name: 'Batch Assessment Grading' }
    });

    // Enqueue Interactive Job second (Priority 1)
    await enqueueJob(queueName, 1, {
      tenantId: priorityTenantId,
      type: 'code_execution',
      data: { name: 'Interactive Candidate Run' }
    });

    // First dequeued job MUST be the Priority 1 interactive job
    const job1 = await dequeueNextJob(queueName, 'test-worker');
    expect(job1).toBeDefined();
    expect(job1?.priority).toBe(1);
    expect(job1?.payload.data.name).toBe('Interactive Candidate Run');

    // Second dequeued job is the Priority 10 batch job
    const job2 = await dequeueNextJob(queueName, 'test-worker');
    expect(job2).toBeDefined();
    expect(job2?.priority).toBe(10);
    expect(job2?.payload.data.name).toBe('Batch Assessment Grading');
  });

  // 7. Per-Tenant Concurrency Limits
  it('8. Enforcing per-tenant concurrency limit rejects queue overloading', async () => {
    const queueName = `concurrency_queue_${Date.now()}`;
    const syntheticTenantId = `11111111-1111-1111-1111-${Date.now().toString().slice(-12).padStart(12, '0')}`;

    // Default limit is 5 concurrent tasks per tenant
    for (let i = 0; i < 5; i++) {
      await enqueueJob(queueName, 5, {
        tenantId: syntheticTenantId,
        type: 'code_execution',
        data: { runIndex: i }
      });
    }

    // 6th attempt must throw Concurrency Limit Exceeded
    await expect(
      enqueueJob(queueName, 5, {
        tenantId: syntheticTenantId,
        type: 'code_execution',
        data: { runIndex: 6 }
      })
    ).rejects.toThrow(/Tenant Concurrency Limit Exceeded/i);
  });
});
