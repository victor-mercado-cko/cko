/**
 * Processor service — sends the resolved PAN to the downstream acquirer/network.
 *
 * In a real Option C deployment this calls the actual payment network (Visa/MC)
 * or an acquirer API over a mutually-authenticated TLS connection from within
 * the vault's isolated network segment.
 *
 * The mock below simulates authorization responses so the full flow can be
 * exercised end-to-end without a live processor connection.
 */
import { generateChargeId } from '../vault/tokenizer';
import type { ChargeInput, ChargeRecord, ChargeStatus } from '../types';
import { query, withTransaction } from '../database/connection';

export interface ProcessorRequest {
  pan: string;
  expiryMonth: string;
  expiryYear: string;
  amount: number;
  currency: string;
  merchantId: string;
  idempotencyKey?: string;
}

export interface ProcessorResponse {
  processorReference: string;
  status: ChargeStatus;
  authCode?: string;
  declineCode?: string;
}

async function submitToProcessor(req: ProcessorRequest): Promise<ProcessorResponse> {
  // Mock: decline test PANs starting with 4000000000000002 (Stripe-style test card).
  if (req.pan === '4000000000000002') {
    return { processorReference: 'proc_decline_test', status: 'declined', declineCode: 'do_not_honor' };
  }
  // Mock: simulate a processor round-trip.
  await new Promise((r) => setTimeout(r, 50));
  return {
    processorReference: `proc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    status: 'authorized',
    authCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
  };
}

export async function charge(
  token: string,
  merchantId: string,
  pan: string,
  expiryMonth: string,
  expiryYear: string,
  input: ChargeInput,
): Promise<ChargeRecord> {
  // Idempotency: return existing charge if key already used.
  if (input.idempotencyKey) {
    const existing = await query<Record<string, unknown>>(
      `SELECT * FROM charges WHERE merchant_id = $1 AND idempotency_key = $2`,
      [merchantId, input.idempotencyKey],
    );
    if (existing.rows.length > 0) {
      return rowToCharge(existing.rows[0]);
    }
  }

  const processorResp = await submitToProcessor({
    pan,
    expiryMonth,
    expiryYear,
    amount: input.amount,
    currency: input.currency,
    merchantId,
    idempotencyKey: input.idempotencyKey,
  });

  const chargeId = generateChargeId();
  const status: ChargeStatus =
    processorResp.status === 'authorized' ? 'authorized' : 'declined';

  const result = await withTransaction(async (client) => {
    const res = await client.query<Record<string, unknown>>(
      `INSERT INTO charges
         (charge_id, token, merchant_id, amount, currency, status,
          processor_reference, idempotency_key, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        chargeId,
        token,
        merchantId,
        input.amount,
        input.currency.toUpperCase(),
        status,
        processorResp.processorReference,
        input.idempotencyKey ?? null,
        input.description ?? null,
      ],
    );
    return res.rows[0];
  });

  return rowToCharge(result);
}

export async function listCharges(
  merchantId: string,
  token: string,
): Promise<ChargeRecord[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM charges WHERE token = $1 AND merchant_id = $2 ORDER BY created_at DESC`,
    [token, merchantId],
  );
  return result.rows.map(rowToCharge);
}

function rowToCharge(row: Record<string, unknown>): ChargeRecord {
  return {
    id: row['id'] as string,
    chargeId: row['charge_id'] as string,
    token: row['token'] as string,
    merchantId: row['merchant_id'] as string,
    amount: row['amount'] as number,
    currency: row['currency'] as string,
    status: row['status'] as ChargeStatus,
    processorReference: row['processor_reference'] as string | null,
    idempotencyKey: row['idempotency_key'] as string | null,
    description: row['description'] as string | null,
    createdAt: row['created_at'] as Date,
  };
}
