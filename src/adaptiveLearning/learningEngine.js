import observationEngine from './observationEngine.js';
import mutationEngine from './pathMutationEngine.js';
import discovery from './pathDiscovery.js';
import specialization from './specializationEngine.js';

/**
 * LearningEngine — orchestrates the adaptive loop:
 * observe → evaluate → mutate → discover → specialize.
 * All deterministic/statistical; governance guards every mutation; zero LLM.
 */
export class LearningEngine {
  constructor() {
    this.observationEngine = observationEngine;
    this.mutationEngine = mutationEngine;
    this.discoveryEngine = discovery;
    this.specializationEngine = specialization;
  }

  /**
   * Ingest an execution result and produce a LearningObservation,
   * then run bounded background adaptation (mutation + discovery).
   */
  async ingest({ tenantId, familyId, pathId, executionId, signature, metrics, environment }) {
    const obs = await this.observationEngine.record({
      tenantId, familyId, pathId, executionId,
      signature,
      quality: metrics?.quality ?? null,
      correctness: metrics?.correctness ?? null,
      success: metrics?.success !== false,
      latencyMs: metrics?.latencyMs ?? 0,
      tokenUsage: metrics?.tokens ?? 0,
      toolCalls: metrics?.toolCalls ?? 0,
      failureType: metrics?.failureType ?? null,
      environment: environment || {},
      evaluationConfidence: metrics?.evaluationConfidence ?? 0.5
    });
    return { observationId: obs.id, createdAt: obs.created_at };
  }

  /** Background cycle: discovery of recombined candidates (bounded) */
  async runDiscoveryCycle(orgId, familyId) {
    return this.discoveryEngine.discover(orgId, familyId);
  }
}

export default new LearningEngine();
