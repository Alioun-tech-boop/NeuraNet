import repository from '../researchPath/repository.js';
import { pool } from '../db/connection.js';

/**
 * NeuraNetOptimizer - async learning after production
 * For MVP: sync execution with event abstraction (light queue, evolvable to Redis/BullMQ)
 */
export class NeuraNetOptimizer {
  async onProductionCreated(production, experience) {
    const start = Date.now();
    try {
      // 1. Evaluate production (already done in ProductionEngine)
      // 2. Extract strategies from experience
      // 3. Evaluate path from production's research
      const orgId = production.organization_id;
      const domain = production.domain || 'general';
      const query = production.original_query;
      const taskFamily = repository.taskFamilyFromQuery(query, domain);

      // Get canonical path for this family
      const { path: canonical } = await repository.getCanonicalPath(orgId, taskFamily);

      // Build candidate path from this production's strategy
      const steps = production.claims ? [] : []; // Simplified: use experience strategy if available
      // For MVP, create a candidate path from production's strategy
      let candidateSteps = [];
      if (experience && experience.strategy) {
        const strat = typeof experience.strategy === 'string' ? JSON.parse(experience.strategy) : experience.strategy;
        if (Array.isArray(strat)) candidateSteps = strat.map((s,i)=>({ order: i+1, action: String(s).slice(0,100) }));
      }
      if (candidateSteps.length === 0) candidateSteps = [{ order: 1, action: 'search_general' }];

      const metrics = {
        quality: parseFloat(production.quality_score) || 0.5,
        verification: production.verification_status,
        latency: production.latency_ms || 0,
        searchCount: 1,
        tokens: { input: 0, output: 0 },
        successRate: 1.0
      };

      const candidate = await repository.saveCandidatePath({
        orgId, taskFamily, domain,
        steps: candidateSteps,
        parentId: canonical?.id || null,
        provenance: { productionId: production.id, experienceId: experience?.id, createdBy: production.agent_id },
        metrics
      });

      // Compare and potentially promote
      const comparison = await repository.comparePaths(canonical, candidate);
      let promoted = false;
      if (comparison === 'BETTER') {
        await repository.promoteCanonicalPath(orgId, taskFamily, candidate.id);
        promoted = true;
      }

      return {
        candidatePathId: candidate.id,
        canonicalPathId: promoted ? candidate.id : canonical?.id,
        comparison,
        promoted,
        latencyMs: Date.now() - start,
        pathVersionCreated: true,
        pathImproved: promoted
      };
    } catch (err) {
      console.error('[NeuraNetOptimizer] Failed:', err.message);
      // Failure must not break the agent response (per §20)
      return { error: err.message, latencyMs: Date.now() - start, pathVersionCreated: false };
    }
  }

  // Event abstraction: for now sync, later queue
  async emit(event, data) {
    if (event === 'production.created') {
      return this.onProductionCreated(data.production, data.experience);
    }
  }
}

export default new NeuraNetOptimizer();
