import 'dotenv/config';
import { pipeline, env } from '@xenova/transformers';

// Force local-only after first download
env.allowRemoteModels = true;
env.allowLocalModels = true;

console.log('Loading multilingual-e5-small...');
const start = Date.now();
const extractor = await pipeline('feature-extraction', 'intfloat/multilingual-e5-small', {
  quantized: true // smaller model file
});
console.log(`Model loaded in ${Date.now()-start}ms`);

async function embed(text, type = 'query') {
  const prefixed = `${type}: ${text}`;
  const output = await extractor(prefixed, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// Test
const A_fr = await embed("Identifier le régulateur bancaire du Ghana", "query");
const B_fr = await embed("Déterminer quelle institution supervise les banques ghanéennes", "passage");
const C_unrelated = await embed("Calculer la température moyenne d'une ville", "query");

function cosine(a,b){let d=0;for(let i=0;i<a.length;i++)d+=a[i]*b[i];return d;}

console.log(`dim=${A_fr.length}`);
console.log(`sim(A,B) related=${cosine(A_fr,B_fr).toFixed(4)}`);
console.log(`sim(A,C) unrelated=${cosine(A_fr,C_unrelated).toFixed(4)}`);
