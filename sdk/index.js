/* ─────────────────────────────────────────────────────────────────────────────
   @neuranet/sdk — official Node.js client (zero dependencies, Node ≥ 18)

   NeuraNet is procedural experience infrastructure: it learns HOW problems
   are solved and transfers those strategies to future tasks.

   Invariants guaranteed server-side (the SDK only surfaces them):
     • 0 historical tokens injected into your LLM prompts
     • 0 LLM calls for strategy matching
     • provider-neutral — you keep full control of your model

   Quickstart:
     import { NeuraNet } from '@neuranet/sdk';
     const nn = new NeuraNet({ apiKey: process.env.NEURANET_API_KEY });

     // 1) ask the engine to pick a learned path for this task
     const sel = await nn.paths.select({ task: 'Identify the banking regulator of Ghana' });
     if (sel.decision === 'REUSE_PATH') {
       // execute with YOUR model; the selected path guides tool usage only
     }

     // 2) record how it went — this is what makes NeuraNet learn
     await nn.neurannet.observe({ task, familyId: sel.familyId,
                                  metrics: { success: true, quality: 0.91 } });
   ───────────────────────────────────────────────────────────────────────────── */

const DEFAULT_BASE = 'http://localhost:3000';

/** Typed error carrying HTTP status, machine code and request id. */
export class NeuraNetError extends Error {
  /**
   * @param {number} status  HTTP status code (0 = network failure)
   * @param {string} message human-readable message
   * @param {object} [meta]  { code?, requestId?, body? }
   */
  constructor(status, message, meta = {}) {
    super(message);
    this.name = 'NeuraNetError';
    this.status = status;
    this.code = meta.code ?? (status === 401 ? 'UNAUTHORIZED'
      : status === 403 ? 'FORBIDDEN'
        : status === 429 ? 'RATE_LIMITED'
          : status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED');
    this.requestId = meta.requestId;
    this.body = meta.body;
  }
}

export class NeuraNet {
  /**
   * @param {object} opts
   * @param {string} [opts.baseUrl='http://localhost:3000']
   * @param {string} opts.apiKey            X-API-Key value (never logged)
   * @param {number} [opts.timeoutMs=30000]
   * @param {number} [opts.maxRetries=3]    automatic retry on 429 / 5xx / network
   * @param {boolean} [opts.retryOnRateLimit=true]
   */
  constructor({ baseUrl, apiKey, timeoutMs = 30_000, maxRetries = 3, retryOnRateLimit = true } = {}) {
    if (!apiKey) throw new NeuraNetError(0, 'apiKey is required');
    this.baseUrl = (baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.retryOnRateLimit = retryOnRateLimit;

    /* namespaced resources */
    this.demo = {
      /** Run one live pipeline cycle for ANY question. */
      run: (task, extra = {}) => this._post('/v1/demo/run', { task, ...extra }),
      /** List strategies learned so far. */
      strategies: () => this._get('/v1/demo/strategies'),
    };

    this.paths = {
      /** Deterministic path selection (0 LLM calls). */
      select: (body) => this._post('/v1/paths/select', body),
      statistics: (familyId) => this._get(`/v1/paths/statistics${familyId ? `?familyId=${encodeURIComponent(familyId)}` : ''}`),
      frontier: (familyId) => this._get(`/v1/paths/frontier${familyId ? `?familyId=${encodeURIComponent(familyId)}` : ''}`),
      regret: (familyId) => this._get(`/v1/paths/regret${familyId ? `?familyId=${encodeURIComponent(familyId)}` : ''}`),
      history: (familyId) => this._get(`/v1/paths/history${familyId ? `?familyId=${encodeURIComponent(familyId)}` : ''}`),
      evolution: (familyId) => this._get(`/v1/paths/evolution${familyId ? `?familyId=${encodeURIComponent(familyId)}` : ''}`),
      /** Record an execution observation → feeds Pareto elimination. */
      observe: (body) => this._post('/v1/paths/observe', body),
    };

    this.neurannet = {
      select: (body) => this._post('/v1/neurannet/select', body),
      observe: (body) => this._post('/v1/neurannet/observe', body),
      discover: (familyId) => this._post('/v1/neurannet/discover', { familyId }),
      metrics: () => this._get('/v1/neurannet/metrics'),
      governance: () => this._get('/v1/neurannet/governance'),
    };

    this.knowledge = {
      query: (query, extra = {}) => this._post('/v1/query', { query, ...extra }),
    };

    /* admin resource — requires admin scope or X-Admin-Token */
    this.apiKeys = {
      /** Mint a key. The returned `key` plaintext is shown exactly once. */
      create: ({ name, scopes, admin = false } = {}) =>
        this._post('/v1/api-keys', { name: name ?? 'unnamed', scopes, admin }),
      list: () => this._get('/v1/api-keys'),
      revoke: (id, reason) => this._delete(`/v1/api-keys/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`),
    };
  }

  /* ────────────────── high-level convenience ────────────────── */

  /**
   * One-line learning loop helper:
   * select a path (deterministic), let you execute with your own model,
   * then submit the observation.
   *
   * @returns {Promise<{decision:'REUSE_PATH'|'RESEARCH', path?:object,
   *                    report:(metrics:object)=>Promise<object>}>}
   */
  async learn(task, { domain, workflow } = {}) {
    const sel = await this.paths.select({ task, domainOverride: domain });
    const familyId = sel.selectedPath?.family_id ?? sel.familyId ?? null;
    return {
      decision: sel.decision,
      selectionReason: sel.selectionReason,
      path: sel.selectedPath ?? null,
      report: (metrics) => this.neurannet.observe({
        task, familyId, pathId: sel.selectedPath?.id ?? null, metrics, environment: { workflow },
      }),
    };
  }

  health() { return this._get('/health'); }
  info() { return this._get('/'); }

  /* ────────────────── transport ────────────────── */

  async _request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    let lastErr;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          signal: ctrl.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        clearTimeout(timer);

        const requestId = res.headers.get('x-request-id') || undefined;
        const text = await res.text();
        const json = text ? safeJson(text) : null;

        if (res.ok) return json;

        if ((res.status === 429 && this.retryOnRateLimit) || res.status >= 500) {
          lastErr = new NeuraNetError(res.status, json?.error || res.statusText, { requestId, body: json });
          const retryAfter = Number(res.headers.get('retry-after')) * 1000;
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : backoff(attempt));
          continue;
        }
        throw new NeuraNetError(res.status, json?.error || res.statusText,
          { code: json?.code, requestId, body: json });
      } catch (e) {
        clearTimeout(timer);
        if (e instanceof NeuraNetError && e.status < 500 && e.status !== 429) throw e;
        lastErr = e.status ? e : new NeuraNetError(0, `network error: ${e.message}`);
        if (attempt === this.maxRetries) break;
        await sleep(backoff(attempt));
      }
    }
    throw lastErr ?? new NeuraNetError(0, 'request failed');
  }

  _get(path) { return this._request('GET', path); }
  _post(path, body) { return this._request('POST', path, body); }
  _delete(path, body) { return this._request('DELETE', path, body); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt) => Math.min(1000 * 2 ** attempt, 15_000);
const safeJson = (t) => { try { return JSON.parse(t); } catch { return t; } };

export default NeuraNet;
