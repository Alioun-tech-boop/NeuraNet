/**
 * Retry helper with exponential backoff + jitter
 * Per §21: retry for 429,500,502,503,504,timeout; not for 401,403, invalid key, insufficient_quota
 */

export async function fetchWithRetry(url, options, { maxRetries = 3, timeoutMs = 30000 } = {}) {
  let lastError = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        return { res, retryCount, latencyMs: Date.now() - start };
      }

      const errText = await res.text().catch(() => '');
      let errJson = {};
      try { errJson = JSON.parse(errText); } catch {}
      const msg = errJson.error?.message || errText;

      // Do not retry for auth errors, invalid key, insufficient quota
      const isAuthError = res.status === 401 || res.status === 403;
      const isInvalidKey = /invalid.*key|invalid_api_key/i.test(msg);
      const isInsufficientQuota = /insufficient_quota|credit balance too low|billing/i.test(msg) && !/Rate limit/i.test(msg);

      if (isAuthError || isInvalidKey || isInsufficientQuota) {
        return { res, retryCount, latencyMs: Date.now() - start, errText, errJson, shouldNotRetry: true };
      }

      // Retry for 429 (rate limit), 503, 500, 502, 504
      const isRetryable = [429, 500, 502, 503, 504].includes(res.status);
      if (!isRetryable || attempt === maxRetries) {
        return { res, retryCount, latencyMs: Date.now() - start, errText, errJson };
      }

      retryCount++;
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500; // 1s, 2s, 4s + jitter
      await new Promise(r => setTimeout(r, delay));
      lastError = msg;
      continue;

    } catch (err) {
      clearTimeout(timeout);
      const isAbort = err.name === 'AbortError';
      if (isAbort) {
        if (attempt === maxRetries) {
          throw { error: 'timeout', errorType: 'TIMEOUT', statusCode: 0, retryCount, latencyMs: Date.now() - start };
        }
        retryCount++;
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
        lastError = 'timeout';
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
