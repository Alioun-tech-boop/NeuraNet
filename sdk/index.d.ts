import type { NeuraNet as Client } from './index.js';

export default Client;
export { NeuraNet, NeuraNetError } from './index.js';

declare namespace Client {
  interface SelectionResponse {
    decision: 'REUSE_PATH' | 'RESEARCH';
    selectedPath?: {
      id: string;
      family_id: string;
      steps: Array<{ action?: string; tool?: string; queryPattern?: string }>;
      [k: string]: unknown;
    };
    selectionReason?: string;
    selectionLLMCalls: number;
    contextAddedTokens: number;
    request_id: string;
  }

  interface DemoRunResponse {
    ok: true;
    variant: 'new' | 'transfer';
    task: string;
    timings: { totalMs: number; stages: Record<string, number>; baselineMs: number };
    retrieval: {
      similarity: number;
      lexical: 'LOW' | 'HIGH';
      topMatch: { path: string; similarity: number; steps: unknown[] } | null;
      alternatives: Array<{ path: string; similarity: number }>;
    };
    compatibility: { passed: Array<{ label: string; value: string }>; rejected: Array<{ label: string; reason: string }> };
    strategy: { path: string; steps: unknown[]; status: string; transferred: boolean; previousTask: string | null };
    execution: { sources: Array<{ title: string; url: string }>; searchCalls: number; tokens: { input: number; output: number } };
    result: {
      answer: string;
      baselineAnswer: string;
      quality: number;
      qualityBreakdown: { length: number; structure: number; specificity: number; relevance: number };
      baselineQuality: number;
      delta: number;
    };
    invariants: { contextTokens: 0; matchingLLMCalls: 0; provider: string; model: string };
  }

  interface ObserveBody {
    task: string;
    familyId: string;
    pathId?: string | null;
    executionId?: string | null;
    metrics?: { success?: boolean; quality?: number; latency_ms?: number; estimated_cost?: number };
    environment?: Record<string, unknown>;
    domain?: string;
  }

  interface ApiKeyCreated {
    id: string;
    name: string;
    scopes: string[];
    key: string;            // plaintext — shown exactly once
    keyPreview: string;
    createdAt: string;
  }

  interface ApiKeyRow {
    id: string;
    name: string;
    scopes: string[];
    preview: string;
    active: boolean;
    revokedAt: string | null;
    revocationReason: string | null;
    createdAt: string;
  }

  interface LearnHandle<R = unknown> {
    decision: 'REUSE_PATH' | 'RESEARCH';
    selectionReason?: string;
    path: SelectionResponse['selectedPath'];
    report: (metrics: { success?: boolean; quality?: number; latency_ms?: number; estimated_cost?: number }) => Promise<R>;
  }
}

declare class NeuraNet {
  constructor(opts?: {
    baseUrl?: string;
    apiKey: string;
    timeoutMs?: number;
    maxRetries?: number;
    retryOnRateLimit?: boolean;
  });

  demo: {
    run(task: string, extra?: Record<string, unknown>): Promise<Client.DemoRunResponse>;
    strategies(): Promise<{ strategies: Array<{ path: string; description: string; confidence: number }>; count: number }>;
  };

  paths: {
    select(body: { task: string; domainOverride?: string; options?: Record<string, unknown> }): Promise<Client.SelectionResponse>;
    statistics(familyId?: string): Promise<{ statistics: Record<string, unknown>; pathCount: number }>;
    frontier(familyId?: string): Promise<{ frontierIds: string[]; dominatedIds: string[]; paths: unknown[] }>;
    regret(familyId?: string): Promise<{ bestObservableQuality?: number; byPath?: Array<{ pathId: string; avgQuality: string; observations: number; estimatedRegret: string }> }>;
    history(familyId?: string): Promise<{ eliminations: unknown[]; versions: unknown[] }>;
    evolution(familyId?: string): Promise<Record<string, unknown>>;
    observe(body: Record<string, unknown>): Promise<Record<string, unknown>>;
  };

  neurannet: {
    select(body: { task: string; workflow?: string; domain?: string; jurisdiction?: string }): Promise<Client.SelectionResponse>;
    observe(body: Client.ObserveBody): Promise<{ ok: true; observationId: string; createdAt: string }>;
    discover(familyId: string): Promise<{ ok: true } & Record<string, unknown>>;
    metrics(): Promise<Record<string, unknown>>;
    governance(): Promise<Record<string, unknown>>;
  };

  knowledge: {
    query(query: string, extra?: Record<string, unknown>): Promise<Record<string, unknown>>;
  };

  apiKeys: {
    create(opts?: { name?: string; scopes?: string[]; admin?: boolean }): Promise<Client.ApiKeyCreated>;
    list(): Promise<{ keys: Client.ApiKeyRow[] }>;
    revoke(id: string, reason?: string): Promise<{ ok: true; id: string; name: string }>;
  };

  learn<R = unknown>(task: string, opts?: { domain?: string; workflow?: string }): Promise<Client.LearnHandle<R>>;
  health(): Promise<{ status: string; request_id: string }>;
  info(): Promise<{ name: string; version: string; status: string }>;
}
