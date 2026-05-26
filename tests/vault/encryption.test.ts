import { randomBytes } from 'crypto';
import { encrypt, decrypt, serializeBlob, deserializeBlob } from '../../src/vault/encryption';

describe('AES-256-GCM encryption', () => {
  const key = randomBytes(32);

  test('roundtrip: decrypt(encrypt(plaintext)) === plaintext', () => {
    const plaintext = '4111111111111111';
    const blob = encrypt(plaintext, key);
    expect(decrypt(blob, key)).toBe(plaintext);
  });

  test('produces different ciphertext each call (fresh IV)', () => {
    const blob1 = encrypt('4111111111111111', key);
    const blob2 = encrypt('4111111111111111', key);
    expect(blob1.iv).not.toBe(blob2.iv);
    expect(blob1.ciphertext).not.toBe(blob2.ciphertext);
  });

  test('tampered ciphertext throws', () => {
    const blob = encrypt('secret', key);
    const tampered = { ...blob, ciphertext: blob.ciphertext.slice(0, -2) + 'ff' };
    expect(() => decrypt(tampered, key)).toThrow();
  });

  test('wrong key throws', () => {
    const blob = encrypt('secret', key);
    const wrongKey = randomBytes(32);
    expect(() => decrypt(blob, wrongKey)).toThrow();
  });

  test('serialize / deserialize roundtrip', () => {
    const blob = encrypt('test', key);
    const serialized = serializeBlob(blob);
    const deserialized = deserializeBlob(serialized);
    expect(decrypt(deserialized, key)).toBe('test');
  });
});
