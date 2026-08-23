/**
 * SearchProvider Abstraction
 * 
 * Per PRD.md §8 and ARCHITECTURE-ESSENTIALS §26.
 * 
 * Abstract interface for web search providers. Agents use this interface
 * to perform web research. The concrete implementation can be swapped
 * without changing agent logic.
 * 
 * Architecture per PRD §8:
 *   Agent
 *     ↓
 *   SearchProvider
 *     ↓
 *   Search implementation (concrete)
 * 
 * Key design decisions:
 * - Provider must be interchangeable (swap Tavily/Firecrawl/etc without agent changes)
 - External content treated as untrusted data (prompt injection protection)
 - Never couple NeuraNet domain directly to specific provider
 - Search results are data, not instructions
 */

export class SearchProvider {
  /**
   * Search the web for a query
   * @param {string} query - Search query
   * @param {object} options - Additional options
   * @param {number} options.maxResults - Maximum results to return (default 10)
   * @param {string} options.domainFilter - Optional domain filter
   * @returns {Promise<object>} Search results with metadata
   */
  async search(query, options = {}) {
    throw new Error('Not implemented: SearchProvider.search()');
  }

  /**
   * Fetch and extract content from a URL
   * @param {string} url - URL to fetch
   * @param {object} options - Additional options
   * @param {boolean} options.extractLinks - Whether to extract links (default false)
   * @returns {Promise<object>} Page content and metadata
   */
  async get(url, options = {}) {
    throw new Error('Not implemented: SearchProvider.get()');
  }

  /**
   * Clean/normalize search results for agent consumption
   * @param {Array} results - Raw search results
   * @returns {Array} Cleaned results safe for agent processing
   */
  static cleanResults(results) {
    if (!Array.isArray(results)) return [];
    
    return results.map(result => {
      const clean = {
        url: result.url || '',
        title: result.title || '',
        snippet: result.snippet || '',
        domain: result.domain || '',
      };
      
      // Only include if we have meaningful content
      if (clean.title || clean.snippet) {
        return clean;
      }
      return null;
    }).filter(r => r !== null);
  }
}