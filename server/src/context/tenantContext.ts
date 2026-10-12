import { AsyncLocalStorage } from 'async_hooks';
import pg from 'pg';
import { appPool } from '../db/pool.js';

export interface TenantContext {
  tenantId: string;
  userId?: string;
  role?: string;
  userEmail?: string;
  environment: 'production' | 'sandbox';
  isPlatformAdmin?: boolean;
  client?: pg.PoolClient; // Transaction-bound client
}

const storage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

export function runWithTenantContext<T>(context: TenantContext, callback: () => T): T {
  return storage.run(context, callback);
}

/**
 * Execute a query within the ambient tenant context.
 * Uses the request's transaction client bound to SET LOCAL app.tenant_id.
 * If no ambient context exists, throws a strict fail-closed error.
 */
export async function tenantQuery<R extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<R>> {
  const context = getTenantContext();
  if (!context || !context.tenantId) {
    throw new Error('TenantSecurityException: Attempted database query without active tenant context (Fail-Closed).');
  }

  if (context.client) {
    return context.client.query<R>(text, params);
  }

  // Fallback if client is not directly in context: execute in an isolated transaction
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [context.tenantId]);
    const res = await client.query<R>(text, params);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
