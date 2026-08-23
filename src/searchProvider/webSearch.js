/**
 * WebSearchProvider - Concrete search implementation
 * 
 * Per PRD.md §8 and ARCHITECTURE-ESSENTIALS §26.
 * Tries Tavily (if TAVILY_API_KEY set), otherwise falls back to
 * Wikipedia + DuckDuckGo (no key required). Swappable without agent changes.
 * 
 * External content is treated as untrusted data (prompt injection protection).
 */

import { SearchProvider } from './index.js';

export class WebSearchProvider extends SearchProvider {
  constructor(options = {}) {
    super();
    this.timeoutMs = options.timeoutMs || 8000;
    this.tavilyKey = process.env.TAVILY_API_KEY || null;
    this.tavilyUrl = 'https://api.tavily.com/search';
  }

  async search(query, options = {}) {
    const maxResults = Math.min(options.maxResults || 10, 10);
    const domainFilter = options.domainFilter || null;
    const start = Date.now();

    if (!query || !String(query).trim()) {
      return { success: false, query, results: [], total: 0, executionTimeMs: 0, provider: 'WebSearchProvider', error: 'Empty query' };
    }

    // 1) Try Tavily if configured
    if (this.tavilyKey) {
      try {
        const tavilyResults = await this._searchTavily(query, maxResults, domainFilter);
        if (tavilyResults.length > 0) {
          return {
            success: true,
            query,
            results: tavilyResults.slice(0, maxResults),
            total: tavilyResults.length,
            executionTimeMs: Date.now() - start,
            provider: 'tavily'
          };
        }
      } catch (e) {
        console.warn('[WebSearchProvider] Tavily failed, falling back:', e.message);
      }
    }

    // 2) Fallback: Wikipedia + DuckDuckGo in parallel
    try {
      const [wiki, ddg] = await Promise.allSettled([
        this._searchWikipedia(query, maxResults),
        this._searchDuckDuckGo(query, maxResults)
      ]);

      const merged = [];
      if (wiki.status === 'fulfilled' && Array.isArray(wiki.value)) merged.push(...wiki.value);
      if (ddg.status === 'fulfilled' && Array.isArray(ddg.value)) merged.push(...ddg.value);

      // Deduplicate by URL
      const seen = new Set();
      const deduped = [];
      for (const r of merged) {
        if (!r.url || seen.has(r.url)) continue;
        seen.add(r.url);
        // Apply domain filter if requested
        if (domainFilter && !r.domain.includes(domainFilter.replace(/^https?:\/\//, '').replace(/^www\./, ''))) continue;
        deduped.push(r);
      }

      // If still empty, return a synthetic result so agents have something to ground on
      // (prevents agents crashing on zero results, still marked as fallback)
      if (deduped.length === 0) {
        return {
          success: true,
          query,
          results: [{
            url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
            title: `Search: ${query}`,
            snippet: `No direct search hits for "${query}". Try refining the query or checking Wikipedia directly.`,
            domain: 'wikipedia.org'
          }],
          total: 1,
          executionTimeMs: Date.now() - start,
          provider: 'fallback-empty'
        };
      }

      return {
        success: true,
        query,
        results: SearchProvider.cleanResults(deduped).slice(0, maxResults),
        total: deduped.length,
        executionTimeMs: Date.now() - start,
        provider: this.tavilyKey ? 'wikipedia+duckduckgo' : 'wikipedia+duckduckgo'
      };
    } catch (e) {
      console.error('[WebSearchProvider] Fallback search failed:', e.message);
      return {
        success: false,
        query,
        results: [],
        total: 0,
        executionTimeMs: Date.now() - start,
        provider: 'error',
        error: e.message
      };
    }
  }

  async _searchTavily(query, maxResults, domainFilter) {
    const body = {
      api_key: this.tavilyKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: false
    };
    if (domainFilter) body.include_domains = [domainFilter];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.tavilyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
      const data = await res.json();
      return (data.results || []).map(r => ({
        url: r.url || '',
        title: r.title || '',
        snippet: r.content || r.snippet || '',
        domain: r.url ? new URL(r.url).hostname.replace(/^www\./, '') : ''
      }));
    } finally {
      clearTimeout(timeout);
    }
  }

  async _searchWikipedia(query, maxResults) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${maxResults}&origin=*`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'NeuraNet/0.1 (research)' } });
      if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
      const data = await res.json();
      const hits = data.query?.search || [];
      return hits.map(h => ({
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`,
        title: h.title,
        snippet: (h.snippet || '').replace(/<[^>]*>/g, ''),
        domain: 'wikipedia.org'
      }));
    } finally {
      clearTimeout(timeout);
    }
  }

  async _searchDuckDuckGo(query, maxResults) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&pretty=1&no_html=1&skip_disambig=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'NeuraNet/0.1' } });
      if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);
      const data = await res.json();
      const results = [];

      // AbstractText as one result if present
      if (data.AbstractText && data.AbstractURL) {
        results.push({
          url: data.AbstractURL,
          title: data.Heading || query,
          snippet: data.AbstractText,
          domain: (() => { try { return new URL(data.AbstractURL).hostname.replace(/^www\./, ''); } catch { return 'duckduckgo.com'; } })()
        });
      }
      // RelatedTopics
      const topics = data.RelatedTopics || [];
      for (const t of topics) {
        if (results.length >= maxResults) break;
        // RelatedTopics can be nested groups
        const items = t.Topics ? t.Topics : [t];
        for (const item of items) {
          if (results.length >= maxResults) break;
          if (item.Result && item.FirstURL) {
            const snippet = (item.Text || '').slice(0, 300);
            results.push({
              url: item.FirstURL,
              title: (item.Text || '').split(' - ')[0].slice(0, 120) || query,
              snippet,
              domain: (() => { try { return new URL(item.FirstURL).hostname.replace(/^www\./, ''); } catch { return 'duckduckgo.com'; } })()
            });
          }
        }
      }
      return results;
    } finally {
      clearTimeout(timeout);
    }
  }

  async get(url, options = {}) {
    const extractLinks = options.extractLinks || false;
    if (!url) return { success: false, url: '', content: '', error: 'Empty URL' };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'NeuraNet/0.1 (research)', 'Accept': 'text/html,application/xhtml+xml' },
        redirect: 'follow'
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get('content-type') || '';
      let text = '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        text = JSON.stringify(json).slice(0, 8000);
      } else {
        const html = await res.text();
        // Very light HTML to text: strip tags, take first 8000 chars
        text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                   .replace(/<style[\s\S]*?<\/style>/gi, '')
                   .replace(/<[^>]+>/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim()
                   .slice(0, 8000);
      }

      const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();

      return {
        success: true,
        url,
        content: WebSearchProvider.sanitizeText(text),
        title: '',
        snippet: text.slice(0, 400),
        domain,
        extractLinks,
        provider: 'fetch'
      };
    } catch (e) {
      console.warn(`[WebSearchProvider.get] Failed ${url}:`, e.message);
      return {
        success: false,
        url,
        content: '',
        title: '',
        snippet: '',
        domain: (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
        extractLinks,
        provider: 'fetch',
        error: e.message
      };
    }
  }

  static sanitizeText(text) {
    if (typeof text !== 'string') return '';
    const sanitized = text.replace(/<(|"|')/g, '').replace(/>/g, '').replace(/\$\\?/g, '').trim();
    return sanitized;
  }
}
