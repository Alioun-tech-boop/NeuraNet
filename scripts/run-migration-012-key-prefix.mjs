/* Migration 012 — api_keys.key_prefix
 * Stores a short non-sensitive prefix of each key so owners can identify
 * keys in listings without ever exposing the full secret.
 * Per AGENTS.md §27: keys hashed at rest, auditable, revocable. */
import 'dotenv/config';
import { pool } from '../src/db/connection.js';

const sql = `
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix VARCHAR(16);
`;

try {
  await pool.query(sql);
  console.log('✓ migration 012 applied: api_keys.key_prefix');
  process.exit(0);
} catch (e) {
  console.error('migration failed:', e.message);
  process.exit(1);
}
