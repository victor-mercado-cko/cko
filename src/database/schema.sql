-- CKO Self-Hosted Card Vault — PostgreSQL Schema
-- PCI DSS Level 1 scope: this database must reside in an isolated network segment
-- with restricted access, encrypted at-rest storage, and comprehensive audit logging.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── API Keys ────────────────────────────────────────────────────────────────
-- Plain-text key is never stored; only SHA-256(key) lives here.
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash     CHAR(64)    UNIQUE NOT NULL,  -- SHA-256 hex of the raw key
  key_prefix   VARCHAR(16) NOT NULL,         -- first chars shown in dashboards
  merchant_id  VARCHAR(64) NOT NULL,
  name         VARCHAR(255),
  scopes       TEXT[]      NOT NULL DEFAULT '{}',  -- e.g. {'store','charge','read','revoke'}
  status       VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_merchant ON api_keys(merchant_id);

-- ─── Payment Instruments (Vault) ─────────────────────────────────────────────
-- Raw PAN is NEVER stored in plaintext. Each row holds:
--   • AES-256-GCM ciphertext of the PAN
--   • A per-record DEK (Data Encryption Key) itself wrapped by the master KEK
-- CVV is intentionally absent — PCI DSS prohibits post-auth CVV storage.
CREATE TABLE IF NOT EXISTS payment_instruments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token            VARCHAR(64) UNIQUE NOT NULL,
  merchant_id      VARCHAR(64) NOT NULL,

  -- Envelope-encrypted PAN
  encrypted_pan    TEXT        NOT NULL,  -- JSON {ciphertext, iv, tag}
  encrypted_dek    TEXT        NOT NULL,  -- DEK wrapped by KEK, JSON {ciphertext, iv, tag}

  -- Display metadata (non-sensitive, stored plaintext)
  last_four        CHAR(4)     NOT NULL,
  expiry_month     CHAR(2)     NOT NULL,
  expiry_year      CHAR(4)     NOT NULL,
  scheme           VARCHAR(20) NOT NULL,
  cardholder_name  VARCHAR(255),

  -- HMAC-SHA256(PAN|month|year, secret) — enables deduplication without PAN comparison
  fingerprint      CHAR(64)    NOT NULL,

  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_instruments_token      ON payment_instruments(token);
CREATE INDEX IF NOT EXISTS idx_instruments_merchant   ON payment_instruments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_instruments_fingerprint ON payment_instruments(merchant_id, fingerprint);

-- ─── Charges ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charges (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id           VARCHAR(64) UNIQUE NOT NULL,
  token               VARCHAR(64) NOT NULL REFERENCES payment_instruments(token),
  merchant_id         VARCHAR(64) NOT NULL,
  amount              BIGINT      NOT NULL,   -- smallest currency unit (cents)
  currency            CHAR(3)     NOT NULL,
  status              VARCHAR(20) NOT NULL,
  processor_reference VARCHAR(255),
  idempotency_key     VARCHAR(255),
  description         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charges_token         ON charges(token);
CREATE INDEX IF NOT EXISTS idx_charges_merchant      ON charges(merchant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_charges_idempotency
  ON charges(merchant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ─── Audit Log ───────────────────────────────────────────────────────────────
-- Append-only. No UPDATE or DELETE should ever be granted on this table.
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id    VARCHAR(64) NOT NULL,   -- api_key.id
  merchant_id VARCHAR(64),
  action      VARCHAR(50) NOT NULL,
  token       VARCHAR(64),
  request_id  VARCHAR(64),
  ip_address  INET,
  user_agent  TEXT,
  outcome     VARCHAR(20) NOT NULL,
  error_code  VARCHAR(50),
  metadata    JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_audit_ts      ON audit_logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_token   ON audit_logs(token);
CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_merchant ON audit_logs(merchant_id);
