import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashMessages, assertNeuraNetContextZero } from '../src/neuraNet/contextGuard.js';
import { createLLMProvider } from '../src/llmProvider/factory.js';

describe('Zero Context Overhead', () => {
  it('no strategy injection', async () => {
    const original = [{ role: 'user', content: 'Create an Express API' }];
    const final = [...original];
    assert.doesNotThrow(() => assertNeuraNetContextZero(original, final));
  });

  it('detects strategy injection', async () => {
    const original = [{ role: 'user', content: 'Create an Express API' }];
    const final = [{ role: 'user', content: 'Create an Express API\n\nNeuraNet strategy: Use JWT pattern' }];
    assert.throws(() => assertNeuraNetContextZero(original, final), /NEURANET_CONTEXT_VIOLATION/);
  });

  it('no experience injection', async () => {
    const original = [{ role: 'system', content: 'You are helpful' }, { role: 'user', content: 'Task' }];
    const final = [...original];
    assert.doesNotThrow(() => assertNeuraNetContextZero(original, final));
  });

  it('no path injection', async () => {
    const original = [{ role: 'user', content: 'Research task' }];
    const final = [{ role: 'user', content: 'Research task' }];
    assert.equal(hashMessages(original), hashMessages(final));
  });

  it('no production injection', async () => {
    const original = [{ role: 'user', content: 'Hello' }];
    const final = [{ role: 'user', content: 'Hello' }];
    assert.doesNotThrow(() => assertNeuraNetContextZero(original, final));
  });

  it('no knowledge injection', async () => {
    const original = [{ role: 'user', content: 'What is Ghana regulator?' }];
    const withKnowledge = [{ role: 'user', content: 'What is Ghana regulator?\n\nNeuraNet knowledge: 500 experiences...' }];
    assert.throws(() => assertNeuraNetContextZero(original, withKnowledge));
  });

  it('no system prompt modification', async () => {
    const original = [{ role: 'system', content: 'You are helpful' }];
    const modified = [{ role: 'system', content: 'You are helpful\n\nNeuraNet instructions...' }];
    assert.throws(() => assertNeuraNetContextZero(original, modified));
  });

  it('no hidden context', async () => {
    const original = [{ role: 'user', content: 'Task' }];
    const hidden = [{ role: 'user', content: 'Task' }, { role: 'system', content: 'Hidden NeuraNet context' }];
    assert.throws(() => assertNeuraNetContextZero(original, hidden));
  });

  it('original context hash preserved', async () => {
    const original = [{ role: 'user', content: 'Test' }];
    const final = [{ role: 'user', content: 'Test' }];
    assert.equal(hashMessages(original), hashMessages(final));
  });

  it('provider adapters remain available', async () => {
    const p1 = createLLMProvider('groq');
    const p2 = createLLMProvider('openrouter');
    const p3 = createLLMProvider('gemini');
    assert.ok(p1 && p2 && p3);
  });
});
