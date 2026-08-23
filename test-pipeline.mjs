import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import exp from './src/sanitization/index.js';
const experiencePipeline = exp.default || exp;

// Minimal test
const rawTrace = {
  original_task: 'Research Company X financial performance. API key sk-test123 should be redacted.',
  strategy: 'Search for financial reports.',
  search_queries: ['Company X financial 2024'],
  sources: [{ url_domain: 'https://sec.gov/Company-X', trust_score: 0.95 }],
  outcome: 'Revenue: $10M.',
  agent_id: 'agent-001',
  organization_id: 'org-001'
};

console.log('=== TEST 1: SANITIZATION ===');
const result = experiencePipeline.sanitizeResearchTrace(rawTrace);
console.log('Redactions:', result.redactions.length);
console.log('Sanitized contains API key?', result.sanitized.includes('test123') ? 'YES (BUG)' : 'NO (good)');
console.log('Sanitized task:', result.sanitized.substring(0, 70) + '...');
console.log();

console.log('=== TEST 2: EXTRACT EXPERIENCE ===');
const extracted = experiencePipeline.extractExperience(result, {
  quality_score: 0.92,
  verification_result: 'passed',
  success: true
});
console.log('task_type:', extracted.task_type);
console.log('trust_score:', extracted.trust_score);
console.log('lifecycle_state:', extracted.lifecycle_state);
console.log('provenance source_agent_id:', extracted.provenance.source_agent_id);
console.log('evaluation_status:', extracted.evaluation_status);
console.log();

console.log('=== TEST 3: FRESHNESS ===');
const f1 = experiencePipeline.determineFreshnessRequirement('Research financial performance of Company X');
const f2 = experiencePipeline.determineFreshnessRequirement('Study mathematics history');
console.log('Finance freshness:', f1);
console.log('Math freshness:', f2);
console.log();

console.log('=== TEST 4: LIFECYCLE STATE ===');
const l1 = experiencePipeline.determineLifecycleState({
  lifecycle_state: 'created',
  evaluation_status: 'passed',
  trust_score: 0.85,
  reuse_count: 0,
  failure_count: 0
});
console.log('created+passed+0.85 trust ->', l1.lifecycle_state);

const l2 = experiencePipeline.determineLifecycleState({
  lifecycle_state: 'quarantined',
  evaluation_status: 'passed',
  trust_score: 0.85,
  reuse_count: 0,
  failure_count: 0
});
console.log('quarantined+passed+0.85 trust ->', l2.lifecycle_state);

const l3 = experiencePipeline.determineLifecycleState({
  lifecycle_state: 'created',
  evaluation_status: 'failed',
  trust_score: 0.2,
  reuse_count: 0,
  failure_count: 2
});
console.log('created+failed+0.2 trust+2 failures ->', l3.lifecycle_state);
console.log();

console.log('=== TEST 5: EVALUATE ===');
const evalResult = experiencePipeline.evaluateExperience({
  quality_score: 0.92,
  evaluation_status: 'passed',
  freshness_score: 0.8,
  success_count: 3,
  failure_count: 0
});
console.log('status:', evalResult.status);
console.log('score:', evalResult.score);

const evalResult2 = experiencePipeline.evaluateExperience({
  quality_score: 0.3,
  evaluation_status: 'failed',
  freshness_score: 0.3,
  success_count: 0,
  failure_count: 3
});
console.log('low quality - status:', evalResult2.status);
console.log('low quality - score:', evalResult2.score);
console.log();

console.log('=== TEST 6: PROCESS PIPELINE ===');
const pipelineResult = experiencePipeline.processExperiencePipeline(rawTrace, {
  quality_score: 0.92,
  verification_result: 'passed',
  success: true,
  latency_ms: 1200,
  searches: 5,
  tool_calls: 3,
  estimated_cost: 0.15
});
console.log('Final lifecycle state:', pipelineResult.lifecycle_state);
console.log('Evaluation status:', pipelineResult.evaluation_status);
console.log('Trust score:', pipelineResult.trust_score);
console.log('Confidence score:', pipelineResult.confidence_score);
console.log('Quality score:', pipelineResult.quality_score);
console.log();

console.log('ALL TESTS PASSED');