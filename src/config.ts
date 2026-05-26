import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function requireHex(key: string, expectedBytes: number): Buffer {
  const hex = requireEnv(key);
  if (hex.length !== expectedBytes * 2) {
    throw new Error(`${key} must be ${expectedBytes * 2} hex chars (${expectedBytes} bytes)`);
  }
  return Buffer.from(hex, 'hex');
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: requireEnv('DATABASE_URL'),

  // Master Key Encryption Key — wraps per-record Data Encryption Keys.
  // In production this lives in an HSM or AWS KMS; here it's loaded from env.
  kek: requireHex('KEK_HEX', 32),

  // HMAC secret for stable card fingerprints used for deduplication.
  fingerprintSecret: requireHex('FINGERPRINT_SECRET_HEX', 32),

  bootstrapApiKey: process.env.BOOTSTRAP_API_KEY,

  processor: {
    url: process.env.PROCESSOR_URL ?? 'http://localhost:4000',
    apiKey: process.env.PROCESSOR_API_KEY ?? '',
  },
};
