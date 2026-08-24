import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';
const sql = readFileSync('database/migrations/007-path-steps-hash.up.sql','utf8');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: /@localhost|@127/.test(process.env.DATABASE_URL||'') ? false : { rejectUnauthorized: false } });
const c = await pool.connect();
try {
  await c.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await c.query('BEGIN'); await c.query(sql); await c.query('COMMIT');
  console.log('Migration 007 OK');
} catch (e) { await c.query('ROLLBACK'); console.error('FAILED:', e.message); process.exitCode = 1; }
finally { c.release(); await pool.end(); }
