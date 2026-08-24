import { pool } from '../db/connection.js';

export class ResearchPathRepository {
  taskFamilyFromQuery(query, domain) {
    const norm = (query || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
    const key = norm.split(/\s+/).slice(0, 4).join('_').toUpperCase().slice(0, 50);
    return `${domain || 'GENERAL'}_${key}`;
  }

  async getCanonicalPath(orgId, taskFamily) {
    const start = Date.now();
    const { rows } = await pool.query(
      `SELECT * FROM research_paths WHERE organization_id = $1 AND task_family = $2 AND is_canonical = true LIMIT 1`,
      [orgId, taskFamily]
    );
    return { path: rows[0] || null, latencyMs: Date.now() - start };
  }

  async getBestPath(orgId, domain) {
    const { rows } = await pool.query(
      `SELECT * FROM research_paths WHERE organization_id = $1 AND domain = $2 ORDER BY quality_score DESC, success_rate DESC LIMIT 1`,
      [orgId, domain]
    );
    return rows[0] || null;
  }

  async saveCandidatePath({ orgId, taskFamily, domain, steps, parentId, provenance, metrics }) {
    const { rows: existing } = await pool.query(
      `SELECT MAX(version) as maxv FROM research_paths WHERE organization_id = $1 AND task_family = $2`,
      [orgId, taskFamily]
    );
    const nextVersion = (existing[0]?.maxv || 0) + 1;
    const { rows } = await pool.query(
      `INSERT INTO research_paths (organization_id, task_family, domain, version, parent_id, steps, quality_score, verification_status, latency_ms, search_count, token_usage, success_rate, provenance)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb) RETURNING *`,
      [orgId, taskFamily, domain, nextVersion, parentId || null, JSON.stringify(steps), metrics?.quality || 0.5, metrics?.verification || 'unverified', metrics?.latency || 0, metrics?.searchCount || 0, JSON.stringify(metrics?.tokens || {}), metrics?.successRate || 0, JSON.stringify(provenance || {})]
    );
    const path = rows[0];
    await pool.query(`INSERT INTO research_path_versions (path_id, version, steps, provenance) VALUES ($1,$2,$3::jsonb,$4::jsonb)`, [path.id, nextVersion, JSON.stringify(steps), JSON.stringify(provenance || {})]);
    return path;
  }

  async promoteCanonicalPath(orgId, taskFamily, pathId) {
    await pool.query(`UPDATE research_paths SET is_canonical = false WHERE organization_id = $1 AND task_family = $2 AND is_canonical = true`, [orgId, taskFamily]);
    await pool.query(`UPDATE research_paths SET is_canonical = true, updated_at = NOW() WHERE id = $1`, [pathId]);
    const { rows } = await pool.query(`SELECT * FROM research_paths WHERE id = $1`, [pathId]);
    return rows[0];
  }

  async comparePaths(pathA, pathB) {
    if (!pathA) return 'BETTER';
    if (!pathB) return 'WORSE';
    const score = (p) => (parseFloat(p.quality_score)||0)*0.4 + (p.verification_status==='verified'?0.2:0) + (1 - Math.min((p.latency_ms||5000)/10000,1))*0.1 + (1 - Math.min((p.search_count||5)/10,1))*0.1;
    const aScore = score(pathA), bScore = score(pathB);
    if (bScore > aScore + 0.05) return 'BETTER';
    if (Math.abs(bScore - aScore) < 0.05) return 'EQUIVALENT';
    if (bScore < aScore - 0.05) return 'WORSE';
    return 'EQUIVALENT';
  }
}

export default new ResearchPathRepository();
