import 'dotenv/config';
import { spawn } from 'node:child_process';
import { pool } from '../src/db/connection.js';

const api = spawn('node', ['src/api/index.js'], { stdio: ['ignore','pipe','pipe'] });
let out = '';
api.stdout.on('data', d => out += d);
api.stderr.on('data', d => out += '\nSTDERR:' + d);

await new Promise(r => setTimeout(r, 5000));

try {
  const r = await fetch('http://127.0.0.1:3000/v1/neurannet/transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.NEURANET_API_KEY || 'neuranet-dev-key'
    },
    body: JSON.stringify({ task: 'Identify the banking regulator of Ghana' })
  });
  const j = await r.json();
  console.log('STATUS:', r.status);
  console.log('DECISION:', j.decision);
  console.log('STRATEGY APPLIED:', j.strategyApplied);
  console.log('SEARCH QUERY:', j.searchQueryUsed);
  console.log('SOURCES:', j.sources?.length || 0);
  console.log('ANSWER LENGTH:', (j.answer||'').length);
  console.log('CONTEXT ADDED:', j.metrics?.contextAddedTokens ?? 'N/A');
} catch(e) {
  console.error('FETCH ERROR:', e.message.slice(0, 100));
}

console.log('\n=== SERVER LOG (last 500 chars) ===');
console.log(out.slice(-500));

api.kill();
await pool.end();
