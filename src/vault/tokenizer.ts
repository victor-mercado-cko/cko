import { randomBytes, createHmac } from 'crypto';

const TOKEN_PREFIX = 'tok_v1_';
const CHARGE_PREFIX = 'ch_v1_';

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(24).toString('hex');
}

export function generateChargeId(): string {
  return CHARGE_PREFIX + randomBytes(16).toString('hex');
}

export function isValidTokenFormat(token: string): boolean {
  return /^tok_v1_[0-9a-f]{48}$/.test(token);
}

/**
 * Stable fingerprint for a card — used to detect duplicates per merchant
 * without ever storing or comparing raw PAN values.
 *
 * fingerprint = HMAC-SHA256(normalizedPan | expiryMonth | expiryYear, fingerprintSecret)
 */
export function computeFingerprint(
  pan: string,
  expiryMonth: string,
  expiryYear: string,
  secret: Buffer,
): string {
  const data = `${pan.replace(/\D/g, '')}|${expiryMonth}|${expiryYear}`;
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function maskPan(pan: string): string {
  const digits = pan.replace(/\D/g, '');
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

export function lastFour(pan: string): string {
  const digits = pan.replace(/\D/g, '');
  return digits.slice(-4);
}
