/**
 * ExecutionPath - Generic best known path per §6-7
 * ResearchPath is now an alias for backward compatibility
 */
import repository from '../researchPath/repository.js';

export class ExecutionPath {
  constructor(data = {}) {
    this.id = data.id;
    this.taskFamily = data.taskFamily;
    this.domain = data.domain || 'general';
    this.version = data.version || 1;
    this.parentId = data.parentId || null;
    this.steps = data.steps || [];
    this.isCanonical = data.isCanonical || false;
    this.qualityScore = data.qualityScore || 0.5;
    this.verificationStatus = data.verificationStatus || 'unverified';
    this.latencyMs = data.latencyMs || 0;
    this.searchCount = data.searchCount || 0;
    this.tokenUsage = data.tokenUsage || { input: 0, output: 0 };
    this.successRate = data.successRate || 0;
    this.provenance = data.provenance || {};
    this.createdAt = data.createdAt;
  }

  static async getCanonical(orgId, taskFamily) {
    const { path } = await repository.getCanonicalPath(orgId, taskFamily);
    return path ? new ExecutionPath(path) : null;
  }

  static async getBest(orgId, domain) {
    const path = await repository.getBestPath(orgId, domain);
    return path ? new ExecutionPath(path) : null;
  }
}

// Alias for backward compatibility
export const ResearchPath = ExecutionPath;
export default ExecutionPath;
