"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTenantConcurrencyLimit = checkTenantConcurrencyLimit;
exports.enqueueJob = enqueueJob;
exports.dequeueNextJob = dequeueNextJob;
exports.completeJob = completeJob;
exports.failJob = failJob;
const pool_js_1 = require("../../db/pool.js");
const DEFAULT_TENANT_CONCURRENCY_LIMIT = 5;
async function checkTenantConcurrencyLimit(tenantId) {
    const { rows } = await pool_js_1.superuserPool.query(`SELECT COUNT(*)::int as active_count
     FROM jobs
     WHERE (payload->>'tenantId') = $1 AND status IN ('queued', 'running')`, [tenantId]);
    const activeCount = rows[0]?.active_count || 0;
    return activeCount < DEFAULT_TENANT_CONCURRENCY_LIMIT;
}
async function enqueueJob(queueName, priority, // 1 = interactive (highest priority), 5 = standard, 10 = batch
payload) {
    // Check concurrency limit for tenant
    const canEnqueue = await checkTenantConcurrencyLimit(payload.tenantId);
    if (!canEnqueue) {
        throw new Error('Tenant Concurrency Limit Exceeded: Active execution limit reached. Please wait for in-flight tasks to finish.');
    }
    const { rows } = await pool_js_1.superuserPool.query(`INSERT INTO jobs (queue_name, priority, payload, status)
     VALUES ($1, $2, $3, 'queued')
     RETURNING id, queue_name, priority, payload, status, attempts, created_at`, [queueName, priority, JSON.stringify(payload)]);
    return rows[0];
}
async function dequeueNextJob(queueName, workerId = 'worker-1') {
    const client = await pool_js_1.superuserPool.connect();
    try {
        await client.query('BEGIN');
        // Priority ordering: lower priority number (e.g. 1) is dequeued before higher numbers (e.g. 10)
        const { rows } = await client.query(`SELECT id, queue_name, priority, payload, status, attempts, created_at
       FROM jobs
       WHERE queue_name = $1 AND status = 'queued'
       ORDER BY priority ASC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1`, [queueName]);
        if (rows.length === 0) {
            await client.query('COMMIT');
            return null;
        }
        const job = rows[0];
        await client.query(`UPDATE jobs
       SET status = 'running', locked_at = NOW(), locked_by = $1, attempts = attempts + 1
       WHERE id = $2`, [workerId, job.id]);
        await client.query('COMMIT');
        return job;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
async function completeJob(jobId) {
    await pool_js_1.superuserPool.query(`UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`, [jobId]);
}
async function failJob(jobId, errorMessage) {
    await pool_js_1.superuserPool.query(`UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2`, [errorMessage, jobId]);
}
