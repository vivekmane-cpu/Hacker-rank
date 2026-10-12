"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCodeDirectly = executeCodeDirectly;
exports.submitForAsyncGrading = submitForAsyncGrading;
const tenantContext_js_1 = require("../../context/tenantContext.js");
const runner_js_1 = require("./runner.js");
const sqlRunner_js_1 = require("./sqlRunner.js");
const queue_js_1 = require("./queue.js");
async function executeCodeDirectly(options) {
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    const lang = options.language.toLowerCase();
    // 1. Dispatch SQL execution
    if (lang === 'sql' || lang === 'database_sql') {
        if (!options.sqlParams?.schemaInitSql) {
            throw new Error('SQL execution requires schemaInitSql schema definition.');
        }
        const sqlRes = await (0, sqlRunner_js_1.executeInProcessSql)({
            schemaInitSql: options.sqlParams.schemaInitSql,
            candidateQuery: options.code || '',
            expectedQuery: options.sqlParams.expectedQuery
        });
        // Record execution record in database if attemptId is present
        if (options.attemptId) {
            await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO executions (tenant_id, attempt_id, question_version_id, language, code, status, stdout, stderr, execution_time_ms, is_submission)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
                ctx.tenantId,
                options.attemptId,
                options.questionVersionId || null,
                options.language,
                options.code || '',
                sqlRes.status,
                JSON.stringify(sqlRes.values),
                sqlRes.errorMessage || null,
                sqlRes.executionTimeMs,
                !!options.isSubmission
            ]);
        }
        // Meter usage uniformly across all tenants
        await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO usage_events (tenant_id, module, event_type, quantity, source, environment)
       VALUES ($1, 'candidate_testing', 'execution_query', 1.0, 'ui', $2)`, [ctx.tenantId, ctx.environment]);
        return sqlRes;
    }
    // 2. Dispatch General Code Execution (JS, TS, Python, etc.)
    const runner = (0, runner_js_1.getExecutionRunner)();
    const execResult = await runner.execute({
        language: options.language,
        code: options.code,
        files: options.files,
        entrypoint: options.entrypoint,
        stdin: options.stdin,
        timeoutMs: options.files ? 8000 : 4000 // Longer timeout for multi-file workloads
    });
    // Record in executions table if attemptId is present
    if (options.attemptId) {
        await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO executions (tenant_id, attempt_id, question_version_id, language, code, status, exit_code, stdout, stderr, execution_time_ms, is_submission)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
            ctx.tenantId,
            options.attemptId,
            options.questionVersionId || null,
            options.language,
            options.code || Object.keys(options.files || {}).join(', '),
            execResult.status,
            execResult.exitCode,
            execResult.stdout,
            execResult.stderr,
            execResult.executionTimeMs,
            !!options.isSubmission
        ]);
    }
    // Meter usage uniformly (execution second)
    const executionSeconds = Math.max(Math.ceil(execResult.executionTimeMs / 1000), 1);
    await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO usage_events (tenant_id, module, event_type, quantity, source, environment)
     VALUES ($1, 'candidate_testing', 'execution_second', $2, 'ui', $3)`, [ctx.tenantId, executionSeconds, ctx.environment]);
    return execResult;
}
async function submitForAsyncGrading(options) {
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    // Enqueue as Priority 10 (batch grading, behind priority 1 interactive runs)
    const job = await (0, queue_js_1.enqueueJob)('execution_queue', 10, {
        tenantId: ctx.tenantId,
        type: 'batch_grading',
        data: options
    });
    return {
        jobId: job.id,
        status: 'queued',
        message: 'Submitted for sandboxed batch grading.'
    };
}
