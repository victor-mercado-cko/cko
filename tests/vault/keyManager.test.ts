import { randomBytes } from 'crypto';
import { generateDek, wrapDek, unwrapDek } from '../../src/vault/keyManager';

describe('Key Manager (envelope encryption)', () => {
  const kek = randomBytes(32);

  test('generateDek returns 32-byte buffer', () => {
    const dek = generateDek();
    expect(dek.byteLength).toBe(32);
  });

  test('unwrapDek(wrapDek(dek)) === original dek', () => {
    const dek = generateDek();
    const wrapped = wrapDek(dek, kek);
    const unwrapped = unwrapDek(wrapped, kek);
    expect(unwrapped.toString('hex')).toBe(dek.toString('hex'));
  });

  test('different DEKs wrap to different ciphertexts', () => {
    const dek1 = generateDek();
    const dek2 = generateDek();
    expect(wrapDek(dek1, kek)).not.toBe(wrapDek(dek2, kek));
  });

  test('wrong KEK fails to unwrap', () => {
    const dek = generateDek();
    const wrapped = wrapDek(dek, kek);
    const wrongKek = randomBytes(32);
    expect(() => unwrapDek(wrapped, wrongKek)).toThrow();
  });
});
