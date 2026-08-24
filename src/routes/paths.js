import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import evolutionEngine, { PathEvolutionEngine } from '../pathEngine/evolution.js';
import registry from '../pathEngine/registry.js';
import PathComparator from '../pathEngine/comparator.js';
import selectorEngine from '../pathEngine/selector.js';
import { buildProblemSignature } from '../pathEngine/signature.js';
import { pool } from '../db/connection.js';

const router = Router();

/** POST /v1/paths/select — Path Selection Engine V2 (zero LLM, zero context) */
router.post('/select', authenticateApiKey, async (req, res) => {
  const orgId = req.organization_id;
  const { task, domainOverride, options } = req.body;
  if (!task) return res.status(400).json({ error: 'task required', request_id: req.request_id });

  try {
    const signature = buildProblemSignature(task, domainOverride);
    // Family with hierarchical fallback (specialization-aware)
    let family = await registry.findFamilyWithFallback(orgId, signature);
    if (!family) {
      return res.json({ decision: 'RESEARCH', selectedPath: null,
        selectionReason: 'no family for this problem yet', selectionLLMCalls: 0,
        contextAddedTokens: 0, request_id: req.request_id });
    }

    const engine = options ? new (await import('../pathEngine/selector.js')).PathSelectionEngine(options) : selectorEngine;
    const selection = await engine.selectBestPath({
      orgId, task, problemSignature: { ...signature, familyKey: family.family_key }, familyId: family.id
    });

    res.json({
      decision: 'PATH_SELECTED',
      familyId: family.id,
      familyKey: family.family_key,
      specializedFallback: family.family_key !== signature.familyKey,
      ...selection,
      request_id: req.request_id
    });
  } catch (e) {
    console.error('[paths/select]', e.message);
    res.status(500).json({ error: 'Internal server error', details: e.message, request_id: req.request_id });
  }
});

/** GET /v1/paths/statistics — per-path execution statistics */
router.get('/statistics', authenticateApiKey, async (req, res) => {
  const { familyId } = req.query;
  const paths = await pool.query(
    `SELECT id FROM resolution_paths WHERE organization_id=$1 AND family_id=$2`,
    [req.organization_id, familyId]);
  const statsMap = await selectorEngine.getStats(req.organization_id, paths.rows.map(p=>p.id));
  const out = {};
  for (const [pid, s] of statsMap) out[pid] = s;
  res.json({ statistics: out, pathCount: paths.rows.length, request_id: req.request_id });
});

/** GET /v1/paths/regret — estimated regret of past selections */
router.get('/regret', authenticateApiKey, async (req, res) => {
  const { familyId } = req.query;
  const rows = await pool.query(
    `SELECT pe.path_id, AVG(pe.quality_score) AS avg_q, COUNT(*) AS n
     FROM path_executions pe JOIN resolution_paths rp ON rp.id=pe.path_id
     WHERE rp.organization_id=$1 AND rp.family_id=$2 AND pe.quality_score IS NOT NULL
     GROUP BY pe.path_id ORDER BY avg_q DESC`,
    [req.organization_id, familyId]);
  if (!rows.rows.length) return res.json({ estimatedRegret: null, note: 'no observations' });
  const bestObservable = parseFloat(rows.rows[0].avg_q);
  const detail = rows.rows.map(r=>({
    pathId: r.path_id, avgQuality: parseFloat(r.avg_q).toFixed(3), observations: r.n,
    estimatedRegret: (bestObservable - parseFloat(r.avg_q)).toFixed(3)
  }));
  res.json({ bestObservableQuality: bestObservable, byPath: detail, request_id: req.request_id });
});

/** POST /v1/paths/observe — record an execution observation and converge the family */
router.post('/observe', authenticateApiKey, async (req, res) => {
  const orgId = req.organization_id;
  const { task, steps, metrics, domainOverride, provenance, createdBy } = req.body;
  if (!task) return res.status(400).json({ error: 'task required', request_id: req.request_id });
  try {
    const result = await evolutionEngine.observe({
      orgId, task, steps, metrics, domainOverride, provenance,
      createdBy: createdBy || agentFrom(req)
    });
    res.json({ ok: true, ...result, request_id: req.request_id });
  } catch (e) {
    console.error('[paths/observe]', e.message);
    res.status(500).json({ error: 'Internal server error', details: e.message, request_id: req.request_id });
  }
});

function agentFrom(req) {
  const h = req.headers['x-api-key'];
  return h ? `key:${String(h).slice(0,6)}…` : 'anonymous'; // never log full key
}

/** POST /v1/paths/compare — compare two paths by id (Pareto verdict) */
router.post('/compare', authenticateApiKey, async (req, res) => {
  const { pathAId, pathBId } = req.body;
  const q = await pool.query(
    `SELECT * FROM resolution_paths WHERE id IN ($1,$2) AND organization_id=$3`,
    [pathAId, pathBId, req.organization_id]);
  if (q.rows.length < 2) return res.status(404).json({ error: 'Paths not found' });
  const a = q.rows.find(r => r.id === pathAId);
  const b = q.rows.find(r => r.id === pathBId);
  const verdict = new PathComparator().compare(a, b);
  res.json({ verdict, dimensions: { a: new PathComparator().dimensions(a), b: new PathComparator().dimensions(b) }, request_id: req.request_id });
});

/** GET /v1/paths/best — best known path at time T for a family */
router.get('/best', authenticateApiKey, async (req, res) => {
  const { familyKey, task } = req.query;
  let familyId = req.query.familyId;
  if (!familyId && task) {
    const sig = buildProblemSignature(task);
    const fam = await pool.query(`SELECT id FROM problem_families WHERE organization_id=$1 AND family_key=$2`, [req.organization_id, sig.familyKey]);
    familyId = fam.rows[0]?.id;
  }
  if (!familyId) return res.status(400).json({ error: 'familyId or task required' });
  const snap = await new PathEvolutionEngine().snapshot(req.organization_id, familyId);
  res.json({ bestKnownPathAtTimeT: snap.bestKnownPathAtTimeT, paretoFrontierIds: snap.paretoFrontierIds, request_id: req.request_id });
});

/** GET /v1/paths/frontier — Pareto frontier of a family */
router.get('/frontier', authenticateApiKey, async (req, res) => {
  const { familyId } = req.query;
  const snap = await new PathEvolutionEngine().snapshot(req.organization_id, familyId);
  res.json({ frontierIds: snap.paretoFrontierIds, dominatedIds: snap.dominatedIds, paths: snap.paths, request_id: req.request_id });
});

/** GET /v1/paths/history — elimination + version history */
router.get('/history', authenticateApiKey, async (req, res) => {
  const { familyId } = req.query;
  const elim = await pool.query(
    `SELECT * FROM path_eliminations WHERE organization_id=$1 AND family_id=$2 ORDER BY created_at DESC`,
    [req.organization_id, familyId]);
  const versions = await pool.query(
    `SELECT pv.* FROM path_versions pv JOIN resolution_paths rp ON rp.id=pv.path_id
     WHERE rp.organization_id=$1 AND rp.family_id=$2 ORDER BY pv.created_at`,
    [req.organization_id, familyId]);
  res.json({ eliminations: elim.rows, versions: versions.rows, request_id: req.request_id });
});

/** GET /v1/paths/evolution — full snapshot */
router.get('/evolution', authenticateApiKey, async (req, res) => {
  const { familyId } = req.query;
  const snap = await new PathEvolutionEngine().snapshot(req.organization_id, familyId);
  res.json({ ...snap, request_id: req.request_id });
});

export { router as pathsRoutes };
