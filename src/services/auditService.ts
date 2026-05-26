import { query } from '../database/connection';
import type { AuditAction, AuditOutcome, RequestContext } from '../types';

export interface AuditEntry {
  action: AuditAction;
  outcome: AuditOutcome;
  token?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(ctx: RequestContext, entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs
         (actor_id, merchant_id, action, token, request_id, ip_address, user_agent, outcome, error_code, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::inet, $7, $8, $9, $10)`,
      [
        ctx.apiKeyId,
        ctx.merchantId,
        entry.action,
        entry.token ?? null,
        ctx.requestId,
        ctx.ip,
        ctx.userAgent,
        entry.outcome,
        entry.errorCode ?? null,
        JSON.stringify(entry.metadata ?? {}),
      ],
    );
  } catch (err) {
    // Audit failures must never silently swallow business errors; log separately.
    console.error('[audit] Failed to write audit log:', err);
  }
}
