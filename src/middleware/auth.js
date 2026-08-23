import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://neuranet:neuranet_password@localhost:5432/neuranet';
const isLocalHost = /@localhost|@127\.0\.0\.1|@::1/.test(databaseUrl);

const pool = new Pool({
  connectionString: databaseUrl,
  ...(isLocalHost ? {} : { ssl: { rejectUnauthorized: false } })
});

// In-memory cache for API key lookups (populated on startup)
let apiKeyCache = new Map();

/**
 * Load API keys from database into cache on startup
 */
export const loadApiKeys = async () => {
  try {
    const { rows } = await pool.query(
      'SELECT id, organization_id, hash, scopes FROM api_keys WHERE revoked_at IS NULL'
    );
    rows.forEach(key => {
      let scopes = key.scopes;
      // pg returns JSONB as object/array; ensure array
      if (typeof scopes === 'string') {
        try { scopes = JSON.parse(scopes); } catch { scopes = []; }
      }
      if (!Array.isArray(scopes)) scopes = [];
      apiKeyCache.set(key.id, {
        organization_id: key.organization_id,
        hash: key.hash,
        scopes
      });
    });
    console.log(`Loaded ${apiKeyCache.size} active API keys into cache`);
  } catch (err) {
    console.error('Failed to load API keys:', err);
  }
};

/**
 * Verify API key from X-API-Key header
 * Server-to-server authentication per PRD.md §28 and ARCHITECTURE-ESSENTIALS §38-39
 * - API keys never stored in plaintext
 * - Hashed using bcrypt
 * - Support rotation, revocation, scopes
 * - Audit metadata tracked
 */
export const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        error: 'Missing API key',
        request_id: req.request_id
      });
    }

    // Check in-memory cache first (fast path)
    const cachedKey = Array.from(apiKeyCache.values()).find(
      entry => bcrypt.compareSync(apiKey, entry.hash)
    );

    if (cachedKey) {
      req.organization_id = cachedKey.organization_id;
      req.scopes = cachedKey.scopes || [];
      req.agent_id = null;
      return next();
    }

    // Fallback: scan all keys in cache
    for (const [keyId, entry] of apiKeyCache) {
      const isValid = await bcrypt.compare(apiKey, entry.hash);
      if (isValid) {
        req.organization_id = entry.organization_id;
        req.scopes = entry.scopes || [];
        req.agent_id = null;
        return next();
      }
    }

    return res.status(401).json({
      error: 'Invalid API key',
      request_id: req.request_id
    });

  } catch (err) {
    console.error(`[${req.request_id}] Auth error:`, err);
    return res.status(500).json({
      error: 'Authentication failed',
      request_id: req.request_id
    });
  }
};

/**
 * Middleware to check API key scopes
 * Per ARCHITECTURE-ESSENTIALS §39: API keys have scopes for granular access control
 * @param {...string} requiredScopes - e.g., "tasks:read", "experiences:write"
 * @returns {import('express').Middleware}
 */
export const checkScopes = (...requiredScopes) => {
  return (req, res, next) => {
    if (!req.scopes) {
      return res.status(403).json({
        error: 'Missing scopes',
        request_id: req.request_id
      });
    }

    const missing = requiredScopes.filter(s => !req.scopes.includes(s));
    if (missing.length > 0) {
      return res.status(403).json({
        error: `Missing required scopes: ${missing.join(', ')}`,
        request_id: req.request_id
      });
    }

    next();
  };
};

/**
 * Initialize API keys cache on module import
 */
loadApiKeys().catch(err => console.error('API key initialization error:', err));