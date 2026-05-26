export type CardScheme = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';
export type InstrumentStatus = 'active' | 'expired' | 'revoked';
export type ChargeStatus = 'authorized' | 'captured' | 'declined' | 'failed';
export type AuditOutcome = 'success' | 'failure';

export type AuditAction =
  | 'STORE_INSTRUMENT'
  | 'RETRIEVE_INSTRUMENT'
  | 'REVOKE_INSTRUMENT'
  | 'CHARGE_INSTRUMENT'
  | 'LIST_CHARGES'
  | 'RESOLVE_TOKEN';

export interface StoredInstrument {
  id: string;
  token: string;
  merchantId: string;
  encryptedPan: string;
  panIv: string;
  encryptedDek: string;
  dekIv: string;
  lastFour: string;
  expiryMonth: string;
  expiryYear: string;
  scheme: CardScheme;
  cardholderName: string | null;
  fingerprint: string;
  status: InstrumentStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface InstrumentSummary {
  token: string;
  lastFour: string;
  expiryMonth: string;
  expiryYear: string;
  scheme: CardScheme;
  cardholderName: string | null;
  fingerprint: string;
  status: InstrumentStatus;
  createdAt: Date;
}

export interface StoreCardInput {
  pan: string;
  expiryMonth: string;
  expiryYear: string;
  cardholderName?: string;
}

export interface ChargeInput {
  amount: number;
  currency: string;
  description?: string;
  idempotencyKey?: string;
}

export interface ChargeRecord {
  id: string;
  chargeId: string;
  token: string;
  merchantId: string;
  amount: number;
  currency: string;
  status: ChargeStatus;
  processorReference: string | null;
  idempotencyKey: string | null;
  description: string | null;
  createdAt: Date;
}

export interface ApiKey {
  id: string;
  keyHash: string;
  keyPrefix: string;
  merchantId: string;
  name: string | null;
  scopes: string[];
  status: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}

export interface RequestContext {
  requestId: string;
  merchantId: string;
  apiKeyId: string;
  scopes: string[];
  ip: string;
  userAgent: string;
}
