/**
 * TaskProfile - Generic task description per §3
 * Domain-agnostic, extensible without core changes
 */
export class TaskProfile {
  constructor(data = {}) {
    this.taskId = data.taskId || `task-${Date.now()}`;
    this.domain = data.domain || 'general';
    this.taskFamily = data.taskFamily || this.inferTaskFamily(data);
    this.objective = data.objective || data.task || '';
    this.constraints = data.constraints || {};
    this.inputCharacteristics = data.inputCharacteristics || {};
    this.requiredCapabilities = data.requiredCapabilities || [];
    this.environment = data.environment || {};
    this.language = data.language || 'en';
    this.framework = data.framework || null;
    this.country = data.country || null;
    this.temporalRequirements = data.temporalRequirements || {};
    this.riskLevel = data.riskLevel || 'low';
    // Domain-specific extensions
    this.extensions = data.extensions || {};
    // Allow any additional domain-specific fields
    Object.assign(this, data.extensions);
  }

  inferTaskFamily(data) {
    const task = (data.task || data.objective || '').toLowerCase();
    const domain = (data.domain || '').toLowerCase();
    if (domain === 'coding') {
      if (task.includes('api') && task.includes('express')) return 'backend_api';
      if (task.includes('auth') || task.includes('jwt')) return 'auth_system';
      return 'coding_general';
    }
    if (domain === 'research' || task.includes('regulator') || task.includes('market')) return 'regulatory_research';
    if (domain === 'finance') return 'market_analysis';
    return `${domain || 'general'}_general`;
  }

  toJSON() {
    return {
      taskId: this.taskId,
      domain: this.domain,
      taskFamily: this.taskFamily,
      objective: this.objective,
      constraints: this.constraints,
      requiredCapabilities: this.requiredCapabilities,
      language: this.language,
      framework: this.framework,
      country: this.country,
      riskLevel: this.riskLevel,
      extensions: this.extensions
    };
  }

  static fromTask(task, domain = 'general', extra = {}) {
    return new TaskProfile({ task, domain, objective: task, ...extra });
  }
}
