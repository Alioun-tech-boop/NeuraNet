import { pool } from '../db/connection.js';
import PathComparator from './comparator.js';

/**
 * PathGraph — shared sub-path discovery across family paths.
 * Nodes = step types; edges = observed transitions with success-weighted observations.
 */
export class PathGraph {
  /** Strongest transitions for a family (top N by success-weighted weight) */
  async strongestEdges(orgId, familyId, limit = 10) {
    const { rows } = await pool.query(
      `SELECT from_step, to_step, weight, success_weight,
              ROUND(success_weight::numeric / NULLIF(weight,0), 2) AS success_ratio
       FROM path_edges WHERE organization_id=$1 AND family_id=$2
       ORDER BY weight DESC LIMIT $3`,
      [orgId, familyId, limit]);
    return rows;
  }

  /** Best shared sub-path: ordered chain of strongest edges starting from entry steps */
  async bestSubPath(orgId, familyId) {
    const edges = await this.strongestEdges(orgId, familyId, 50);
    if (!edges.length) return null;
    const byFrom = new Map();
    for (const e of edges) {
      if (!byFrom.has(e.from_step)) byFrom.set(e.from_step, []);
      byFrom.get(e.from_step).push(e);
    }
    // Greedy walk from an edge whose from_step is never a to_step (entry node)
    const targets = new Set(edges.map(e => e.to_step));
    const entries = edges.filter(e => !targets.has(e.from_step));
    let chain = [];
    const visited = new Set();
    let frontier = entries.length ? entries : [edges[0]];
    // pick best entry then walk greedily
    let current = frontier.sort((a,b) => b.weight - a.weight)[0];
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      chain.push(current);
      const next = (byFrom.get(current.to_step) || [])
        .filter(e => !visited.has(e.id))
        .sort((a,b) => (b.success_weight||0) - (a.success_weight||0))[0];
      current = next;
    }
    return { subPath: chain.map(c => `${c.from_step} -> ${c.to_step}`),
             totalWeight: chain.reduce((a,b)=>a+b.weight,0),
             avgSuccessRatio: (chain.reduce((a,b)=>a+parseFloat(b.success_ratio||0),0)/chain.length).toFixed(2) };
  }

  /** Step-type leaderboard: reliability per step type */
  async stepLeaderboard(orgId) {
    const { rows } = await pool.query(
      `SELECT step_type, observations, successes,
              ROUND(successes::numeric / NULLIF(observations,0), 2) AS success_rate
       FROM step_type_stats WHERE organization_id=$1
       ORDER BY successes DESC NULLS LAST LIMIT 15`,
      [orgId]);
    return rows;
  }
}

export default new PathGraph();
