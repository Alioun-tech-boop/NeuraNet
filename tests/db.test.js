import { test, beforeAll, assert } from 'node:test';
import { pool } from '../src/db/connection.js';

await new Promise((resolve) => setTimeout(resolve, 100)); // small delay

test('PostgreSQL connection works', async () => {
  const { rows } = await pool.query('SELECT 1 AS test');
  assert.strictEqual(rows[0].test, 1);
});

test('Organizations table exists', async () => {
  const { rows } = await pool.query('SELECT id, name FROM organizations LIMIT 1');
  assert.ok(rows.length >= 0);
});

test('Agents table schema check', async () => {
  const { rows } = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'agents' ORDER BY ordinal_position
  `);
  const columnNames = rows.map(r => r.column_name);
  assert.ok(columnNames.includes('id'));
  assert.ok(columnNames.includes('organization_id'));
  assert.ok(columnNames.includes('name'));
});

test('Experiences table has visibility column', async () => {
  const { rows } = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'experiences' AND column_name = 'visibility'
  `);
  assert.ok(rows.length > 0);
});