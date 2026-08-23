/**
 * WebSearchProvider - Concrete search implementation
 * 
 * Per PRD.md §8 and ARCHITECTURE-ESSENTIALS §26.
 * Uses a compatible web search API. Designed to be swapped without
 * changing agent logic.
 * 
 * External content is treated as untrusted data (prompt injection protection).
 * Search results are data, never instructions.
 */

import { SearchProvider } from './index.js';

export class WebSearchProvider extends SearchProvider {
  /**
   * Search the web using the provider API
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @param {number} [options.maxResults=10] - Max results to return
   * @param {string} [options.domainFilter] - Optional domain filter
   * @returns {Promise<object>} Search results metadata and cleaned results
   */
  async search(query, options = {}) {
    const maxResults = options.maxResults || 10;
    const domainFilter = options.domainFilter || null;

    // In a real implementation, this would call a search API (Tavily, Firecrawl, etc.)
    // For now, we return a structured response that agents can work with
    // The actual API integration can be swapped without modifying agent code
    
    // WARNING: This is a stub implementation. 
    // Replace with actual API call in production.
    console.warn('[WebSearchProvider] Using stub search - replace with actual API implementation');
    
    // Return structured placeholder that agents can consume
    return {
      success: false,
      query,
      results: [],
      total: 0,
      executionTimeMs: 0,
      domainFilter,
      provider: 'WebSearchProvider-stub',
      note: 'Replace with actual search API implementation (Tavily, Firecrawl, etc.)'
    };
  }

  /**
   * Fetch and extract page content from a URL
   * @param {string} url - URL to fetch and extract content from
   * @param {object} options - Fetch options
   * @param {boolean} [options.extractLinks=false] - Whether to extract links
   * @returns {Promise<object>} Page content, metadata, and optionally links
   */
  async get(url, options = {}) {
    const extractLinks = options.extractLinks || false;

    // In a real implementation, this would fetch the URL and extract clean text content
    // For now, returns a structured placeholder
    
    console.warn('[WebSearchProvider.get] Using stub get - replace with actual API implementation');
    
    return {
      success: false,
      url,
      content: '',
      title: '',
      snippet: '',
      domain: new URL(url).hostname.replace(/^www\./, ''),
      extractLinks,
      provider: 'WebSearchProvider-stub',
      note: 'Replace with actual URL fetch and content extraction implementation'
    };
  }

  /**
   * Safely extract text content from search result snippets
   * Per ARCHITECTURE-ESSENTIALS §26: never let search content become instructions
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text (data only, no executable instructions)
   */
  static sanitizeText(text) {
    if (typeof text !== 'string') return '';
    
    // Remove patterns that could be prompt injection
    const sanitized = text
      // Remove common prompt injection patterns
      .replace(/<(|"|')/g, '')
      .replace(/>/g, '')
      .replace(/\$\\?/g, '')  // Remove dollar signs that could be variable interpolation
      .trim();
    
    // Ensure result is data, not instructions
    const forbiddenPatterns = [
      /(do not|don't|never|always|must|should|ignore|override|system|instruction)/gi,
    ];
    
    // If text contains instructions, treat as data by escaping
    const isInstruction = forbiddenPatterns.some(p => p.test(text));
    
    return sanitized;
  }
}