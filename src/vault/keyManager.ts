/**
 * Envelope encryption key manager.
 *
 * Each stored card gets a unique 256-bit Data Encryption Key (DEK).
 * The DEK is wrapped (encrypted) by the master Key Encryption Key (KEK)
 * before being persisted alongside the ciphertext.
 *
 * Production note: replace the KEK source with an HSM call or KMS API
 * (AWS KMS GenerateDataKey / Decrypt, GCP Cloud KMS, HashiCorp Vault, etc.)
 */
import { randomBytes } from 'crypto';
import { encrypt, decrypt, serializeBlob, deserializeBlob } from './encryption';

export function generateDek(): Buffer {
  return randomBytes(32);
}

export function wrapDek(dek: Buffer, kek: Buffer): string {
  const blob = encrypt(dek.toString('hex'), kek);
  return serializeBlob(blob);
}

export function unwrapDek(wrappedDek: string, kek: Buffer): Buffer {
  const blob = deserializeBlob(wrappedDek);
  const dekHex = decrypt(blob, kek);
  return Buffer.from(dekHex, 'hex');
}
