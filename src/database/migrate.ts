import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { pool, query } from './connection';
import { config } from '../config';

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Running schema migration...');
  await query(sql);
  console.log('Schema migration complete.');

  if (config.bootstrapApiKey) {
    const keyHash = createHash('sha256').update(config.bootstrapApiKey).digest('hex');
    const keyPrefix = config.bootstrapApiKey.slice(0, 12);

    await query(
      `INSERT INTO api_keys (key_hash, key_prefix, merchant_id, name, scopes)
       VALUES ($1, $2, 'system', 'Bootstrap Admin Key', ARRAY['store','charge','read','revoke','admin'])
       ON CONFLICT (key_hash) DO NOTHING`,
      [keyHash, keyPrefix],
    );
    console.log('Bootstrap API key seeded.');
  }

  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
