import registry from './registry.js';
import { pool } from '../db/connection.js';
import { signaturesCompatible } from './signature.js';

/**
 * Decision Engine per refound architecture §11:
 *   REUSE_PATH    - trusted compatible canonical path exists
 *   REFRESH       - path known but its last production is stale
 *   RESEARCH      - no sufficiently reliable path
 *   REJECT_REUSE  - apparent similarity but hard semantic conflict
 */
export async function decide({ orgId, task, signature }) {
  const family = await registry.getOrCreateFamily(orgId, signature);
  const canonical = await registry.getCanonicalPath(family.id);

  if (!canonical) {
    return { decision: 'RESEARCH', family, canonical: null,
      reason: 'no path for this problem family' };
  }

  // Hard semantic gate (family key already encodes dimensions; double-check drift)
  const compat = signaturesCompatible(signature, canonical.provenance?.signatureExample || signature);
  if (!compat.compatible) {
    return { decision: 'REJECT_REUSE', family, canonical,
      reason: `semantic conflict: ${compat.conflicts.join('; ')}` };
  }

  // Freshness applies to the LAST PRODUCTION of the path's executions, not the path itself.
  const { rows } = await pool.query(
    `SELECT pe.production_id, p.freshness_score
     FROM path_executions pe
     LEFT JOIN productions p ON p.id = pe.production_id
     WHERE pe.path_id = $1 AND pe.production_id IS NOT NULL
     ORDER BY pe.created_at DESC LIMIT 1`,
    [canonical.id]
  );
  const lastProd = rows[0];

  const quality = parseFloat(canonical.quality_score) || 0;
  const successRate = parseFloat(canonical.success_rate) || 0;

  if (!lastProd) {
    return { decision: 'REUSE_PATH', family, canonical,
      reason: 'canonical path exists, no production bound yet' };
  }

  const freshness = lastProd.freshness_score != null
    ? parseFloat(lastProd.freshness_score)
    : legacyFreshness(canonical);

  if (quality >= 0.7 && freshness >= 0.5 && successRate >= 0.3) {
    return { decision: 'REUSE_PATH', family, canonical,
      reason: `quality ${quality}, freshness ${freshness}, successRate ${successRate}` };
  }
  if (freshness < 0.4) {
    return { decision: 'REFRESH', family, canonical,
      reason: `stale production (freshness ${freshness})` };
  }
  return { decision: 'RESEARCH', family, canonical,
    reason: `quality ${quality} below threshold` };

  function legacyFreshness(p) {
    return 1; // path-level fallback; production freshness governs REFRESH
  }
}
