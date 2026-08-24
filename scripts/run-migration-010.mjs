import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';
const sql = readFileSync('database/migrations/010-semantic-embeddings.up.sql','utf8');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: /@localhost|@127/.test(process.env.DATABASE_URL||'') ? false : { rejectUnauthorized: false } });
try {
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(sql);
  console.log('Migration 010 OK');
} catch(e) { console.error('FAILED:', e.message); }
await pool.end();
