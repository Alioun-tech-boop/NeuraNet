import { pool } from '../db/connection.js';

/**
 * PathDiscoveryEngine — bounded, guided discovery of NEW candidate paths
 * by recombining high-performing steps from the family's Pareto frontier.
 * Deterministic (SQL + rules), zero LLM, bounded exploration (§12).
 */
export class PathDiscoveryEngine {
  constructor(options = {}) {
    this.maxCandidatesPerCycle = options.maxCandidatesPerCycle ?? 2;
    this.maxSteps = options.maxSteps ?? 6;
  }

  async discover(orgId, familyId) {
    const { rows: paths } = await pool.query(
      `SELECT id, steps FROM resolution_paths
       WHERE organization_id=$1 AND family_id=$2 AND status IN ('ACTIVE','CANDIDATE')
       ORDER BY quality_score DESC LIMIT 4`,
      [orgId, familyId]);
    const { rows: edges } = await pool.query(
      `SELECT from_step, to_step, weight, success_weight FROM path_edges
       WHERE family_id=$1 ORDER BY success_weight DESC LIMIT 20`,
      [familyId]);

    if (paths.length < 2) return { candidates: [], reason: 'need >=2 parent paths' };

    // Identify best-performing and weak step types from observations
    const strongTypes = new Set(edges.filter(e => e.success_weight > 0).flatMap(e => [e.from_step, e.to_step]));
    const weakTypes = new Set(edges.filter(e => e.success_weight === 0).map(e => e.to_step));

    // Recombine: strongest path skeleton + one strong step from another path,
    // removing a weak step if present. Bounded to maxCandidatesPerCycle.
    const base = paths[0];
    const donor = paths[1];
    const baseSteps = [...(base.steps||[])];
    const donorStep = (donor.steps||[]).find(s => strongTypes.has(s.action) && !baseSteps.some(b => b.action === s.action));

    const candidates = [];
    if (donorStep) {
      let newSteps = [...baseSteps];
      // remove a weak tail step if present
      const weakIdx = newSteps.findIndex(s => weakTypes.has(s.action));
      if (weakIdx >= 0) newSteps.splice(weakIdx, 1);
      newSteps.push({ order: newSteps.length+1, action: donorStep.action });
      newSteps = newSteps.slice(0, this.maxSteps).map((s,i)=>({ ...s, order:i+1 }));

      const dup = await pool.query(
        `SELECT id FROM resolution_paths WHERE family_id=$1 AND steps::text=$2 LIMIT 1`,
        [familyId, JSON.stringify(newSteps)]);
      if (!dup.rows[0]) {
        const hash = crypto.createHash('sha256').update(JSON.stringify(newSteps)).digest('hex').slice(0,32);
        const { rows } = await pool.query(
          `INSERT INTO resolution_paths
            (organization_id, family_id, version, parent_id, steps, status, provenance)
           SELECT $1,$2,COALESCE(MAX(rp.version),0)+1,$3,$4::jsonb,'CANDIDATE',$5::jsonb
           FROM resolution_paths rp WHERE rp.family_id=$2
           RETURNING *`,
          [orgId, familyId, base.id, JSON.stringify(newSteps),
           JSON.stringify({ createdBy:'discovery-engine',
             reason:'recombination of high-performing steps',
             parents:[base.id, donor.id], edgesUsed: edges.slice(0,3).map(e=>`${e.from_step}->${e.to_step}`) })]
        );
        candidates.push(rows[0]);
      }
    }

    return { candidates, boundedBy: 'maxCandidatesPerCycle', discoveredAt: new Date().toISOString() };
  }
}

import crypto from 'node:crypto';
export default new PathDiscoveryEngine();
