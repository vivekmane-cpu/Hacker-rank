import { superuserPool } from '../../db/pool.js';
import { RecordUsageEventInput, RecordUsageEventSchema } from './types.js';

// 1. Record Billable Usage Event (Append-only)
export async function recordUsageEvent(
  tenantId: string,
  input: RecordUsageEventInput
) {
  const validated = RecordUsageEventSchema.parse(input);

  const res = await superuserPool.query(
    `INSERT INTO usage_events (
       tenant_id, module, event_type, quantity, source, environment
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      tenantId,
      validated.module,
      validated.event_type,
      validated.quantity,
      validated.source,
      validated.environment
    ]
  );
  return res.rows[0];
}

// 2. Aggregate Usage Roll-up by Module and Event Type
export async function getTenantUsageRollup(
  tenantId: string,
  startDate?: string,
  endDate?: string
) {
  let query = `
    SELECT 
      module, 
      event_type, 
      SUM(quantity)::numeric(12,2) as total_quantity,
      COUNT(*)::integer as event_count
    FROM usage_events
    WHERE tenant_id = $1
  `;
  const params: any[] = [tenantId];

  if (startDate) {
    params.push(startDate);
    query += ` AND created_at >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    query += ` AND created_at <= $${params.length}`;
  }

  query += ` GROUP BY module, event_type ORDER BY module, event_type`;
  const res = await superuserPool.query(query, params);

  const breakdowns = res.rows.map(r => ({
    module: r.module,
    eventType: r.event_type,
    quantity: Number(r.total_quantity),
    eventCount: Number(r.event_count)
  }));

  // Aggregated totals
  let totalAttempts = 0;
  let totalComputeSeconds = 0;
  let totalAiTokens = 0;
  let totalApiCalls = 0;

  for (const b of breakdowns) {
    if (b.eventType.includes('attempt')) totalAttempts += b.quantity;
    if (b.eventType.includes('runtime') || b.eventType.includes('execution')) totalComputeSeconds += b.quantity;
    if (b.eventType.includes('token')) totalAiTokens += b.quantity;
    if (b.eventType.includes('api')) totalApiCalls += b.quantity;
  }

  // Estimated standard platform usage costs
  const estimatedCost = (
    totalAttempts * 5.0 + // $5 per completed candidate test
    (totalComputeSeconds / 3600) * 0.10 + // $0.10 per compute hour
    (totalAiTokens / 1000) * 0.002 + // $0.002 per 1k AI tokens
    (totalApiCalls / 10000) * 0.50 // $0.50 per 10k API requests
  );

  return {
    tenantId,
    metrics: {
      totalAttempts,
      totalComputeSeconds,
      totalAiTokens,
      totalApiCalls
    },
    estimatedCostUsd: Number(estimatedCost.toFixed(2)),
    breakdowns
  };
}

// 3. Billing Tier & Quota Summary
export async function getBillingSummary(tenantId: string) {
  const tenantRes = await superuserPool.query(
    `SELECT id, name, slug, billing_status, status FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if ((tenantRes.rowCount ?? 0) === 0) {
    throw new Error('Tenant not found');
  }
  const tenant = tenantRes.rows[0];

  const rollup = await getTenantUsageRollup(tenantId);

  const tiers: Record<string, any> = {
    trial: { name: 'Trial Sandbox', quotaAttempts: 50, ratePerAttempt: 0 },
    paid: { name: 'Enterprise Pro', quotaAttempts: 5000, ratePerAttempt: 5.0 },
    internal: { name: 'Internal Unlimited', quotaAttempts: 999999, ratePerAttempt: 0 }
  };
  const currentTier = tiers[tenant.billing_status] || tiers.trial;

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      billingStatus: tenant.billing_status
    },
    tier: currentTier,
    usage: rollup.metrics,
    estimatedCostUsd: rollup.estimatedCostUsd,
    quotaRemaining: Math.max(0, currentTier.quotaAttempts - rollup.metrics.totalAttempts)
  };
}
