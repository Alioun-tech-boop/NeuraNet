/**
 * NEURA — THIN adapter over EXISTING NeuraNet infrastructure.
 *
 * This file MUST NOT reimplement any NeuraNet algorithm.
 * It only calls the existing backend via the official SDK / fetch transport.
 *
 * Architecture:
 *   NEURA UI → neuraAdapter → /v1/neura/* → EXISTING NeuraNet engines
 *                               (pathEngine, localEmbedding, pgvector,
 *                                WebSearchProvider, llmProvider factory)
 *
 * If a capability already exists in NeuraNet, we call it. No duplication.
 */

const DEFAULT_BASE = '';

function getBase() {
  const stored = localStorage.getItem('nn_api_base');
  if (stored && /localhost:3000/.test(stored)) {
    localStorage.removeItem('nn_api_base');
    return '';
  }
  return stored ?? (import.meta.env?.VITE_API_BASE ?? DEFAULT_BASE);
}

function getKey() {
  return localStorage.getItem('nn_api_key') || import.meta.env?.VITE_NEURANET_API_KEY || '';
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const base = getBase();
  const url = `${base}${path}`;
  const headers = { 'Content-Type': 'application/json', 'X-API-Key': getKey() };
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const reqId = res.headers.get('x-request-id') || undefined;
  const text = await res.text();
  const json = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const err = new Error(json?.error || res.statusText);
    err.status = res.status;
    err.requestId = reqId;
    err.body = json;
    throw err;
  }
  return json;
}

/** Retrieve available models (provider catalog). Delegates to GET /v1/neura/models */
export async function getModels() {
  return request('/v1/neura/models');
}

/** Main conversational call: task → NeuraNet → LLM → experience update. */
export async function chat({ message, model, conversationId, projectId, signal } = {}) {
  return request('/v1/neura/chat', {
    method: 'POST',
    body: { message, model, conversationId, projectId },
    signal,
  });
}

/** List learned experiences (procedural strategies). */
export async function getExperiences() {
  return request('/v1/neura/experiences');
}

/** System health for the shell. */
export async function getStatus() {
  return request('/v1/neura/status');
}

/** Architecture flow descriptor for the dev view. */
export async function getArchitecture() {
  return request('/v1/neura/architecture');
}

/** Thin helpers that delegate to lower-level NeuraNet routes when needed. */
export async function getFrontier(familyId) {
  const q = familyId ? `?familyId=${encodeURIComponent(familyId)}` : '';
  return request(`/v1/paths/frontier${q}`);
}

export async function getStrategies() {
  return request('/v1/demo/strategies');
}
