import type { CardScheme } from '../types';

export function detectScheme(pan: string): CardScheme {
  const digits = pan.replace(/\D/g, '');

  if (/^4/.test(digits)) return 'visa';

  if (/^(5[1-5]|2(2[2-9][1-9]|[3-6]\d{2}|7[01]\d|720))/.test(digits)) return 'mastercard';

  if (/^3[47]/.test(digits)) return 'amex';

  if (/^(6011|64[4-9]|65|622(1(2[6-9]|[3-9]\d)|[2-8]\d{2}|9([01]\d|2[0-5])))/.test(digits))
    return 'discover';

  return 'unknown';
}
