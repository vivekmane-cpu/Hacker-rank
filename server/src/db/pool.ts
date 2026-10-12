import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const superuserConnectionString = process.env.DATABASE_SUPERUSER_URL || 'postgres://macbook@localhost:5432/kombee_assess';
const appConnectionString = process.env.DATABASE_URL || 'postgres://kombee_app:kombee_secure_pass@localhost:5432/kombee_assess';

export const superuserPool = new pg.Pool({
  connectionString: superuserConnectionString,
  max: 10,
});

export const appPool = new pg.Pool({
  connectionString: appConnectionString,
  max: 20,
  idleTimeoutMillis: 30000,
});

/**
 * Execute a callback within an isolated tenant transaction on a single pooled client.
 * Sets app.tenant_id using `set_config(..., true)` which is LOCAL to the transaction.
 * Upon COMMIT or ROLLBACK, the setting is discarded by PostgreSQL.
 */
export async function withTenantTransaction<T>(
  tenantId: string,
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    // Set tenant id locally within this transaction only
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
