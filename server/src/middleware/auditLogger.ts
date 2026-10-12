import { Request, Response, NextFunction } from 'express';
import { getTenantContext, tenantQuery } from '../context/tenantContext.js';

export interface AuditEntry {
  actorId: string;
  actorType: 'user' | 'api_key' | 'candidate' | 'system';
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
}

// Ensure audit log is content-free (no answers, no source code, no PII)
function sanitizeAuditMetadata(meta?: Record<string, any>): Record<string, any> {
  if (!meta) return {};
  const sanitized: Record<string, any> = {};
  const prohibitedKeys = ['code', 'answer', 'password', 'token', 'secret', 'email', 'name', 'content'];

  for (const [key, value] of Object.entries(meta)) {
    if (prohibitedKeys.some(pk => key.toLowerCase().includes(pk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function logAuditEvent(entry: AuditEntry): Promise<void> {
  const context = getTenantContext();
  if (!context || !context.tenantId) {
    throw new Error('AuditSecurityException: Cannot record audit entry without active tenant context.');
  }

  const cleanMetadata = sanitizeAuditMetadata(entry.metadata);

  await tenantQuery(
    `INSERT INTO audit_log (tenant_id, actor_id, actor_type, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      context.tenantId,
      entry.actorId,
      entry.actorType,
      entry.action,
      entry.entityType,
      entry.entityId,
      JSON.stringify(cleanMetadata)
    ]
  );
}

export function auditMiddleware(action: string, entityType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    res.send = function (body) {
      res.send = originalSend;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const context = getTenantContext();
        if (context) {
          const actorId = context.userId || context.tenantId;
          const actorType = context.role === 'API_KEY' ? 'api_key' : context.role === 'Candidate' ? 'candidate' : 'user';
          const entityId = req.params.id || req.body?.id || '00000000-0000-0000-0000-000000000000';

          logAuditEvent({
            actorId,
            actorType,
            action,
            entityType,
            entityId,
            metadata: { method: req.method, path: req.path }
          }).catch(err => {
            console.error('[AuditLogger] Failed to write audit event:', err);
          });
        }
      }
      return originalSend.call(this, body);
    };
    next();
  };
}
