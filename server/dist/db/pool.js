"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appPool = exports.superuserPool = void 0;
exports.withTenantTransaction = withTenantTransaction;
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
dotenv_1.default.config();
const superuserConnectionString = process.env.DATABASE_SUPERUSER_URL || 'postgres://macbook@localhost:5432/kombee_assess';
const appConnectionString = process.env.DATABASE_URL || 'postgres://kombee_app:kombee_secure_pass@localhost:5432/kombee_assess';
exports.superuserPool = new pg_1.default.Pool({
    connectionString: superuserConnectionString,
    max: 10,
});
exports.appPool = new pg_1.default.Pool({
    connectionString: appConnectionString,
    max: 20,
    idleTimeoutMillis: 30000,
});
/**
 * Execute a callback within an isolated tenant transaction on a single pooled client.
 * Sets app.tenant_id using `set_config(..., true)` which is LOCAL to the transaction.
 * Upon COMMIT or ROLLBACK, the setting is discarded by PostgreSQL.
 */
async function withTenantTransaction(tenantId, callback) {
    const client = await exports.appPool.connect();
    try {
        await client.query('BEGIN');
        // Set tenant id locally within this transaction only
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
