/** Local persistence for NEURA workspace (conversations, projects). */

const KEY_CONVS = 'neura_conversations';
const KEY_PROJECTS = 'neura_projects';
const KEY_MODELS = 'neura_selected_model';

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

export function loadConversations() { return load(KEY_CONVS, []); }
export function saveConversations(list) { save(KEY_CONVS, list); }
export function loadProjects() {
  const existing = load(KEY_PROJECTS, null);
  if (existing) return existing;
  const defaults = [
    { id: 'p-brvm', name: 'BRVM Research', color: '#6C7CFF', conversations: [] },
    { id: 'p-neuranet', name: 'NeuraNet', color: '#22C55E', conversations: [] },
    { id: 'p-startup', name: 'Startup Research', color: '#F59E0B', conversations: [] },
    { id: 'p-eng', name: 'AI Engineering', color: '#06B6D4', conversations: [] },
  ];
  save(KEY_PROJECTS, defaults);
  return defaults;
}
export function saveProjects(list) { save(KEY_PROJECTS, list); }

export function loadSelectedModel() {
  try { return JSON.parse(localStorage.getItem(KEY_MODELS) || 'null'); } catch { return null; }
}
export function saveSelectedModel(model) { localStorage.setItem(KEY_MODELS, JSON.stringify(model)); }

export function newConversationId() { return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`; }
export function newMessageId() { return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`; }
