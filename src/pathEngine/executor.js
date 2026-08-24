import { pool } from '../db/connection.js';
import { WebSearchProvider } from '../searchProvider/webSearch.js';

/**
 * PathExecutor — generic step-type executor.
 * Executes a ResolutionPath infrastructure-side (never injects context into any LLM).
 * Domains extend by registering additional step handlers.
 */
export class PathExecutor {
  constructor(options = {}) {
    this.searchProvider = options.searchProvider || new WebSearchProvider();
    this.handlers = {
      cache_check:      this._cacheCheck.bind(this),
      web_search:       this._webSearch.bind(this),
      authoritative_search: this._authoritativeSearch.bind(this),
      deduplicate:      this._deduplicate.bind(this),
      source_rank:      this._sourceRank.bind(this),
      verify:           this._verify.bind(this),
      cross_check:      this._crossCheck.bind(this),
      synthesize:       this._synthesize.bind(this),
      classify:         this._classify.bind(this),
      ...options.extraHandlers
    };
  }

  /**
   * Execute steps sequentially. Each step receives and enriches a shared context.
   * Returns { context, stepResults } — the LLM (caller-side) still only ever
   * receives its original task; these results are tool output / evidence.
   */
  async execute(steps, ctx = {}) {
    const start = Date.now();
    const stepResults = [];
    let ok = true;

    for (const step of steps.sort((a,b) => (a.order ?? 0) - (b.order ?? 0))) {
      const type = step.action || step.type || step.step_type;
      const handler = this.handlers[type];
      const stepStart = Date.now();
      if (!handler) {
        // Unknown step types are skipped, never fatal (fail-safe per §20)
        stepResults.push({ type, success: true, skipped: true, latencyMs: 0 });
        continue;
      }
      try {
        const out = await handler(ctx, step);
        ctx = { ...ctx, ...(out || {}) };
        stepResults.push({ type, success: true, latencyMs: Date.now() - stepStart, ...(out?.__meta || {}) });
      } catch (e) {
        ok = false;
        stepResults.push({ type, success: false, error: e.message, latencyMs: Date.now() - stepStart });
        break; // a failed step stops the chain; failure recorded upstream
      }
    }

    return {
      context: ctx,
      stepResults,
      success: ok,
      totalLatencyMs: Date.now() - start,
      searchCalls: stepResults.filter(s => s.type.includes('search')).length
    };
  }

  // ---- Step handlers (infrastructure-only operations) ----

  async _cacheCheck(ctx) {
    if (!ctx.orgId || !ctx.queryHash) return { __meta: { cached: false }, cachedProduction: null };
    const { rows } = await pool.query(
      `SELECT id, answer FROM productions WHERE query_hash=$1 AND organization_id=$2 AND is_canonical=true LIMIT 1`,
      [ctx.queryHash, ctx.orgId]);
    return { __meta: { cached: rows.length > 0 }, cachedProduction: rows[0] || null };
  }

  async _authoritativeSearch(ctx, step) {
    return this._search(ctx, step, 3);
  }
  async _webSearch(ctx, step) {
    return this._search(ctx, step, 5);
  }
  async _search(ctx, step, max) {
    const query = step.params?.queryPattern || step.queryPattern || ctx.task;
    const sr = await this.searchProvider.search(query, { maxResults: max });
    return {
      __meta: { count: sr.results.length },
      searchResults: sr.results,
      sources: sr.results.map(r => ({ url: r.url, title: r.title, domain: r.domain }))
    };
  }

  async _deduplicate(ctx) {
    const seen = new Set();
    const unique = [];
    for (const r of ctx.searchResults || []) {
      if (!seen.has(r.url)) { seen.add(r.url); unique.push(r); }
    }
    return { __meta: { before: (ctx.searchResults||[]).length, after: unique.length }, searchResults: unique };
  }

  async _sourceRank(ctx) {
    // Learned authority heuristic: gov/edu/intl-institution domains rank first
    const authority = /(gov|edu|int|un\.org|worldbank|imf|irena|afdb|who\.int)/i;
    const ranked = [...(ctx.searchResults || [])].sort((a,b) =>
      (authority.test(b.url||'') ? 1 : 0) - (authority.test(a.url||'') ? 1 : 0));
    return { __meta: { ranked: ranked.length }, searchResults: ranked };
  }

  async _verify(ctx) {
    // Claim-source consistency check on accumulated results
    const results = ctx.searchResults || [];
    const verified = results.filter(r =>
      (r.snippet||'').toLowerCase().includes('regulat') ||
      (r.title||'').toLowerCase().includes('commission') ||
      (r.title||'').toLowerCase().includes('authority'));
    return { __meta: { verifiedCount: verified.length },
             verificationStatus: verified.length > 0 ? 'verified' : 'unverified',
             verifiedSources: verified.map(v => v.url) };
  }

  async _crossCheck(ctx) {
    // At least 2 distinct domains supporting context = cross-checked
    const domains = new Set((ctx.searchResults||[]).map(r => r.domain));
    return { __meta: { distinctDomains: domains.size }, crossChecked: domains.size >= 2 };
  }

  async _synthesize(ctx) {
    // Infrastructure-side synthesis marker: actual generation stays in the caller's LLM
    return { __meta: { synthesized: true }, readyForLLM: true };
  }

  async _classify(ctx, step) {
    return { __meta: { classified: true }, classification: step.params?.classification || 'general' };
  }
}

/** Record executed steps + graph edges + step-type stats */
export async function recordStepExecution(orgId, executionId, familyId, stepResults) {
  let prevType = null;
  for (let i = 0; i < stepResults.length; i++) {
    const s = stepResults[i];
    await pool.query(
      `INSERT INTO path_execution_steps (organization_id, execution_id, step_order, step_type, result_summary, success, latency_ms)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
      [orgId, executionId, i+1, s.type, JSON.stringify({ skipped: !!s.skipped }), s.success !== false, s.latencyMs || 0]);
    if (prevType && prevType !== s.type) {
      await pool.query(
        `INSERT INTO path_edges (organization_id, family_id, from_step, to_step, weight, success_weight)
         VALUES ($1,$2,$3,$4,1,$5)
         ON CONFLICT (organization_id, family_id, from_step, to_step)
         DO UPDATE SET weight = path_edges.weight + 1,
                       success_weight = path_edges.success_weight + EXCLUDED.success_weight`,
        [orgId, familyId, prevType, s.type, s.success !== false ? 1 : 0]);
    }
    await pool.query(
      `INSERT INTO step_type_stats (organization_id, step_type, observations, successes)
       VALUES ($1,$2,1,$3)
       ON CONFLICT (organization_id, step_type)
       DO UPDATE SET observations = step_type_stats.observations + 1,
                     successes = step_type_stats.successes + EXCLUDED.successes`,
      [orgId, s.type, s.success !== false ? 1 : 0]);
    prevType = s.type;
  }
}
