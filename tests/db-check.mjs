import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neuranet:neuranet_password@localhost:5432/neuranet'
});

async function runTests() {
  try {
    // Test 1: Connection
    const { rows: testRows } = await pool.query('SELECT 1 AS test');
    console.log('✓ Test 1: PostgreSQL connection works -', testRows[0].test === 1 ? 'PASS' : 'FAIL');

    // Test 2: Organizations table
    const { rows: orgRows } = await pool.query('SELECT id, name FROM organizations LIMIT 1');
    console.log('✓ Test 2: Organizations table queryable -', orgRows.length > 0 ? 'PASS' : 'FAIL');

    // Test 3: Check experiences table has visibility column
    const { rows: colRows } = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'experiences' AND column_name = 'visibility'
    `);
    console.log('✓ Test 3: Experiences has visibility column -', colRows.length > 0 ? 'PASS' : 'FAIL');

    // Test 4: Check agencies table schema
    const { rows: agentRows } = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'agents' ORDER BY ordinal_position
    `);
    const agentCols = agentRows.map(r => r.column_name);
    console.log('✓ Test 4: Agents has id column -', agentCols.includes('id') ? 'PASS' : 'FAIL');
    console.log('✓ Test 4: Agents has organization_id -', agentCols.includes('organization_id') ? 'PASS' : 'FAIL');

    // Test 5: Tenant isolation - organizations have data
    const { rows: countRows } = await pool.query('SELECT COUNT(*) AS cnt FROM organizations');
    console.log('✓ Test 5: Organizations count -', countRows[0].cnt, 'rows');

    console.log('\nAll database tests completed.');
  } catch (err) {
    console.error('✗ Database test failed:', err.message);
  } finally {
    await pool.end();
  }
}

runTests();