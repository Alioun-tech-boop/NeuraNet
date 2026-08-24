import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';
const sql = readFileSync('database/migrations/003-create-research-paths.up.sql','utf8');
const url = process.env.DATABASE_URL;
const isLocal = /@localhost|@127/.test(url);
const pool = new pg.Pool({ connectionString: url, ...(isLocal ? {} : { ssl: { rejectUnauthorized: false }})});
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query(sql);
  await c.query('COMMIT');
  console.log('Migration 003 OK');
  const r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'research_path%' ORDER BY table_name");
  console.log(r.rows.map(x=>x.table_name).join(','));
} catch(e) {
  await c.query('ROLLBACK');
  console.error('Migration failed:', e.message);
} finally {
  c.release();
  await pool.end();
}
