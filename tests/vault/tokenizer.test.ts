import { randomBytes } from 'crypto';
import {
  generateToken,
  generateChargeId,
  isValidTokenFormat,
  computeFingerprint,
  maskPan,
  lastFour,
} from '../../src/vault/tokenizer';
import { detectScheme } from '../../src/vault/schemeDetector';

describe('generateToken', () => {
  test('starts with tok_v1_', () => {
    expect(generateToken()).toMatch(/^tok_v1_/);
  });

  test('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateToken));
    expect(tokens.size).toBe(1000);
  });
});

describe('generateChargeId', () => {
  test('starts with ch_v1_', () => {
    expect(generateChargeId()).toMatch(/^ch_v1_/);
  });
});

describe('isValidTokenFormat', () => {
  test('accepts a valid token', () => {
    expect(isValidTokenFormat(generateToken())).toBe(true);
  });

  test('rejects garbage', () => {
    expect(isValidTokenFormat('not_a_token')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidTokenFormat('')).toBe(false);
  });
});

describe('computeFingerprint', () => {
  const secret = randomBytes(32);

  test('same inputs produce same fingerprint', () => {
    const a = computeFingerprint('4111111111111111', '12', '2028', secret);
    const b = computeFingerprint('4111111111111111', '12', '2028', secret);
    expect(a).toBe(b);
  });

  test('different PANs produce different fingerprints', () => {
    const a = computeFingerprint('4111111111111111', '12', '2028', secret);
    const b = computeFingerprint('4000000000000002', '12', '2028', secret);
    expect(a).not.toBe(b);
  });

  test('different secrets produce different fingerprints', () => {
    const a = computeFingerprint('4111111111111111', '12', '2028', randomBytes(32));
    const b = computeFingerprint('4111111111111111', '12', '2028', randomBytes(32));
    expect(a).not.toBe(b);
  });
});

describe('maskPan', () => {
  test('masks all but last 4 digits', () => {
    expect(maskPan('4111111111111111')).toBe('************1111');
  });
});

describe('lastFour', () => {
  test('returns last 4 digits', () => {
    expect(lastFour('4111111111111111')).toBe('1111');
    expect(lastFour('378282246310005')).toBe('0005');
  });
});

describe('detectScheme', () => {
  test('Visa', () => expect(detectScheme('4111111111111111')).toBe('visa'));
  test('Mastercard (5x)', () => expect(detectScheme('5500005555555559')).toBe('mastercard'));
  test('Mastercard (2x)', () => expect(detectScheme('2221000000000009')).toBe('mastercard'));
  test('Amex', () => expect(detectScheme('378282246310005')).toBe('amex'));
  test('Discover', () => expect(detectScheme('6011111111111117')).toBe('discover'));
  test('Unknown', () => expect(detectScheme('9999999999999999')).toBe('unknown'));
});
