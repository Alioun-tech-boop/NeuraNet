/* NeuraNet Console — vanilla SPA, no dependencies.
   Security: API key lives in localStorage only, sent as X-API-Key to same-origin /v1. */

const $ = (sel) => document.querySelector(sel);
const TITLES = {
  overview: "Vue d'ensemble",
  paths: 'Chemins & Pareto',
  execute: 'Exécuter une tâche',
  knowledge: 'Connaissance',
  settings: 'Paramètres',
};

/* ── API layer ── */
function apiKey() { return localStorage.getItem('nn_api_key') || ''; }

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey(),
      ...(opts.headers || {}),
    },
  });
  const rid = res.headers.get('X-Request-ID');
  if (rid) $('#request-id').textContent = rid;
  let body = null;
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const msg = (body && body.error) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

function setConnStatus(state) {
  const el = $('#conn-status');
  el.className = `status-pill ${state === 'ok' ? 'ok' : state === 'err' ? 'err' : 'unknown'}`;
  el.textContent = state === 'ok' ? 'Connecté' : state === 'err' ? 'Erreur' : 'Non connecté';
}

/* ── Render helpers ── */
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function card(label, value, sub) {
  return `<div class="card"><div class="label">${esc(label)}</div>
    <div class="value">${esc(value)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;
}

function table(headers, rows) {
  if (!rows.length) return '<p class="muted">Aucune donnée.</p>';
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function showResult(el, payload, ok = true) {
  el.className = `result-box ${ok ? 'ok' : 'ko'}`;
  el.innerHTML = `<div class="result-title">${ok ? '✓ Réponse' : '✗ Erreur'}</div>
    <pre>${esc(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2))}</pre>`;
}

/* Flatten unknown JSON into displayable rows */
function genericRows(obj, depth = 0) {
  if (Array.isArray(obj)) return obj.map((x) => [depth ? '' : '', esc(JSON.stringify(x)).slice(0, 200)]);
  return Object.entries(obj).map(([k, v]) => [
    `<code>${esc(k)}</code>`,
    typeof v === 'object' && v !== null
      ? `<pre style="margin:0">${esc(JSON.stringify(v, null, 1))}</pre>`
      : esc(v),
  ]);
}

/* ── Views ── */
async function viewOverview() {
  const cardsEl = $('#overview-cards');
  const evoEl = $('#overview-evolution');
  try {
    const health = await api('/health');
    setConnStatus('ok');
    let metrics = null, evolution = null;
    try { metrics = await api('/v1/neurannet/metrics'); } catch { /* optional */ }
    try { evolution = await api('/v1/paths/evolution'); } catch { /* optional */ }
    cardsEl.innerHTML =
      card('Statut API', health.status === 'ok' ? 'OK' : health.status) +
      card('Chemins actifs', metrics?.active_paths ?? '—', 'après élimination Pareto') +
      card('Familles suivies', metrics?.families ?? metrics?.total_families ?? '—') +
      card('Observations', metrics?.observations ?? metrics?.total_observations ?? '—');
    evoEl.innerHTML = table(['Détail'], genericRows(evolution?.evolution ?? evolution ?? { info: 'aucune donnée encore' }));
  } catch (e) {
    setConnStatus('err');
    cardsEl.innerHTML = '';
    evoEl.innerHTML = `<p class="muted">${esc(e.message)} — vérifiez la clé API dans Paramètres.</p>`;
  }
}

async function viewPaths() {
  const statsEl = $('#paths-stats'), frontierEl = $('#paths-frontier'),
        regretEl = $('#paths-regret'), cardsEl = $('#paths-cards');
  frontierEl.innerHTML = regretEl.innerHTML = statsEl.innerHTML = '<p class="muted">Chargement…</p>';
  let stats = null, frontier = null, regret = null;
  try {
    try { stats = await api('/v1/paths/statistics'); } catch (e) { statsEl.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
    try { frontier = await api('/v1/paths/frontier'); } catch (e) { frontierEl.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
    try { regret = await api('/v1/paths/regret'); } catch (e) { regretEl.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
    setConnStatus('ok');

    if (stats) {
      const list = Array.isArray(stats) ? stats : stats.statistics || stats.families || [];
      cardsEl.innerHTML =
        card('Familles', list.length) +
        card('Brutes', stats.raw_paths ?? '—') +
        card('Éliminées', stats.eliminated ?? '—', 'dominées ou incompatibles');
      statsEl.innerHTML = table(
        ['Famille', 'Chemins', 'Meilleure qualité', 'Latence p50', 'Coût'],
        list.slice(0, 50).map((f) => [
          `<code>${esc(f.family_id || f.id || '?')}</code>`,
          esc(f.path_count ?? f.paths ?? '?'),
          esc(f.best_quality != null ? Number(f.best_quality).toFixed(3) : '—'),
          esc(f.p50_latency_ms != null ? f.p50_latency_ms + ' ms' : '—'),
          esc(f.avg_cost != null ? Number(f.avg_cost).toFixed(4) : '—'),
        ]));
    }
    if (frontier) {
      const list = Array.isArray(frontier) ? frontier : frontier.frontier || frontier.paths || [];
      frontierEl.innerHTML = table(
        ['Chemin', 'Famille', 'Qualité', 'Latence', 'Coût', 'Réutilisations'],
        list.slice(0, 100).map((p) => [
          `<code>${esc(String(p.id || p.path_id || '?')).slice(0, 18)}…</code>`,
          esc(p.family_id || '—'),
          esc(p.quality != null ? Number(p.quality).toFixed(3) : '—'),
          esc(p.latency_ms != null ? p.latency_ms : '—'),
          esc(p.cost != null ? Number(p.cost).toFixed(4) : '—'),
          esc(p.reuse_count ?? 0),
        ]));
    }
    if (regret) {
      regretEl.innerHTML = table(['Détail regret'], genericRows(regret.regret ?? regret));
    }
  } catch (e) { setConnStatus('err'); }
}

async function bindExecute() {
  $('#form-execute').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = $('#exec-result');
    out.classList.remove('hidden', 'ko', 'ok');
    out.innerHTML = '<p class="muted">Exécution…</p>';
    try {
      const body = {
        task: $('#exec-task').value.trim(),
        workflow: $('#exec-workflow').value,
      };
      if ($('#exec-domain').value.trim()) body.domain = $('#exec-domain').value.trim();
      if ($('#exec-jurisdiction').value.trim()) body.jurisdiction = $('#exec-jurisdiction').value.trim();
      const resp = await api('/v1/neurannet/select', { method: 'POST', body: JSON.stringify(body) });
      showResult(out, resp, true);
    } catch (e2) { showResult(out, e2.message, false); }
  });

  $('#form-observe').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = $('#obs-result');
    out.classList.remove('hidden', 'ko', 'ok');
    out.innerHTML = '<p class="muted">Envoi…</p>';
    try {
      const body = { path_id: $('#obs-path-id').value.trim(), success: $('#obs-success').value === 'true' };
      if ($('#obs-quality').value !== '') body.quality = parseFloat($('#obs-quality').value);
      if ($('#obs-latency').value !== '') body.latency_ms = parseInt($('#obs-latency').value, 10);
      const resp = await api('/v1/neurannet/observe', { method: 'POST', body: JSON.stringify(body) });
      showResult(out, resp, true);
    } catch (e2) { showResult(out, e2.message, false); }
  });
}

async function bindKnowledge() {
  $('#form-knowledge').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = $('#knowledge-result');
    out.classList.remove('hidden', 'ko', 'ok');
    out.innerHTML = '<p class="muted">Interrogation…</p>';
    try {
      const resp = await api('/v1/query', { method: 'POST', body: JSON.stringify({ query: $('#kq-input').value.trim() }) });
      showResult(out, resp, true);
    } catch (e2) { showResult(out, e2.message, false); }
  });
}

function bindSettings() {
  $('#set-api-key').value = apiKey();
  $('#form-settings').addEventListener('submit', (e) => {
    e.preventDefault();
    const key = $('#set-api-key').value.trim();
    localStorage.setItem('nn_api_key', key);
    const out = $('#settings-status');
    out.classList.remove('hidden');
    showResult(out, key ? 'Clé enregistrée localement.' : 'Clé effacée.', true);
  });
}

/* ── Router ── */
const VIEWS = ['overview', 'paths', 'execute', 'knowledge', 'settings'];
let loadedOnce = {};

function route() {
  const name = (location.hash.replace('#/', '') || 'overview').split('?')[0];
  const valid = VIEWS.includes(name) ? name : 'overview';
  for (const v of VIEWS) $('#view-' + v).classList.toggle('hidden', v !== valid);
  document.querySelectorAll('.nav-item').forEach((a) =>
    a.classList.toggle('active', a.getAttribute('href') === '#/' + valid));
  $('#view-title').textContent = TITLES[valid];
  if (valid === 'overview') viewOverview();
  else if (valid === 'paths') viewPaths();
}

window.addEventListener('hashchange', route);
document.addEventListener('DOMContentLoaded', () => {
  route();
  bindExecute();
  bindKnowledge();
  bindSettings();
  $('#btn-refresh-paths').addEventListener('click', viewPaths);
});
