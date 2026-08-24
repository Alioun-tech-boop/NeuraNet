import { pool } from '../db/connection.js';
import PathComparator from './comparator.js';

/**
 * PathEliminator — eliminates only paths PROVEN dominated.
 * Every elimination records evidence; nothing is deleted destructively.
 */
export class PathEliminator {
  /**
   * Re-evaluate the whole family: mark DOMINATED/ELIMINATED where justified,
   * keep Pareto frontier ACTIVE, set best-known flag on weighted best.
   */
  async convergeFamily(orgId, familyId, { exploreCandidateId = null } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM resolution_paths
       WHERE organization_id=$1 AND family_id=$2 AND status IN ('ACTIVE','CANDIDATE','DOMINATED')
       ORDER BY version ASC`,
      [orgId, familyId]
    );
    const comparator = PathComparator;

    // Pareto over ALL live paths. Domination requires evidence only on the
    // DOMINATING side (minExecutions); a freshly observed candidate can be
    // dominated by a well-observed path, and can itself dominate once it has
    // enough observations.
    const { frontier, dominated } = comparator.frontier(rows);

    // Apply states
    for (const p of rows) {
      const inFrontier = frontier.find(f => f.id === p.id);
      const isDom = dominated.find(f => f.id === p.id);
      if (inFrontier && p.status !== 'ACTIVE' && p.status !== 'CANONICAL') {
        await pool.query(`UPDATE resolution_paths SET status='ACTIVE', pareto_active=true WHERE id=$1`, [p.id]);
      }
      if (isDom) {
        let dominator = null;
        for (const f of frontier) if (comparator.dominates(f, p)) { dominator = f; break; }
        if (p.status !== 'ELIMINATED') {
          await pool.query(
            `UPDATE resolution_paths SET status='DOMINATED', pareto_active=false WHERE id=$1`, [p.id]);
          await pool.query(
            `INSERT INTO path_eliminations (organization_id, eliminated_path_id, dominated_by, family_id, reason, dimension_snapshot)
             SELECT $1,$2,$3,$4,$5,$6::jsonb
             WHERE NOT EXISTS (SELECT 1 FROM path_eliminations WHERE eliminated_path_id=$2 AND dominated_by=$3)`,
            [orgId, p.id, dominator?.id ?? null, familyId,
             'Pareto-dominated: another path >= on all dimensions and > on at least one',
             JSON.stringify(comparator.dimensions(p))]
          );
        }
      }
    }

    // Exploration candidate handling
    let explorationOutcome = null;
    if (exploreCandidateId) {
      const cand = rows.find(r => r.id === exploreCandidateId);
      const bestOld = comparator.bestKnown(frontier.filter(f => f.id !== exploreCandidateId));
      if (cand && bestOld) {
        const cmp = comparator.compare(bestOld, cand);
        explorationOutcome = cmp === 'WORSE' ? 'PROMOTED' : cmp === 'BETTER' ? 'DOMINATED' : 'KEPT_AS_PARETO';
        if (cmp === 'WORSE') {
          // New discovery dominates old best -> promote it to ACTIVE best
          await pool.query(`UPDATE resolution_paths SET status='ACTIVE', pareto_active=true WHERE id=$1`, [cand.id]);
        }
        await pool.query(`INSERT INTO family_exploration (family_id, explored_candidate_id, outcome) VALUES ($1,$2,$3)`,
          [familyId, exploreCandidateId, explorationOutcome]);
      }
    }

    // Best known = weighted pick from frontier (temporary by design).
    // Statuses were updated above; re-read to reflect them.
    const { rows: live } = await pool.query(
      `SELECT * FROM resolution_paths
       WHERE organization_id=$1 AND family_id=$2 AND status IN ('ACTIVE','CANDIDATE')`,
      [orgId, familyId]);
    const best = comparator.bestKnown(live.length ? live : frontier);
    if (best) {
      // Atomic single-canonical swap per family
      await pool.query('BEGIN');
      try {
        await pool.query(`UPDATE resolution_paths SET is_canonical=false WHERE family_id=$1 AND is_canonical=true`, [familyId]);
        await pool.query(`UPDATE resolution_paths SET is_canonical=true, status='ACTIVE' WHERE id=$1`, [best.id]);
        await pool.query('COMMIT');
      } catch (e) {
        await pool.query('ROLLBACK');
        throw e;
      }
    }

    return {
      activePaths: frontier.map(f => f.id),
      dominatedPaths: dominated.map(f => f.id),
      candidatesReserve: rows.filter(p => p.status === 'CANDIDATE').map(p => p.id),
      bestKnownPathId: best?.id ?? null,
      explorationOutcome,
      eliminatedThisRound: dominated.length
    };
  }
}

export default new PathEliminator();
