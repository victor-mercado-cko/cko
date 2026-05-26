import { config } from '../config';
import { encrypt, decrypt, serializeBlob, deserializeBlob } from '../vault/encryption';
import { generateDek, wrapDek, unwrapDek } from '../vault/keyManager';
import { generateToken, computeFingerprint, lastFour } from '../vault/tokenizer';
import { detectScheme } from '../vault/schemeDetector';
import { luhnCheck } from '../vault/luhn';
import { withTransaction, query } from '../database/connection';
import type {
  StoredInstrument,
  InstrumentSummary,
  StoreCardInput,
  CardScheme,
} from '../types';

export class VaultError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

function rowToInstrument(row: Record<string, unknown>): StoredInstrument {
  return {
    id: row['id'] as string,
    token: row['token'] as string,
    merchantId: row['merchant_id'] as string,
    encryptedPan: row['encrypted_pan'] as string,
    panIv: '',
    encryptedDek: row['encrypted_dek'] as string,
    dekIv: '',
    lastFour: row['last_four'] as string,
    expiryMonth: row['expiry_month'] as string,
    expiryYear: row['expiry_year'] as string,
    scheme: row['scheme'] as CardScheme,
    cardholderName: row['cardholder_name'] as string | null,
    fingerprint: row['fingerprint'] as string,
    status: row['status'] as StoredInstrument['status'],
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
    expiresAt: row['expires_at'] as Date,
  };
}

export function toSummary(instrument: StoredInstrument): InstrumentSummary {
  return {
    token: instrument.token,
    lastFour: instrument.lastFour,
    expiryMonth: instrument.expiryMonth,
    expiryYear: instrument.expiryYear,
    scheme: instrument.scheme,
    cardholderName: instrument.cardholderName,
    fingerprint: instrument.fingerprint,
    status: instrument.status,
    createdAt: instrument.createdAt,
  };
}

export async function storeCard(
  merchantId: string,
  input: StoreCardInput,
): Promise<InstrumentSummary> {
  const normalizedPan = input.pan.replace(/\D/g, '');

  if (!luhnCheck(normalizedPan)) {
    throw new VaultError('INVALID_PAN', 'Card number failed Luhn check');
  }

  const now = new Date();
  const expiryDate = new Date(
    parseInt(input.expiryYear, 10),
    parseInt(input.expiryMonth, 10) - 1,
    1,
  );
  expiryDate.setMonth(expiryDate.getMonth() + 1);  // expires end of stated month

  if (expiryDate <= now) {
    throw new VaultError('EXPIRED_CARD', 'Card expiry date is in the past');
  }

  const fingerprint = computeFingerprint(
    normalizedPan,
    input.expiryMonth,
    input.expiryYear,
    config.fingerprintSecret,
  );

  // Idempotent: return existing token if same card already stored for this merchant.
  const existing = await query<Record<string, unknown>>(
    `SELECT * FROM payment_instruments
     WHERE merchant_id = $1 AND fingerprint = $2 AND status = 'active'
     LIMIT 1`,
    [merchantId, fingerprint],
  );

  if (existing.rows.length > 0) {
    return toSummary(rowToInstrument(existing.rows[0]));
  }

  // Envelope-encrypt the PAN with a fresh per-record DEK.
  const dek = generateDek();
  const panBlob = encrypt(normalizedPan, dek);
  const wrappedDek = wrapDek(dek, config.kek);
  const token = generateToken();
  const scheme = detectScheme(normalizedPan);
  const l4 = lastFour(normalizedPan);

  const result = await withTransaction(async (client) => {
    const res = await client.query<Record<string, unknown>>(
      `INSERT INTO payment_instruments
         (token, merchant_id, encrypted_pan, encrypted_dek, last_four,
          expiry_month, expiry_year, scheme, cardholder_name, fingerprint, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        token,
        merchantId,
        serializeBlob(panBlob),
        wrappedDek,
        l4,
        input.expiryMonth,
        input.expiryYear,
        scheme,
        input.cardholderName ?? null,
        fingerprint,
        expiryDate.toISOString(),
      ],
    );
    return res.rows[0];
  });

  return toSummary(rowToInstrument(result));
}

export async function getInstrument(
  merchantId: string,
  token: string,
): Promise<InstrumentSummary> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM payment_instruments WHERE token = $1 AND merchant_id = $2`,
    [token, merchantId],
  );

  if (result.rows.length === 0) {
    throw new VaultError('NOT_FOUND', 'Payment instrument not found');
  }

  return toSummary(rowToInstrument(result.rows[0]));
}

export async function revokeInstrument(
  merchantId: string,
  token: string,
): Promise<void> {
  const result = await query(
    `UPDATE payment_instruments
     SET status = 'revoked', updated_at = NOW()
     WHERE token = $1 AND merchant_id = $2 AND status = 'active'`,
    [token, merchantId],
  );

  if (result.rowCount === 0) {
    throw new VaultError('NOT_FOUND', 'Active payment instrument not found');
  }
}

/**
 * Resolve a token back to the raw PAN for processor submission.
 * This is the only place in the codebase where PAN plaintext is reconstructed.
 * Access is restricted: only the processor service calls this internally.
 */
export async function resolveTokenToPan(
  merchantId: string,
  token: string,
): Promise<{ pan: string; expiryMonth: string; expiryYear: string; scheme: CardScheme }> {
  const result = await query<Record<string, unknown>>(
    `SELECT encrypted_pan, encrypted_dek, expiry_month, expiry_year, scheme, status
     FROM payment_instruments
     WHERE token = $1 AND merchant_id = $2`,
    [token, merchantId],
  );

  if (result.rows.length === 0) {
    throw new VaultError('NOT_FOUND', 'Payment instrument not found');
  }

  const row = result.rows[0];
  if (row['status'] !== 'active') {
    throw new VaultError('INSTRUMENT_INACTIVE', `Instrument status is ${row['status']}`);
  }

  const dek = unwrapDek(row['encrypted_dek'] as string, config.kek);
  const pan = decrypt(deserializeBlob(row['encrypted_pan'] as string), dek);

  return {
    pan,
    expiryMonth: row['expiry_month'] as string,
    expiryYear: row['expiry_year'] as string,
    scheme: row['scheme'] as CardScheme,
  };
}
