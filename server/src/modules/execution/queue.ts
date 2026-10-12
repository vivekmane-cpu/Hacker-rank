import { superuserPool } from '../../db/pool.js';

export interface JobPayload {
  tenantId: string;
  type: 'code_execution' | 'sql_execution' | 'batch_grading' | 'webhook_delivery';
  data: any;
}

export interface JobRecord {
  id: string;
  queue_name: string;
  priority: number;
  payload: JobPayload;
  status: 'queued' | 'running' | 'completed' | 'failed';
  attempts: number;
  created_at: string;
}

const DEFAULT_TENANT_CONCURRENCY_LIMIT = 5;

export async function checkTenantConcurrencyLimit(tenantId: string): Promise<boolean> {
  const { rows } = await superuserPool.query(
    `SELECT COUNT(*)::int as active_count
     FROM jobs
     WHERE (payload->>'tenantId') = $1 AND status IN ('queued', 'running')`,
    [tenantId]
  );
  const activeCount = rows[0]?.active_count || 0;
  return activeCount < DEFAULT_TENANT_CONCURRENCY_LIMIT;
}

export async function enqueueJob(
  queueName: string,
  priority: number, // 1 = interactive (highest priority), 5 = standard, 10 = batch
  payload: JobPayload
): Promise<JobRecord> {
  // Check concurrency limit for tenant
  const canEnqueue = await checkTenantConcurrencyLimit(payload.tenantId);
  if (!canEnqueue) {
    throw new Error('Tenant Concurrency Limit Exceeded: Active execution limit reached. Please wait for in-flight tasks to finish.');
  }

  const { rows } = await superuserPool.query(
    `INSERT INTO jobs (queue_name, priority, payload, status)
     VALUES ($1, $2, $3, 'queued')
     RETURNING id, queue_name, priority, payload, status, attempts, created_at`,
    [queueName, priority, JSON.stringify(payload)]
  );

  return rows[0];
}

export async function dequeueNextJob(
  queueName: string,
  workerId: string = 'worker-1'
): Promise<JobRecord | null> {
  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');

    // Priority ordering: lower priority number (e.g. 1) is dequeued before higher numbers (e.g. 10)
    const { rows } = await client.query(
      `SELECT id, queue_name, priority, payload, status, attempts, created_at
       FROM jobs
       WHERE queue_name = $1 AND status = 'queued'
       ORDER BY priority ASC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
      [queueName]
    );

    if (rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const job = rows[0];

    await client.query(
      `UPDATE jobs
       SET status = 'running', locked_at = NOW(), locked_by = $1, attempts = attempts + 1
       WHERE id = $2`,
      [workerId, job.id]
    );

    await client.query('COMMIT');
    return job;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function completeJob(jobId: string): Promise<void> {
  await superuserPool.query(
    `UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
    [jobId]
  );
}

export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  await superuserPool.query(
    `UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2`,
    [errorMessage, jobId]
  );
}
