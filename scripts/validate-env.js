#!/usr/bin/env node
import 'dotenv/config';

const checks = [
  ['Gemini API', process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY],
  ['Groq API', process.env.GROQ_API_KEY],
  ['OpenRouter API', process.env.OPENROUTER_API_KEY],
  ['Tavily API', process.env.TAVILY_API_KEY],
  ['Supabase', process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY ? 'ok' : ''],
  ['Database', process.env.DATABASE_URL]
];

for (const [name, val] of checks) {
  console.log(`${name}: ${val ? 'CONFIGURED' : 'MISSING_API_KEY'}`);
}
