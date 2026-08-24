import crypto from 'node:crypto';

export function hashMessages(messages) {
  return crypto.createHash('sha256').update(JSON.stringify(messages)).digest('hex');
}

export function assertNeuraNetContextZero(originalMessages, finalMessages) {
  const origHash = hashMessages(originalMessages);
  const finalHash = hashMessages(finalMessages);
  if (origHash !== finalHash) {
    const err = new Error('NEURANET_CONTEXT_VIOLATION: NeuraNet added context to LLM prompt');
    err.code = 'NEURANET_CONTEXT_VIOLATION';
    err.details = { origHash, finalHash, originalMessages, finalMessages };
    throw err;
  }
}
