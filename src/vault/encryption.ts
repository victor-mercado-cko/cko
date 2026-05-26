import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptedBlob {
  ciphertext: string; // hex
  iv: string;         // hex
  tag: string;        // hex
}

export function encrypt(plaintext: string, key: Buffer): EncryptedBlob {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

export function decrypt(blob: EncryptedBlob, key: Buffer): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(blob.iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(blob.tag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

// Serialize/deserialize for single-column DB storage.
export function serializeBlob(blob: EncryptedBlob): string {
  return JSON.stringify(blob);
}

export function deserializeBlob(raw: string): EncryptedBlob {
  return JSON.parse(raw) as EncryptedBlob;
}
