import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db/connection.js';
import { authenticateApiKey, loadApiKeys } from '../middleware/auth.js';

/**
 * API key lifecycle management — AGENTS.md §27:
 * never stored plaintext (bcrypt), scoped, revocable, auditable,
 * full secret returned exactly once at creation.
 *
 * Authorization: caller key must carry the `admin` scope, OR the request
 * must present X-Admin-Token matching NEURANET_ADMIN_TOKEN (bootstrap).
 */

const router = Router();

const KEY_PREFIX = 'nn_live_';
const DEFAULT_SCOPES = [
  'tasks:create', 'tasks:read',
  'experiences:create', 'experiences:read',
  'agents:create', 'agents:read',
  'strategies:read', 'strategies:create', 'strategies:write',
];

function authorized(req) {
  if (req.scopes?.includes('admin')) return true;
  const token = req.headers['x-admin-token'];
  return !!process.env.NEURANET_ADMIN_TOKEN && token === process.env.NEURANET_ADMIN_TOKEN;
}

async function audit(orgId, action, entityType, entityId, details, req) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, performed_by, details, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [orgId, action, entityType, entityId, req.get('x-api-key') ? 'api-key' : 'admin-token',
       JSON.stringify(details ?? {}), req.ip, req.get('user-agent')]);
  } catch (e) {
    console.error('[api-keys] audit write failed:', e.message);
  }
}

/* ── POST /v1/api-keys — mint a key (secret shown once) ── */
router.post('/', authenticateApiKey, async (req, res) => {
  if (!authorized(req)) {
    return res.status(403).json({ error: 'Forbidden: admin scope or X-Admin-Token required', request_id: req.request_id });
  }
  const name = String(req.body?.name || '').trim().slice(0, 64);
  if (!name) return res.status(400).json({ error: 'name required', request_id: req.request_id });

  const scopes = Array.isArray(req.body?.scopes) && req.body.scopes.length
    ? [...new Set(req.body.scopes)]
    : (req.body?.admin ? [...DEFAULT_SCOPES, 'admin'] : DEFAULT_SCOPES);

  const secret = KEY_PREFIX + crypto.randomBytes(24).toString('base64url'); // ~43 chars
  const keyPrefix = secret.slice(0, 12);
  const hash = bcrypt.hashSync(secret, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO api_keys (organization_id, name, hash, scopes, key_prefix)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, scopes, key_prefix, created_at`,
      [req.organization_id, name, hash, JSON.stringify(scopes), keyPrefix]);
    await loadApiKeys(); // refresh auth cache immediately
    await audit(req.organization_id, 'api_key.created', 'api_key', rows[0].id, { name, scopes }, req);
    res.status(201).json({
      id: rows[0].id,
      name: rows[0].name,
      scopes: rows[0].scopes,
      key: secret,                    // ← shown exactly once
      keyPreview: `${keyPrefix}…${secret.slice(-4)}`,
      createdAt: rows[0].created_at,
      request_id: req.request_id,
    });
  } catch (e) {
    console.error('[api-keys/create]', e.message);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

/* ── GET /v1/api-keys — list (masked; secrets impossible to recover) ── */
router.get('/', authenticateApiKey, async (req, res) => {
  if (!authorized(req)) {
    return res.status(403).json({ error: 'Forbidden: admin scope or X-Admin-Token required', request_id: req.request_id });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, name, scopes, key_prefix, created_at, revoked_at, revocation_reason
       FROM api_keys WHERE organization_id=$1 ORDER BY created_at DESC`,
      [req.organization_id]);
    res.json({
      keys: rows.map((r) => ({
        id: r.id,
        name: r.name,
        scopes: typeof r.scopes === 'string' ? JSON.parse(r.scopes) : r.scopes,
        preview: r.key_prefix ? `${r.key_prefix}…` : '(legacy)',
        active: !r.revoked_at,
        revokedAt: r.revoked_at,
        revocationReason: r.revocation_reason,
        createdAt: r.created_at,
      })),
      request_id: req.request_id,
    });
  } catch (e) {
    console.error('[api-keys/list]', e.message);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

/* ── DELETE /v1/api-keys/:id — revoke ── */
router.delete('/:id', authenticateApiKey, async (req, res) => {
  if (!authorized(req)) {
    return res.status(403).json({ error: 'Forbidden: admin scope or X-Admin-Token required', request_id: req.request_id });
  }
  const reason = String(req.body?.reason || req.query.reason || 'revoked by owner').slice(0, 200);
  try {
    const { rows } = await pool.query(
      `UPDATE api_keys SET revoked_at=now(), revocation_reason=$2
       WHERE id=$1 AND organization_id=$3 AND revoked_at IS NULL
       RETURNING id, name`,
      [req.params.id, reason, req.organization_id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Key not found or already revoked', request_id: req.request_id });
    }
    await loadApiKeys();
    await audit(req.organization_id, 'api_key.revoked', 'api_key', rows[0].id, { name: rows[0].name, reason }, req);
    res.json({ ok: true, id: rows[0].id, name: rows[0].name, request_id: req.request_id });
  } catch (e) {
    console.error('[api-keys/revoke]', e.message);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

export const apiKeysRouter = router;
