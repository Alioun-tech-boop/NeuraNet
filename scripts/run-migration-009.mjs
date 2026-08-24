import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: /@localhost|@127/.test(process.env.DATABASE_URL||'') ? false : { rejectUnauthorized: false } });
await pool.query(fs_mig());
function fs_mig() { return `ALTER TABLE resolution_paths ADD COLUMN IF NOT EXISTS embedding JSONB DEFAULT '[]';`; }
console.log('009 embedding column OK');
await pool.end();
