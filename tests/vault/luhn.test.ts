import { luhnCheck } from '../../src/vault/luhn';

describe('luhnCheck', () => {
  test('valid Visa test card passes', () => {
    expect(luhnCheck('4111111111111111')).toBe(true);
  });

  test('valid Mastercard test card passes', () => {
    expect(luhnCheck('5500005555555559')).toBe(true);
  });

  test('valid Amex test card passes', () => {
    expect(luhnCheck('378282246310005')).toBe(true);
  });

  test('altered digit fails', () => {
    expect(luhnCheck('4111111111111112')).toBe(false);
  });

  test('all zeros passes Luhn (sum=0 mod 10=0) but is caught by scheme/length checks', () => {
    // 16-digit all-zeros is technically Luhn-valid; business logic rejects it via scheme detection
    expect(luhnCheck('0000000000000000')).toBe(true);
  });

  test('too short fails', () => {
    expect(luhnCheck('411111')).toBe(false);
  });

  test('ignores spaces and dashes', () => {
    expect(luhnCheck('4111-1111-1111-1111')).toBe(true);
  });
});
