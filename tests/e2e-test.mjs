import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neuranet:neuranet_password@localhost:5432/neuranet'
});

async function runEndToEndTest() {
  const client = await pool.connect();
  try {
    console.log('=== NeuraNet End-to-End Flow Test ===\n');

    // Step 1: Verify clean state
    const { rows: existingExperiences } = await pool.query('SELECT COUNT(*) AS cnt FROM experiences');
    console.log(`Step 1: Existing experiences: ${existingExperiences[0].cnt}`);

    // Step 2: Create an experience manually
    const { rows: result } = await pool.query(`
      INSERT INTO experiences (organization_id, agent_id, outcome, domain, trust_score, visibility, provenance, freshness_score)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        NULL,
        'Researched Company X financial performance. Found revenue of $10M using official exchange data and company reports.',
        'finance',
        0.85,
        'private',
        '{"source_agent_id": "unknown", "originating_task_id": null, "created_by": "agent", "organization_id": "00000000-0000-0000-0000-000000000001"}',
        1.0
      )
      RETURNING id, trust_score, domain, visibility;
    `);
    const experienceId = result[0].id;
    console.log(`Step 2: Created experience ID: ${experienceId}, trust_score: ${result[0].trust_score}, domain: ${result[0].domain}, visibility: ${result[0].visibility}`);

    // Step 3: Verify experience is private and org-scoped
    const { rows: privateExp } = await pool.query(
      'SELECT id, visibility, organization_id FROM experiences WHERE id = $1',
      [experienceId]
    );
    console.log(`Step 3: Experience visibility: ${privateExp[0].visibility}, org_id: ${privateExp[0].organization_id}`);
    console.log(`  → Private experience should NOT be in collective retrieval by default`);

    // Step 4: Test retrieval with organization isolation
    const { rows: retrievedBySameOrg } = await pool.query(`
      SELECT id, trust_score, domain FROM experiences 
      WHERE organization_id = '00000000-0000-0000-0000-000000000001'
      AND visibility != 'private'
    `);
    console.log(`Step 4: Same org non-private experiences: ${retrievedBySameOrg.length}`);

    // Step 5: Verify provenance is preserved
    const { rows: provenanceCheck } = await pool.query(
      'SELECT provenance FROM experiences WHERE id = $1',
      [experienceId]
    );
    console.log(`Step 5: Provenance preserved:`, provenanceCheck[0].provenance ? 'YES' : 'NO');
    if (provenanceCheck[0].provenance) {
      console.log(`  → Source agent:`, provenanceCheck[0].provenance.source_agent_id);
      console.log(`  → Created by:`, provenanceCheck[0].provenance.created_by);
    }

    // Step 6: Check experience lifecycle fields exist
    const { rows: lifecycle } = await pool.query(`
      SELECT created_at, validated_at, last_used_at, last_verified_at, success_count, failure_count, reuse_count
      FROM experiences WHERE id = $1
    `, [experienceId]);
    console.log(`Step 6: Lifecycle fields exist: created=${lifecycle[0].created_at !== null}, validated=${lifecycle[0].validated_at !== null}`);

    console.log('\n=== All core flow tests completed ===');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    client.release();
  }
}

runEndToEndTest();