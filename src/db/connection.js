import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://neuranet:neuranet_password@localhost:5432/neuranet';

export const pool = new Pool({
  connectionString: databaseUrl
});

// Enable pgvector extension
export const enableVectorExtension = async () => {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('pgvector extension enabled');
  } finally {
    client.release();
  }
};

// Test connection
export const testConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Database connection OK');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
};