import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';
const sql = readFileSync('database/migrations/004-progressive-path-optimizer.up.sql','utf8');
const url = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url, ssl: /@localhost|@127/.test(url) ? false : { rejectUnauthorized: false } });
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query(sql);
  await c.query('COMMIT');
  console.log('Migration 004 OK');
} catch (e) {
  await c.query('ROLLBACK');
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally { c.release(); await pool.end(); }
