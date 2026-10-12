"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantContext = getTenantContext;
exports.runWithTenantContext = runWithTenantContext;
exports.tenantQuery = tenantQuery;
const async_hooks_1 = require("async_hooks");
const pool_js_1 = require("../db/pool.js");
const storage = new async_hooks_1.AsyncLocalStorage();
function getTenantContext() {
    return storage.getStore();
}
function runWithTenantContext(context, callback) {
    return storage.run(context, callback);
}
/**
 * Execute a query within the ambient tenant context.
 * Uses the request's transaction client bound to SET LOCAL app.tenant_id.
 * If no ambient context exists, throws a strict fail-closed error.
 */
async function tenantQuery(text, params) {
    const context = getTenantContext();
    if (!context || !context.tenantId) {
        throw new Error('TenantSecurityException: Attempted database query without active tenant context (Fail-Closed).');
    }
    if (context.client) {
        return context.client.query(text, params);
    }
    // Fallback if client is not directly in context: execute in an isolated transaction
    const client = await pool_js_1.appPool.connect();
    try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [context.tenantId]);
        const res = await client.query(text, params);
        await client.query('COMMIT');
        return res;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
