/**
 * Unit tests for vaultService — database calls are mocked so no live DB is needed.
 */
import { randomBytes } from 'crypto';

// Mock database before importing vaultService
jest.mock('../../src/database/connection', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

// Mock config to provide valid keys
jest.mock('../../src/config', () => ({
  config: {
    kek: randomBytes(32),
    fingerprintSecret: randomBytes(32),
    nodeEnv: 'test',
    databaseUrl: 'postgresql://test',
    port: 3000,
    processor: { url: '', apiKey: '' },
  },
}));

import { query, withTransaction } from '../../src/database/connection';
import { storeCard, getInstrument, revokeInstrument, VaultError } from '../../src/services/vaultService';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;

const futureYear = (new Date().getFullYear() + 2).toString();

function makeInstrumentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'uuid-1',
    token: 'tok_v1_' + 'a'.repeat(48),
    merchant_id: 'merch_1',
    encrypted_pan: JSON.stringify({ ciphertext: 'aa', iv: 'bb', tag: 'cc' }),
    encrypted_dek: JSON.stringify({ ciphertext: 'dd', iv: 'ee', tag: 'ff' }),
    last_four: '1111',
    expiry_month: '12',
    expiry_year: futureYear,
    scheme: 'visa',
    cardholder_name: null,
    fingerprint: 'fp_' + 'a'.repeat(61),
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
    expires_at: new Date(Date.now() + 86400000 * 365),
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('storeCard', () => {
  test('returns existing token when fingerprint matches (idempotent)', async () => {
    const existing = makeInstrumentRow();
    mockQuery.mockResolvedValueOnce({ rows: [existing], rowCount: 1 } as never);

    const result = await storeCard('merch_1', {
      pan: '4111111111111111',
      expiryMonth: '12',
      expiryYear: futureYear,
    });

    expect(result.token).toBe(existing.token);
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });

  test('creates new instrument when no existing fingerprint', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const newRow = makeInstrumentRow({ token: 'tok_v1_' + 'b'.repeat(48) });
    mockWithTransaction.mockImplementationOnce(async (fn) => {
      const fakeClient = {
        query: jest.fn().mockResolvedValue({ rows: [newRow] }),
      } as never;
      return fn(fakeClient);
    });

    const result = await storeCard('merch_1', {
      pan: '4111111111111111',
      expiryMonth: '12',
      expiryYear: futureYear,
    });

    expect(result.lastFour).toBe('1111');
    expect(result.scheme).toBe('visa');
  });

  test('throws INVALID_PAN for bad Luhn', async () => {
    await expect(
      storeCard('merch_1', { pan: '4111111111111112', expiryMonth: '12', expiryYear: futureYear }),
    ).rejects.toMatchObject({ code: 'INVALID_PAN' });
  });

  test('throws EXPIRED_CARD for past expiry', async () => {
    await expect(
      storeCard('merch_1', { pan: '4111111111111111', expiryMonth: '01', expiryYear: '2020' }),
    ).rejects.toMatchObject({ code: 'EXPIRED_CARD' });
  });
});

describe('getInstrument', () => {
  test('returns summary for existing token', async () => {
    const row = makeInstrumentRow();
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as never);

    const result = await getInstrument('merch_1', row.token as string);
    expect(result.token).toBe(row.token);
  });

  test('throws NOT_FOUND when token missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(
      getInstrument('merch_1', 'tok_v1_' + 'a'.repeat(48)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('revokeInstrument', () => {
  test('resolves when token found and revoked', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await expect(revokeInstrument('merch_1', 'tok_v1_' + 'a'.repeat(48))).resolves.toBeUndefined();
  });

  test('throws NOT_FOUND when no rows updated', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(
      revokeInstrument('merch_1', 'tok_v1_' + 'a'.repeat(48)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('VaultError', () => {
  test('has correct name and code', () => {
    const err = new VaultError('NOT_FOUND', 'missing');
    expect(err.name).toBe('VaultError');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('missing');
  });
});
