// Field Dx — offline HVAC/R diagnostics. Boot, the job being worked, routing, and the screens.
// One job at a time: the system, a few facts about the unit (context), findings (typed, answered
// or measured) and raw readings. Everything stays on the device.
import { KB } from './kb.js';
import { diagnose, explain } from './engine.js';
import { computeMeasures } from './measure.js';
import * as calc from './calcs.js';
import { Search, norm } from './search.js';
import { TOOL_LIST, renderTool, updateTool, numBox } from './tools.js';
import { checkTurn, interpret, grammar, speakable } from './dialog.js';
import { numberWordsToDigits } from './spoken.js';
import * as voice from './voice.js';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (p) => (p >= 0.995 ? '99' : p < 0.01 ? '<1' : String(Math.round(p * 100)));
const fmt = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace(/\.0+$/, ''));

const KEY_JOB = 'fdx.job', KEY_HIST = 'fdx.history', KEY_THEME = 'fdx.theme', KEY_REPORTS = 'fdx.reports', KEY_UNITS = 'fdx.units';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: work without saving */ } },
};

let kb, search;
let job = null;
let view = { name: 'home', arg: null, q: {} };
let focusCheck = null; // a check the tech picked from "other checks"
let lastRes = null;     // the diagnosis on screen, for the voice

const ICONS = {
  snow: '<path d="M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  box: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M12 4v16M15 11v2"/>',
  fridge: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 9h12M9 5v2M9 12v4"/>',
  ice: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  flame: '<path d="M12 22a6.5 6.5 0 0 0 6.5-6.5c0-4-3-6.5-4-10-1.5 2-2 3.5-2 5-1.5-1-2-2.5-2-4.5-3 2.5-5 6-5 9.5A6.5 6.5 0 0 0 12 22z"/>',
  drop: '<path d="M12 2.5c3 4.5 6.5 8 6.5 12a6.5 6.5 0 0 1-13 0c0-4 3.5-7.5 6.5-12z"/>',
  steam: '<path d="M7 20c-2-2 2-4 0-6s2-4 0-6M12 20c-2-2 2-4 0-6s2-4 0-6M17 20c-2-2 2-4 0-6s2-4 0-6"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 2 3 0 5M14 12.5c3.5 2 5.5 4.5 4 7-1 1.7-3.6.3-4.5-2M10.2 13c-3.5 2-6.5 2.4-7.7-.2-.8-1.8 1.8-3 4-2.4"/>',
};
const icon = (name, size = 28) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.fan}</svg>`;

// ---------------------------------------------------------------- boot
async function boot() {
  try {
    let k, pt, glycol, charging;
    if (window.__FDX_INLINE_DATA__) {
      ({ kb: k, pt, glycol, charging } = window.__FDX_INLINE_DATA__);
    } else {
      [k, pt, glycol, charging] = await Promise.all(
        ['data/kb.json', 'data/pt.json', 'data/glycol.json', 'data/charging.json'].map((u) => fetch(u).then((r) => {
          if (!r.ok) throw new Error(`${u}: ${r.status}`);
          return r.json();
        })));
    }
    calc.setData({ pt, glycol, charging });
    kb = new KB(k);
    search = new Search(kb);
  } catch (e) {
    $('#main').innerHTML = `<h1>Couldn't load the knowledge base</h1><p class="lead">${esc(e.message)}</p>`;
    return;
  }
  job = store.get(KEY_JOB, null);
  if (job && !kb.systems.has(job.system)) job = null;
  applyTheme(store.get(KEY_THEME, 'auto'));
  window.addEventListener('hashchange', route);
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKey);
  if (window.__FDX_INLINE_DATA__ || !navigator.mediaDevices) $('#micbtn').hidden = true;
  setupHold();
  route();
  registerSW();
  if (window.location.search.includes('dbg')) Object.assign(window, { __kb: kb, __search: search, __job: () => job, __eval: evaluate, __heard: voiceHeard, __vs: () => vs, __voiceDry: voiceDry });
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Updated — reopen the app to use the new version');
      });
    });
  }).catch(() => { /* offline install not available here; the app still works online */ });
}

function applyTheme(mode) {
  if (mode === 'light' || mode === 'dark') document.documentElement.dataset.theme = mode;
  else delete document.documentElement.dataset.theme;
  store.set(KEY_THEME, mode);
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ---------------------------------------------------------------- job state
function newJob(system) {
  if (job && (Object.keys(job.f).length || Object.keys(job.inputs).length)) archive();
  job = { v: 1, id: Date.now().toString(36), t0: Date.now(), system, ctx: kb.defaultCtx(system), f: {}, inputs: {}, skip: [] };
  focusCheck = null;
  save();
}

function archive() {
  const hist = store.get(KEY_HIST, []);
  const { res } = evaluate();
  const top = res.post[0];
  hist.unshift({ job, when: Date.now(), top: top ? { name: top.cause.name, p: top.p } : null });
  store.set(KEY_HIST, hist.slice(0, 20));
}

function save() {
  store.set(KEY_JOB, job);
  // a named unit keeps the facts entered on it (refrigerant, metering…) for next time
  if (job?.unit) {
    const list = units(), u = list.find((x) => x.id === job.unit);
    if (u && JSON.stringify(u.ctx) !== JSON.stringify(job.ctx)) { u.ctx = { ...job.ctx }; store.set(KEY_UNITS, list); }
  }
}

function setFinding(fid, s, src = 'answer') {
  job.f[fid] = { s, src, t: Date.now() };
  if (focusCheck === fid) focusCheck = null;
  save();
}

// measured findings + the tech's own (the tech wins) → engine
function evaluate() {
  const m = computeMeasures(kb, job.system, job.ctx, job.inputs);
  const findings = {};
  for (const [fid, r] of Object.entries(m.findings)) findings[fid] = r.s;
  for (const [fid, r] of Object.entries(job.f)) findings[fid] = r.s;
  const res = diagnose(kb, { system: job.system, ctx: job.ctx, findings }, { limit: 16, skip: job.skip });
  return { m, findings, res };
}

// ---------------------------------------------------------------- routing
function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  // a voice question belongs to the screen it was asked on: leaving the screen drops it, so a later "yes" can't
  // answer it (voice flows clear their own question before they navigate)
  if (vs.pending || vs.naming || vs.saving) {
    vs.pending = null; vs.naming = vs.saving = false; vs.misses = 0;
    if (vs.on) voice.stopSpeaking();
  }
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  view = { name: parts[0] || 'home', arg: parts[1] ? decodeURIComponent(parts[1]) : null, q: Object.fromEntries(new URLSearchParams(qs || '')) };
  if (['setup', 'diag', 'readings', 'cause'].includes(view.name) && !job) view = { name: 'home', arg: null, q: {} };
  render();
  window.scrollTo(0, 0);
}

function render() {
  const sysEl = $('#sysname');
  sysEl.textContent = job ? `${unitOf(job.unit)?.name || kb.systems.get(job.system)?.short || kb.systems.get(job.system)?.name} ▾` : '';
  sysEl.title = job ? 'Unit details' : '';
  const views = { home: viewHome, setup: viewSetup, diag: viewDiag, readings: viewReadings, cause: viewCause, tools: viewTools, tool: viewTool, about: viewAbout, reports: viewReports, units: viewUnits };
  (views[view.name] || viewHome)();
  if (vs.on) voiceView();
}

function helper(text) { $('#helpertext').textContent = text; }

// ---------------------------------------------------------------- home
function viewHome() {
  const tiles = [...kb.systems.values()].filter((s) => !s.abstract)
    .map((s) => `<button class="tile" data-act="sys" data-id="${esc(s.id)}"><span class="ic">${icon(s.icon)}</span>${esc(s.name)}</button>`).join('');
  const hist = store.get(KEY_HIST, []);
  const resume = job ? `<button class="res" data-act="resume"><b>Back to: ${esc(kb.systems.get(job.system)?.name)}</b><span class="k">${Object.keys(job.f).length + Object.keys(job.inputs).length} entered</span></button>` : '';
  const recent = hist.slice(0, 4).map((h, i) => `<button class="res" data-act="reopen" data-i="${i}"><span>${esc(unitOf(h.job.unit)?.name || kb.systems.get(h.job.system)?.short || h.job.system)}${h.top ? ` — ${esc(h.top.name)}` : ''}</span><span class="k">${new Date(h.when).toLocaleDateString()}</span></button>`).join('');
  const us = knownUnits();
  const unitRows = us.slice(0, 6).map((u) => `<button class="res" data-act="unit-start" data-id="${esc(u.id)}"><span><b>${esc(u.name)}</b> <span class="muted">${esc(kb.systems.get(u.system).short || kb.systems.get(u.system).name)}</span></span><span class="k">start ›</span></button>`).join('')
    + (us.length ? `<button class="res" data-act="go" data-href="#/units"><span>${us.length > 6 ? `All ${us.length} units` : 'Units'}: history and reports</span><span class="k">›</span></button>` : '');
  $('#main').innerHTML = `
    <h1>What's wrong?</h1>
    <p class="lead">Describe it the way you'd say it, or pick the equipment.</p>
    <div class="search"><input id="homeq" type="search" autocomplete="off" enterkeyhint="go" placeholder="e.g. walk-in freezer warm, coil iced, fans running" value="${esc(view.q.text || '')}"></div>
    <div id="homeres"></div>
    ${resume ? `<h2>Current job</h2><div class="results">${resume}</div>` : ''}
    ${unitRows ? `<h2>Your units</h2><div class="results">${unitRows}</div>` : ''}
    <h2>Equipment</h2>
    <div class="tiles">${tiles}</div>
    <h2>Calculators</h2>
    <div class="results">${TOOL_LIST.slice(0, 4).map((t) => `<button class="res" data-act="tool" data-id="${t.id}">${esc(t.label)}</button>`).join('')}
      <button class="res" data-act="tools"><span>All calculators</span><span class="k">›</span></button></div>
    ${recent ? `<h2>Recent jobs</h2><div class="results">${recent}</div>` : ''}
    ${reportsLink()}
    <p class="muted" style="margin-top:28px"><a class="block" href="#/about">About, sources and offline use</a></p>`;
  helper('Pick the equipment — or describe the problem in the box.');
  if (view.q.text) homeSearch();
}

function homeSearch() {
  const text = $('#homeq')?.value || '';
  const box = $('#homeres');
  if (!box) return;
  if (!text.trim()) { box.innerHTML = ''; return; }
  const r0 = search.run(text, null);
  const sys = guessSystem(text, r0);
  const r = sys ? search.run(text, sys) : r0;
  let html = '';
  const hit = matchUnit(text);
  if (hit) html += `<div class="results"><div class="grp">Known unit</div><button class="res" data-act="unit-start" data-id="${esc(hit.unit.id)}" data-text="${esc(hit.rest)}"><b>${esc(hit.unit.name)}</b><span class="k">start ›</span></button></div>`;
  if (sys) {
    html += `<div class="results"><div class="grp">Looks like</div>
      <button class="res" data-act="start-text"><b>${esc(kb.systems.get(sys).name)}</b><span class="k">start ›</span></button></div>`;
    if (r.picks.length) html += `<div class="chips">${r.picks.map((p) => `<span class="chip tent">${esc(p.label)}</span>`).join('')}</div>`;
    const others = r0.systems.filter((s) => s.id !== sys).slice(0, 2);
    if (others.length) html += `<div class="results">${others.map((s) => `<button class="res" data-act="start-text" data-sys="${s.id}">${esc(s.label)}<span class="k">or this</span></button>`).join('')}</div>`;
  } else {
    html += `<p class="muted">Which equipment is it? Pick a tile below and your words come along.</p>`;
  }
  if (r.tools.length) html += `<div class="results"><div class="grp">Calculators</div>${r.tools.map((t) => `<button class="res" data-act="tool" data-id="${t.id}">${esc(t.label)}</button>`).join('')}</div>`;
  box.innerHTML = html;
}

// a system from the words: system names first, then which system the matched findings belong to
function guessSystem(text, r0) {
  if (r0.systems.length && r0.systems[0].score >= 3) return r0.systems[0].id;
  const votes = new Map();
  for (const p of r0.picks) {
    const f = kb.features.get(p.f);
    const tags = (f.systems || []).filter((t) => t !== '*');
    for (const t of tags) {
      const leaves = [...kb.systems.values()].filter((s) => !s.abstract && kb.lineage(s.id).includes(t));
      for (const l of leaves) votes.set(l.id, (votes.get(l.id) || 0) + p.score / leaves.length);
    }
  }
  const best = [...votes].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 4 ? best[0] : null;
}

function startFromText(text, sys) {
  newJob(sys);
  const n = ` ${norm(text)} `;
  for (const c of kb.contextFor(sys)) {
    for (const o of c.options || []) {
      if ((o.words || []).some((w) => n.includes(` ${norm(w)} `))) job.ctx[c.id] = String(o.id);
    }
  }
  for (const p of search.run(text, sys).picks) job.f[p.f] = { s: p.s, src: 'text', t: Date.now() };
  save();
  go('#/diag');
}

// ---------------------------------------------------------------- setup (unit details)
function viewSetup() {
  const sys = kb.systems.get(job.system);
  const qs = kb.contextFor(job.system);
  const rows = qs.map((c) => {
    const cur = job.ctx[c.id];
    let opts;
    if (c.kind === 'refrigerant') {
      const common = COMMON_REFS[job.system] || COMMON_REFS.vc;
      const all = calc.refrigerants();
      const shown = [...new Set([...common, ...(cur && !common.includes(cur) ? [cur] : [])])];
      opts = shown.map((r) => `<button class="opt ${cur === r ? 'on' : ''}" data-act="ctx" data-k="refrigerant" data-v="${esc(r)}">${esc(r)}</button>`).join('')
        + `<select class="opt" data-ctxsel="refrigerant" aria-label="Other refrigerant"><option value="">Other…</option>${all.map((r) => `<option ${cur === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>`;
    } else {
      opts = (c.options || []).filter((o) => !o.systems || kb.inSystem(o, job.system)).map((o) => {
        const id = String(o.id ?? o), label = o.label ?? o;
        return `<button class="opt ${cur === id ? 'on' : ''}" data-act="ctx" data-k="${esc(c.id)}" data-v="${esc(id)}">${esc(label)}</button>`;
      }).join('');
    }
    opts += `<button class="opt dk ${cur == null ? 'on' : ''}" data-act="ctx" data-k="${esc(c.id)}" data-v="">Don't know</button>`;
    return `<div class="qrow"><div class="ql">${esc(c.ask)}</div>${c.hint ? `<div class="qh">${esc(c.hint)}</div>` : ''}<div class="opts">${opts}</div></div>`;
  }).join('');
  const named = unitOf(job.unit);
  const same = knownUnits().filter((u) => u.system === job.system && u.id !== job.unit);
  const nameRow = `<div class="qrow"><div class="ql">Name this unit (optional)</div>
    <div class="qh">e.g. galley walk-in, dorm 155 boiler. A named unit stays on the home screen with these details filled in.</div>
    <div class="opts"><input id="unitname" type="text" autocomplete="off" enterkeyhint="done" maxlength="60" placeholder="Unit name" value="${esc(named?.name || '')}"
      style="flex:1;min-width:180px;height:48px;border-radius:12px;border:2px solid var(--line);background:var(--panel);padding:0 12px;font-size:17px">
      <button class="opt" data-act="unit-name">${named ? 'Rename' : 'Save name'}</button></div>
    ${same.length ? `<div class="opts" style="margin-top:8px"><span class="muted" style="align-self:center">Or it's one you've named:</span>${same.map((u) => `<button class="opt" data-act="unit-link" data-id="${esc(u.id)}">${esc(u.name)}</button>`).join('')}</div>` : ''}</div>`;
  $('#main').innerHTML = `
    <h1>${esc(named?.name || sys.name)}</h1>
    ${named ? `<p class="muted" style="margin:-4px 0 8px">${esc(sys.name)}</p>` : ''}
    ${nameRow}
    <p class="lead">${qs.length ? 'A few facts about this unit. Skip anything you don\'t know — you can come back here any time from the top bar.' : 'Nothing to set up for this one.'}</p>
    ${rows}
    <div style="margin-top:20px"><button class="cta" data-act="go" data-href="#/diag">Start diagnosing ›</button></div>
    <div style="margin-top:10px"><button class="cta ghost" data-act="home">Different equipment</button></div>`;
  helper('Answer what you know, then tap Start. "Don\'t know" is fine.');
}

const COMMON_REFS = {
  'vc.ac': ['R-410A', 'R-454B', 'R-32', 'R-22', 'R-407C'],
  'vc.hp': ['R-410A', 'R-454B', 'R-32', 'R-22', 'R-407C'],
  'vc.walkin': ['R-404A', 'R-448A', 'R-449A', 'R-507A', 'R-407A', 'R-134a', 'R-22'],
  'vc.reachin': ['R-134a', 'R-290', 'R-404A', 'R-600a', 'R-513A', 'R-448A'],
  'vc.ice': ['R-404A', 'R-290', 'R-134a', 'R-448A'],
  vc: ['R-410A', 'R-404A', 'R-134a', 'R-22'],
};

// ---------------------------------------------------------------- diagnose
function viewDiag() {
  const { m, findings, res } = evaluate();
  lastRes = res;
  const sysId = job.system;
  const ctxLine = contextLine();
  // findings chips: the tech's own, then measured ones not overridden
  const own = Object.entries(job.f).map(([fid, r]) => `<button class="chip" data-act="chip" data-f="${esc(fid)}">${esc(kb.label(fid, r.s, sysId))}<span class="x">✎</span></button>`);
  const meas = Object.entries(m.findings).filter(([fid]) => !job.f[fid])
    .map(([fid, r]) => `<button class="chip meas" data-act="go" data-href="#/readings">${esc(kb.label(fid, r.s, sysId))}</button>`);
  const chips = [...own, ...meas];
  $('#main').innerHTML = `
    <button class="res" data-act="setup" style="margin-bottom:10px"><span>${unitOf(job.unit) ? `<b>${esc(unitOf(job.unit).name)}</b>${ctxLine ? ` · ${ctxLine}` : ''}` : ctxLine || 'Unit details: tap to add refrigerant, metering… or name it'}</span><span class="k">edit</span></button>
    <div class="search"><input id="diagq" type="search" autocomplete="off" enterkeyhint="done" placeholder="Add a symptom or reading — e.g. coil iced, fan not running"></div>
    <div id="diagres"></div>
    ${chips.length ? `<div class="chips">${chips.join('')}</div>` : '<p class="muted">Nothing entered yet. Type what you see, or answer the check below.</p>'}
    <div id="nextcard">${nextCard(res, m)}</div>
    <h2>Likely causes</h2>
    ${fitNote(res, m)}
    <div class="causes">${res.post.slice(0, 6).map((r, i) => causeRow(r, i === 0, i === 0 && poorFit(res))).join('')}</div>
    <h2>Readings</h2>
    <button class="res" data-act="go" data-href="#/readings"><span>${vitalsSummary(m)}</span><span class="k">enter ›</span></button>
    <h2>Notes</h2>
    <div class="field"><textarea id="jobnotes" rows="3" placeholder="Model, serial, location, what you did…" style="border-radius:12px;border:2px solid var(--line);background:var(--panel);padding:10px 12px;font-size:17px;width:100%">${esc(job.notes || '')}</textarea></div>
    <div style="margin-top:24px;display:grid;gap:10px">
      <button class="cta ghost" data-act="copy">Copy job summary</button>
      ${job.skip.length ? `<button class="cta ghost" data-act="unskip">Bring back ${job.skip.length} skipped check${job.skip.length > 1 ? 's' : ''}</button>` : ''}
      <button class="cta ghost" data-act="finish">Finish — save or delete this job</button>
    </div>`;
  const top = res.post[0];
  const n = currentCheck(res);
  if (poorFit(res)) helper('No one cause explains everything entered. Recheck the odd findings, or look for a second fault.');
  else if (top && top.p >= 0.75 && top.id !== '_ok') helper(`Likely: ${top.cause.name}. Confirm it, then fix.`);
  else if (n) helper(`Next: ${shortAsk(n.feature)}`);
  else helper('Add what you see, or enter readings.');
}

function contextLine() {
  const parts = [];
  for (const c of kb.contextFor(job.system)) {
    const v = job.ctx[c.id];
    if (v == null) continue;
    if (c.kind === 'refrigerant') { parts.push(v); continue; }
    const o = (c.options || []).find((x) => String(x.id ?? x) === v);
    parts.push((o?.label ?? v).replace(/\s*\(.*\)$/, ''));
  }
  return esc(parts.join(' · '));
}

function shortAsk(f) {
  return kb.ask(f, job.system).replace(/\?$/, '');
}

function currentCheck(res) {
  if (focusCheck) {
    const hit = res.next.find((n) => n.id === focusCheck);
    if (hit) return hit;
  }
  return res.next[0];
}

function measureFor(fid) {
  return kb.measures.find((m) => m.sets === fid && kb.inSystem(m, job.system) && kb.requireFactor(m, job.ctx) > 0);
}

function nextCard(res, m) {
  const n = currentCheck(res);
  if (!n) return `<div class="next"><div class="tag">Next check</div><div class="q">No check left that would change the picture.</div><p class="how">Confirm the leading cause with its own test, or add anything else you've noticed.</p></div>`;
  const f = n.feature;
  const sys = job.system;
  const btns = f.stateIds.map((s) => `<button class="ans" data-act="answer" data-f="${esc(f.id)}" data-s="${esc(s)}">${esc(kb.fill(String(f.states[s]), sys))}</button>`).join('');
  const meas = measureFor(f.id);
  const nums = meas ? `<button class="ans nums" data-act="go" data-href="#/readings?f=${encodeURIComponent(f.id)}">Enter the numbers instead ›</button>` : '';
  // what each answer would point to
  const seen = new Set();
  const why = n.outcomes.filter((o) => o.p >= 0.06).sort((a, b) => b.p - a.p).map((o) => {
    const c = res.model.causes.find((x) => x.id === o.top);
    const key = `${o.top}`;
    if (seen.has(key) && n.outcomes.length > 2) return '';
    seen.add(key);
    return `<li>${esc(kb.fill(String(f.states[o.state]), sys))} → ${esc(c.c.name)} <span class="muted">(${pct(o.topP)}%)</span></li>`;
  }).join('');
  const alts = res.next.filter((x) => x.id !== n.id).slice(0, 4)
    .map((x) => `<button class="chip" data-act="focus" data-f="${esc(x.id)}">${esc(kb.fill(x.feature.name, sys))}</button>`).join('');
  return `<div class="next">
    <div class="tag">Next check</div>
    <div class="q">${esc(kb.ask(f, sys))}</div>
    ${f.caution ? `<div class="safety"><b>Before you do this:</b> ${esc(kb.fill(f.caution, sys))}</div>` : ''}
    ${f.how ? `<p class="how">${esc(kb.fill(f.how, sys))}</p>` : ''}
    <div class="answers">${btns}${nums}<button class="ans skip" data-act="skip" data-f="${esc(f.id)}">Can't check this now</button></div>
    ${why ? `<ul class="why">${why}</ul>` : ''}
    ${alts ? `<div class="alts"><span class="muted" style="font-size:14px;align-self:center">Or check:</span>${alts}</div>` : ''}
  </div>`;
}

// The percentages always add up to 100, so a cause can lead strongly on findings it doesn't explain
// (contradictory readings, or two faults at once). Then it isn't called a strong lead.
const poorFit = (res) => Boolean(res.fit && !res.fit.ok && res.post[0] && res.post[0].id !== '_ok');

function causeRow(r, lead, poor = false) {
  const label = poor ? 'Leads, but doesn\'t explain everything' : r.p >= 0.6 ? 'Strong lead' : r.p >= 0.3 ? 'Contender' : r.p >= 0.1 ? 'Possible' : 'Long shot';
  return `<button class="cause ${lead ? 'lead' : ''}" data-act="cause" data-id="${esc(r.id)}">
    <span class="n">${esc(r.cause.name)}</span><span class="p">${pct(r.p)}%</span>
    <span class="bar"><i style="width:${Math.max(2, Math.round(r.p * 100))}%"></i></span>
    <span class="lbl">${label}</span></button>`;
}

function fitNote(res, m) {
  let html = '';
  if (m?.sanity?.length) {
    html += m.sanity.map((w) => `<div class="safety"><b>${esc(w.title || 'Thermodynamic sanity check.')}</b> ${esc(w.msg || w)}</div>`).join('');
  }
  if (poorFit(res)) {
    const misses = res.fit.misses.slice(0, 3).map((x) => esc(x.label)).join(', ');
    html += `<div class="warnbox">The leading cause doesn't explain everything (${misses}). There may be two faults, or a reading is off — recheck it.</div>`;
  }
  return html;
}

function vitalsSummary(m) {
  const shown = m.results.filter((r) => r.state && r.sets);
  if (!shown.length) return Object.keys(job.inputs).length ? 'Readings entered — add more to compute results' : 'Gauges, probes, meter — enter numbers';
  return shown.slice(0, 4).map((r) => `${esc(r.measure.name)} ${fmt(r.v)}${r.measure.unit === '%' ? '%' : ''} ${badge(r.state)}`).join(' · ');
}

function badge(state) {
  const sym = { low: '▼', high: '▲', normal: '●', ok: '●', matches: '●' }[state] || '◆';
  return `<span class="badge">${sym}</span>`;
}

// ---------------------------------------------------------------- readings
function viewReadings() {
  const sys = job.system;
  const focusF = view.q.f || null;
  // every measure that can set this finding, and the inputs they read (directly or through
  // another measure, e.g. superheat reads the evaporator saturation measure)
  const focusIds = new Set(focusF ? focusInputs(focusF) : []);
  const inputs = [...kb.inputs.values()].filter((i) => kb.inSystem(i, sys) && kb.requireFactor(i, job.ctx) > 0);
  inputs.sort((a, b) => (focusIds.has(b.id) ? 1 : 0) - (focusIds.has(a.id) ? 1 : 0));
  const needsRef = kb.contextFor(sys).some((c) => c.kind === 'refrigerant');
  const fields = inputs.map((i) => {
    const v = job.inputs[i.id] ?? '';
    const ph = i.default !== undefined ? `${i.default}` : '';
    // fixed nameplate values (voltage, relief setting, phases…) are a pick-list, not typing
    const control = Array.isArray(i.choices) && i.choices.length
      ? `<select id="in-${esc(i.id)}" data-in="${esc(i.id)}"><option value="">${ph ? `${esc(ph)} (default)` : '—'}</option>${i.choices.map((c) => {
        const val = typeof c === 'object' ? c.value ?? c.id : c;
        const lab = typeof c === 'object' ? c.label ?? val : c;
        return `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(lab)}</option>`;
      }).join('')}</select>`
      : numBox(`<input id="in-${esc(i.id)}" data-in="${esc(i.id)}" type="text" inputmode="decimal" autocomplete="off" value="${esc(v)}" placeholder="${esc(ph)}">`, i.unit);
    return `<div class="field ${focusIds.has(i.id) ? 'focus' : ''}"><label for="in-${esc(i.id)}">${esc(i.name)} <span class="unit">${esc(i.unit || '')}</span></label>
      ${control}
      <span class="hint readnote" aria-live="polite">${esc(calc.readValue(v, i.unit).note || '')}</span>
      ${i.hint ? `<span class="hint">${esc(i.hint)}</span>` : ''}</div>`;
  }).join('');
  $('#main').innerHTML = `
    <h1>Readings</h1>
    ${needsRef ? refPicker() : ''}
    <div id="vitals">${vitalsHtml()}</div>
    <h2>Enter what you've measured</h2>
    <div class="fields">${fields}</div>
    <div style="margin-top:20px;display:grid;gap:10px">
      <button class="cta" data-act="go" data-href="#/diag">Done — back to the diagnosis</button>
      <button class="cta ghost" data-act="clear-readings">Clear all readings</button>
    </div>`;
  helper('Enter what you have — results update as you type. Blank boxes are fine.');
  if (focusIds.size) setTimeout(() => $(`#in-${CSS.escape([...focusIds][0])}`)?.focus(), 50);
}

// every input a finding's measures read, directly or through another measure (superheat reads the evaporator
// saturation measure, which reads suction pressure)
function focusInputs(fid) {
  const ids = [];
  const add = (id) => { if (!ids.includes(id)) ids.push(id); };
  for (const fm of kb.measures.filter((m) => m.sets === fid && kb.inSystem(m, job.system) && kb.requireFactor(m, job.ctx) > 0)) {
    const src = [fm.value, fm.target, ...Object.values(fm.let || {})].join(' ');
    for (const mm of kb.measures) if (src.includes(mm.id)) for (const inp of kb.inputs.values()) if (String(mm.value).includes(inp.id)) add(inp.id);
    for (const inp of kb.inputs.values()) if (src.includes(inp.id)) add(inp.id);
  }
  return ids;
}

function refPicker() {
  const cur = job.ctx.refrigerant;
  const loc = job.ctx.sh_location;
  return `<div class="qrow"><div class="ql">Refrigerant</div><div class="opts">
    <select class="opt" data-ctxsel="refrigerant" aria-label="Refrigerant" style="min-width:160px"><option value="">Pick one…</option>${calc.refrigerants().map((r) => `<option ${cur === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
    <span class="seg"><button class="${loc === 'evap' ? 'on' : ''}" data-act="ctx" data-k="sh_location" data-v="evap">Suction temp at evaporator</button><button class="${loc === 'comp' ? 'on' : ''}" data-act="ctx" data-k="sh_location" data-v="comp">at condensing unit</button></span>
  </div></div>`;
}

function vitalsHtml() {
  const m = computeMeasures(kb, job.system, job.ctx, job.inputs);
  // one tile per feature (the measure that actually set it) plus the display-only values
  const rows = m.results.filter((r) => Number.isFinite(r.v) && !r.measure.hidden
    && (!r.sets || !m.findings[r.sets] || m.findings[r.sets].from === r.id));
  const missingRef = !job.ctx.refrigerant && kb.contextFor(job.system).some((c) => c.kind === 'refrigerant')
    && Object.keys(job.inputs).some((k) => /psig/.test(k));
  let html = missingRef ? '<div class="warnbox">Pick the refrigerant to turn pressures into temperatures.</div>' : '';
  if (m.sanity?.length) {
    html += m.sanity.map((w) => `<div class="safety"><b>${esc(w.title || 'Thermodynamic sanity check.')}</b> ${esc(w.msg || w)}</div>`).join('');
  }
  if (!rows.length) return html + '<p class="muted">Results show up here as you enter numbers.</p>';
  html += `<div class="vitals">${rows.map((r) => {
    const unit = r.measure.unit || '';
    const t = r.t != null && Number.isFinite(r.t) ? `target ${fmt(r.t)}${unit === '%' ? '%' : ''}` : '';
    const st = r.state ? `<span class="badge">${badge(r.state)} ${esc(r.state)}</span>` : '';
    return `<div class="vital ${esc(r.state || '')}"><div class="l">${esc(r.measure.name)}</div><div class="v">${fmt(r.v)}<span class="muted" style="font-size:14px"> ${esc(unit)}</span></div><div class="t">${t} ${st}</div></div>`;
  }).join('')}</div>`;
  return html;
}

// ---------------------------------------------------------------- cause detail
function viewCause() {
  const { findings, res } = evaluate();
  const id = view.arg;
  const row = res.post.find((r) => r.id === id);
  const c = row?.cause || kb.cause.get(id);
  if (!c) { go('#/diag'); return; }
  const ex = explain(res.model, findings, id);
  const sys = job.system;
  const li = (rows, cls, fn) => rows.map((r) => `<li class="${cls}">${esc(r.label)} <span class="muted">${fn(r)}</span></li>`).join('');
  const ev = li(ex.support, 'y', (r) => `— expected here ${pct(r.p)}%, usually ${pct(r.base)}%`)
    + li(ex.against, 'n', (r) => `— this cause gives it only ${pct(r.p)}%`)
    + li(ex.silent, 'q', () => '— this cause doesn\'t explain it');
  const refs = (c.refs || []).map((r) => kb.refs.get(r)).filter(Boolean)
    .map((r) => (r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title))).join(' · ');
  // the check that best separates this cause from the strongest other one
  const rival = res.post.find((r) => r.id !== id);
  $('#main').innerHTML = `
    <p class="muted" style="margin:6px 0 0">${row ? `${pct(row.p)}% · ${row === res.post[0] && poorFit(res) ? 'Leads, but doesn\'t explain everything' : row.p >= 0.6 ? 'Strong lead' : row.p >= 0.3 ? 'Contender' : row.p >= 0.1 ? 'Possible' : 'Long shot'}` : ''}</p>
    <h1>${esc(c.name)}</h1>
    ${ev ? `<h2>Why</h2><ul class="ev">${ev}</ul>` : ''}
    ${c.confirm ? `<h2>Confirm it</h2><div class="prose"><p>${esc(kb.fill(c.confirm, sys))}</p></div>` : ''}
    ${c.safety ? `<div class="safety"><b>Safety.</b> ${esc(c.safety)}</div>` : ''}
    <h2>Fix</h2><div class="prose">${paras(kb.fill(c.fix, sys))}</div>
    ${c.notes ? `<h2>Notes</h2><div class="prose">${paras(c.notes)}</div>` : ''}
    ${rival && rival.id !== '_ok' ? `<p class="muted">Closest other cause: <a href="#/cause/${encodeURIComponent(rival.id)}">${esc(rival.cause.name)}</a> (${pct(rival.p)}%).</p>` : ''}
    ${refs ? `<p class="refs">Sources: ${refs}</p>` : ''}
    <div style="margin-top:20px"><button class="cta" data-act="go" data-href="#/diag">Back to the diagnosis</button></div>`;
  helper(c.confirm ? 'Confirm it before you replace anything.' : 'Back to the diagnosis when you\'re ready.');
}

function paras(text) {
  return String(text || '').trim().split(/\n\s*\n|\n(?=[-•])/).map((p) => `<p>${esc(p.trim())}</p>`).join('');
}

// ---------------------------------------------------------------- tools and about
function viewTools() {
  $('#main').innerHTML = `<h1>Calculators</h1><div class="results">${TOOL_LIST.map((t) => `<button class="res" data-act="tool" data-id="${t.id}">${esc(t.label)}<span class="k">›</span></button>`).join('')}</div>`;
  helper('Pick a calculator. They all work offline.');
}

function viewTool() {
  const t = TOOL_LIST.find((x) => x.id === view.arg);
  if (!t) { go('#/tools'); return; }
  $('#main').innerHTML = renderTool(t.id, { ctx: job?.ctx || {}, refrigerants: calc.refrigerants() });
  updateTool(t.id);
  helper(t.help || 'Type a number — the answer updates as you go.');
}

function viewAbout() {
  const meta = kb.raw.meta || {};
  const refs = [...kb.refs.values()].map((r) => `<li>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title)} <span class="muted">— ${esc(r.rights || '')}</span></li>`).join('');
  $('#main').innerHTML = `
    <h1>About Field Dx</h1>
    <div class="prose">
      <p>Type what you see; the app ranks the likely causes and tells you the single check that would narrow it down fastest for the least effort. Numbers from gauges and probes turn into findings (superheat high, head pressure normal…) automatically.</p>
      <p>Everything runs on this device. No account, no connection needed once it's installed.</p>
      <h2>Put it on the iPhone home screen</h2>
      <p>Open this page in Safari once while you have internet, tap Share → Add to Home Screen. After that it opens and works offline.</p>
      <h2>How sure is it?</h2>
      <p>The percentages are the app's best guess from what's been entered, not a guarantee. The equipment's own documentation (charging charts, wiring diagrams, manufacturer specs) always wins. Confirm a cause with its own test before replacing parts.</p>
      <h2>Voice (being built)</h2>
      <p>Hands-free use is in testing. <a href="voice/lab.html">Run the voice test</a> — it downloads a 47 MB offline voice pack the first time.</p>
      <h2>Knowledge base</h2>
      <p>${meta.counts ? `${meta.counts.causes} causes · ${meta.counts.features} checks · ${meta.counts.measures} calculations` : ''}${meta.built ? ` · built ${esc(meta.built)}` : ''}</p>
      <ul class="ev">${refs}</ul>
    </div>`;
  helper('Back to work: tap Field Dx at the top.');
}

// ---------------------------------------------------------------- named units
// Optional. A unit the tech names ("galley walk-in") remembers its equipment type and facts; it's listed on the
// home screen, and its saved reports collect on its page.
const units = () => store.get(KEY_UNITS, []);
const unitOf = (id) => (id ? units().find((u) => u.id === id) : null);
const knownUnits = () => units().filter((u) => kb.systems.has(u.system)).sort((a, b) => (b.last || 0) - (a.last || 0));
const cleanName = (name) => String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);

function touchUnit(id) {
  const list = units(), u = list.find((x) => x.id === id);
  if (u) { u.last = Date.now(); store.set(KEY_UNITS, list); }
}

// name the job's unit: an existing name for this equipment type links to that unit, otherwise it's a new unit
// (or, when the job already has one, a rename)
function nameUnit(raw, rename = true) {
  const name = cleanName(raw);
  if (!job) return null;
  if (!name) { delete job.unit; save(); return null; }
  const list = units();
  let u = list.find((x) => x.system === job.system && norm(x.name) === norm(name));
  if (u) return linkUnit(u.id);
  const cur = rename && job.unit && list.find((x) => x.id === job.unit);
  if (cur) cur.name = name;
  else { u = { id: `u${Date.now().toString(36)}`, name, system: job.system, ctx: { ...job.ctx }, created: Date.now(), last: Date.now() }; list.unshift(u); job.unit = u.id; }
  store.set(KEY_UNITS, list);
  save();
  return cur || u;
}

// this job is on a unit named before: its facts fill in
function linkUnit(id) {
  const u = unitOf(id);
  if (!u || !job || u.system !== job.system) return null;
  job.unit = u.id;
  job.ctx = { ...job.ctx, ...u.ctx };
  touchUnit(u.id);
  save();
  return u;
}

function startUnit(id, text = '') {
  const u = unitOf(id);
  if (!u || !kb.systems.has(u.system)) return;
  newJob(u.system);
  job.unit = u.id;
  job.ctx = { ...job.ctx, ...u.ctx };
  if (text.trim()) for (const p of search.run(text, u.system).picks) job.f[p.f] = { s: p.s, src: 'text', t: Date.now() };
  touchUnit(u.id);
  save();
  go('#/diag');
}

// a known unit named in typed or spoken text ("galley walk-in is warm", "dorm one fifty five boiler"): the longest
// name wins, and the rest of the words are the complaint
function matchUnit(text) {
  const forms = [norm(text), norm(numberWordsToDigits(text))];
  let best = null;
  for (const u of knownUnits()) {
    const n = norm(u.name);
    if (!n) continue;
    for (const f of forms) {
      if (` ${f} `.includes(` ${n} `) && (!best || n.length > norm(best.unit.name).length)) best = { unit: u, rest: ` ${f} `.replace(` ${n} `, ' ').trim() };
    }
  }
  return best;
}

function renameUnit(id, raw) {
  const name = cleanName(raw);
  const list = units(), u = list.find((x) => x.id === id);
  if (!u || !name) return;
  if (list.some((x) => x.id !== id && x.system === u.system && norm(x.name) === norm(name))) { toast('Another unit of this type already has that name.'); return; }
  u.name = name;
  store.set(KEY_UNITS, list);
  toast('Renamed.');
  render();
}

function forgetUnit(id, sure) {
  if (!sure) {
    $('#sheet').innerHTML = `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" role="dialog" aria-label="Forget unit">
      <div class="q">Forget this unit? Its saved reports stay.</div>
      <div class="answers"><button class="ans" data-act="unit-forget" data-id="${esc(id)}" data-sure="1" style="border-color:var(--high)">Forget it</button>
      <button class="ans skip" data-act="sheet-close">Keep it</button></div></div></div>`;
    return;
  }
  store.set(KEY_UNITS, units().filter((u) => u.id !== id));
  if (job?.unit === id) { delete job.unit; save(); }
  closeSheet();
  go('#/units');
}

function viewUnits() {
  const list = knownUnits();
  const u = view.arg && list.find((x) => x.id === view.arg);
  const reps = reports();
  if (u) {
    const sys = kb.systems.get(u.system);
    const facts = kb.contextFor(u.system).filter((c) => u.ctx[c.id] != null).map((c) => {
      const o = (c.options || []).find((x) => String(x.id ?? x) === u.ctx[c.id]);
      return `<li>${esc(c.ask)} <b>${esc(o?.label ?? u.ctx[c.id])}</b></li>`;
    }).join('');
    const mine = reps.filter((r) => r.unit === u.id);
    $('#main').innerHTML = `
      <h1>${esc(u.name)}</h1>
      <p class="lead">${esc(sys.name)}</p>
      <button class="cta" data-act="unit-start" data-id="${esc(u.id)}">Start a job on this unit</button>
      ${facts ? `<h2>What's known about it</h2><ul class="ev">${facts}</ul>` : '<p class="muted">No details saved yet. They fill in as you answer the unit questions on a job.</p>'}
      <h2>Saved reports</h2>
      ${mine.length ? `<div class="results">${mine.map((r) => `<button class="res" data-act="go" data-href="#/reports/${encodeURIComponent(r.id)}"><span>${esc(r.title.replace(`${u.name} — `, ''))}</span><span class="k">${new Date(r.when).toLocaleDateString()}</span></button>`).join('')}</div>` : '<p class="muted">None yet.</p>'}
      <h2>Rename</h2>
      <div class="opts"><input id="unitrename" type="text" autocomplete="off" maxlength="60" value="${esc(u.name)}"
        style="flex:1;min-width:180px;height:48px;border-radius:12px;border:2px solid var(--line);background:var(--panel);padding:0 12px;font-size:17px">
        <button class="opt" data-act="unit-rename" data-id="${esc(u.id)}">Rename</button></div>
      <div style="margin-top:24px;display:grid;gap:10px">
        <button class="cta ghost" data-act="unit-forget" data-id="${esc(u.id)}">Forget this unit</button>
        <button class="cta ghost" data-act="go" data-href="#/units">All units</button>
      </div>`;
    helper(mine.length ? `${mine.length} saved report${mine.length > 1 ? 's' : ''} on this unit.` : 'Start a job, or rename it.');
    return;
  }
  const rows = list.map((x) => {
    const n = reps.filter((r) => r.unit === x.id).length;
    return `<button class="res" data-act="go" data-href="#/units/${encodeURIComponent(x.id)}"><span><b>${esc(x.name)}</b> <span class="muted">${esc(kb.systems.get(x.system).short || kb.systems.get(x.system).name)}</span></span><span class="k">${n ? `${n} report${n > 1 ? 's' : ''}` : ''}${x.last ? ` · ${new Date(x.last).toLocaleDateString()}` : ''}</span></button>`;
  }).join('');
  $('#main').innerHTML = `
    <h1>Your units</h1>
    <p class="lead">Name a unit on its details screen during a job ("galley walk-in"). It keeps its equipment type and details, and its saved reports collect here.</p>
    ${rows ? `<div class="results">${rows}</div>` : '<p class="muted">No named units yet.</p>'}`;
  helper(list.length ? 'Tap a unit for its history.' : 'Name a unit during a job: tap the unit details line.');
}

// ---------------------------------------------------------------- saved reports
// A finished job is saved as a plain-text report on the phone (no connection needed). Backing up sends the new ones
// as one text file through the share sheet: Save to Files, or the Drive app when there's signal.
const reports = () => store.get(KEY_REPORTS, []);

function jobReport() {
  const { m, res } = evaluate();
  const sys = kb.systems.get(job.system);
  const when = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const SRC = { answer: 'answered', text: 'typed', edit: 'changed', voice: 'said' };
  const named = unitOf(job.unit);
  const lines = [`FIELD DX JOB REPORT`, named ? `${named.name} (${sys.name})` : `${sys.name}`, `Started ${when(job.t0)} · finished ${when(Date.now())}`];
  const unit = kb.contextFor(job.system).filter((c) => job.ctx[c.id] != null).map((c) => {
    const v = job.ctx[c.id];
    const o = (c.options || []).find((x) => String(x.id ?? x) === v);
    return `- ${c.ask} ${o?.label ?? v}`;
  });
  if (unit.length) lines.push('', 'Unit:', ...unit);
  const own = Object.entries(job.f).sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
  if (own.length) lines.push('', 'Found (in order):', ...own.map(([fid, r]) => `- ${r.t ? `${clock(r.t)} ` : ''}${kb.label(fid, r.s, job.system)} [${SRC[r.src] || r.src}]`));
  const meas = Object.entries(m.findings).filter(([fid]) => !job.f[fid]);
  if (meas.length) lines.push('', 'From the readings:', ...meas.map(([fid, r]) => `- ${kb.label(fid, r.s, job.system)}`));
  const vals = m.results.filter((r) => Number.isFinite(r.v) && !r.measure.hidden && (!r.sets || m.findings[r.sets]?.from === r.id));
  if (vals.length) lines.push('', 'Readings:', ...vals.map((r) => `- ${r.measure.name}: ${fmt(r.v)} ${r.measure.unit || ''}${r.t != null && Number.isFinite(r.t) ? ` (target ${fmt(r.t)})` : ''}${r.state ? ` — ${r.state}` : ''}`));
  const raw = Object.entries(job.inputs).map(([id, v]) => `${kb.inputs.get(id)?.name || id}: ${v} ${kb.inputs.get(id)?.unit || ''}`.trim());
  if (raw.length) lines.push('', 'Entered:', ...raw.map((x) => `- ${x}`));
  lines.push('', 'Likely causes:', ...res.post.slice(0, 3).map((r) => `- ${r.cause.name} (${pct(r.p)}%)`));
  if (job.skip.length) lines.push('', `Checks skipped: ${job.skip.map((fid) => kb.features.get(fid)?.name || fid).join('; ')}`);
  if (job.notes) lines.push('', 'Notes:', job.notes);
  lines.push('', `Field Dx · knowledge base ${kb.raw.meta?.built || ''}`.trim());
  return { text: lines.join('\n'), title: `${named?.name || sys.short || sys.name}${res.post[0] ? ` — ${res.post[0].cause.name}` : ''}` };
}

function saveReport() {
  const { text, title } = jobReport();
  const list = reports();
  list.unshift({ id: job.id, when: Date.now(), title, text, backedUp: false, unit: job.unit || null });
  store.set(KEY_REPORTS, list);
  navigator.storage?.persist?.().catch(() => {}); // ask the phone to keep the app's storage
  const fresh = list.filter((r) => !r.backedUp).length;
  toast(`Report saved on this phone. ${fresh} not backed up yet.`);
}

function finishSheet(confirmDelete = false) {
  $('#sheet').innerHTML = `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" role="dialog" aria-label="Finish this job">
    ${confirmDelete
    ? `<div class="q">Delete this job? Nothing is saved.</div>
      <div class="answers"><button class="ans" data-act="finish-delete-yes" style="border-color:var(--high)">Delete it</button>
      <button class="ans skip" data-act="sheet-close">Keep it</button></div>`
    : `<div class="q">Finish this job</div>
      <label class="muted" for="saveas" style="display:block;margin:-4px 0 6px">Save as (optional): a unit or job name, e.g. galley walk-in</label>
      <input id="saveas" type="text" autocomplete="off" maxlength="60" value="${esc(unitOf(job?.unit)?.name || '')}" placeholder="Name"
        style="width:100%;height:52px;border-radius:12px;border:2px solid var(--line);background:var(--panel2);padding:0 12px;font-size:18px;margin-bottom:10px">
      <div class="answers"><button class="ans" data-act="finish-save">Save the report</button>
      <button class="ans" data-act="finish-delete">Delete it</button>
      <button class="ans skip" data-act="sheet-close">Keep working</button></div>`}
  </div></div>`;
}

const fileStamp = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; }; // local time, like the report
const slug = (s) => norm(s).replace(/\s+/g, '-').slice(0, 40).replace(/-[^-]*$/, '');

// ids: one report, or null for every report not backed up yet (all of them if none are new)
async function shareReports(ids) {
  const list = reports();
  let pick = ids ? list.filter((r) => ids.includes(r.id)) : list.filter((r) => !r.backedUp);
  if (!pick.length) pick = list;
  if (!pick.length) return;
  const name = pick.length === 1 ? `fielddx-${fileStamp(pick[0].when)}-${slug(pick[0].title)}.txt` : `fielddx-backup-${fileStamp(Date.now())}-${pick.length}-reports.txt`;
  const body = pick.map((r) => r.text).join('\n\n' + '='.repeat(40) + '\n\n');
  const file = new File([body], name, { type: 'text/plain' });
  let ok = false;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); ok = true; }
    catch (err) { if (err.name !== 'AbortError') toast(`Couldn't share: ${err.message}`); }
  } else {
    // no share sheet (laptop browsers): download the file instead
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    ok = true;
  }
  if (!ok) return;
  const done = new Set(pick.map((r) => r.id));
  store.set(KEY_REPORTS, reports().map((r) => (done.has(r.id) ? { ...r, backedUp: true } : r)));
  toast(pick.length === 1 ? 'Report sent.' : `${pick.length} reports sent.`);
  if (view.name === 'reports') render();
}

function deleteReport(id, sure) {
  if (!sure) {
    $('#sheet').innerHTML = `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" role="dialog" aria-label="Delete report">
      <div class="q">Delete this saved report?</div>
      <div class="answers"><button class="ans" data-act="report-delete" data-id="${esc(id)}" data-sure="1" style="border-color:var(--high)">Delete it</button>
      <button class="ans skip" data-act="sheet-close">Keep it</button></div></div></div>`;
    return;
  }
  store.set(KEY_REPORTS, reports().filter((r) => r.id !== id));
  closeSheet();
  go('#/reports');
}

function reportsLink() {
  const list = reports();
  if (!list.length) return '';
  const fresh = list.filter((r) => !r.backedUp).length;
  return `<h2>Saved reports</h2><div class="results"><button class="res" data-act="go" data-href="#/reports"><span>${list.length} on this phone${fresh ? ` · <b>${fresh} not backed up</b>` : ' · all backed up'}</span><span class="k">open ›</span></button></div>`;
}

function viewReports() {
  const list = reports();
  const one = view.arg && list.find((r) => r.id === view.arg);
  if (one) {
    $('#main').innerHTML = `
      <h1>${esc(one.title)}</h1>
      <p class="lead">${new Date(one.when).toLocaleString()}${one.backedUp ? ' · backed up' : ' · not backed up yet'}</p>
      <pre class="out" style="white-space:pre-wrap;font:15px/1.45 var(--mono)">${esc(one.text)}</pre>
      <div style="display:grid;gap:10px">
        <button class="cta" data-act="report-share" data-id="${esc(one.id)}">Share or save to Files</button>
        <button class="cta ghost" data-act="report-delete" data-id="${esc(one.id)}">Delete this report</button>
        <button class="cta ghost" data-act="go" data-href="#/reports">All reports</button>
      </div>`;
    helper('Share sends it as a text file: Save to Files, Drive, mail…');
    return;
  }
  const fresh = list.filter((r) => !r.backedUp).length;
  const rows = list.map((r) => `<button class="res" data-act="go" data-href="#/reports/${encodeURIComponent(r.id)}"><span>${esc(r.title)}</span><span class="k">${new Date(r.when).toLocaleDateString()}${r.backedUp ? ' ✓' : ' · new'}</span></button>`).join('');
  $('#main').innerHTML = `
    <h1>Saved reports</h1>
    <p class="lead">Kept on this phone. When you have signal, back them up: the share sheet sends them as one text file to the Drive app or Save to Files.</p>
    ${list.length ? `<button class="cta" data-act="backup">${fresh ? `Back up ${fresh} new report${fresh > 1 ? 's' : ''}` : `Back up ${list.length > 1 ? `all ${list.length} ` : ''}again`}</button>
    <div class="results" style="margin-top:14px">${rows}</div>` : '<p class="muted">No saved reports yet. Finish a job and choose "Save the report".</p>'}`;
  helper(fresh ? `${fresh} report${fresh > 1 ? 's' : ''} not backed up yet.` : 'Everything here is backed up.');
}

function finishSave(saveAsName = null) {
  if (saveAsName && cleanName(saveAsName) && norm(saveAsName) !== norm(unitOf(job.unit)?.name || '')) nameUnit(saveAsName, false);
  saveReport(); archive(); job = null; store.set(KEY_JOB, null); closeSheet(); go('#/');
}
function finishDelete() { job = null; store.set(KEY_JOB, null); closeSheet(); toast('Job deleted.'); go('#/'); }

// ---------------------------------------------------------------- voice
// Hold the bar, talk, let go. dialog.js says what the words mean; this carries it out on the same screens a tap
// would. Every answer is read back and can be undone; readings and deleting a job are confirmed with a yes.
const vs = { on: false, mode: 'idle', turn: null, spokenFor: null, pending: null, misses: 0, reading: null, picks: null, naming: false, saving: false };

async function voiceToggle() {
  if (vs.on) { voice.say('Voice off.'); setTimeout(() => voice.stop(), 900); vs.on = false; voiceChrome(); return; }
  try {
    await voice.start((msg) => helper(msg));
    vs.on = true; vs.spokenFor = null;
    voiceChrome();
    render();
  } catch (err) {
    toast(`Voice couldn't start: ${err.message || err.name}`);
    helper('Voice is off.');
  }
}

// ?dbg: drive the dialog with typed text, no microphone or voice pack
function voiceDry() { vs.on = true; vs.spokenFor = null; voiceChrome(); render(); }

function voiceChrome() {
  $('#micbtn').classList.toggle('on', vs.on);
  $('#talk').hidden = !vs.on;
  document.body.classList.toggle('voice-on', vs.on);
}

function setupHold() {
  const b = $('#holdbtn');
  let h = null;
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!voice.isOn()) return;
    const names = knownUnits().map((u) => u.name);
    const g = vs.mode === 'free' ? null : grammar(vs.mode === 'idle' || vs.mode === 'pick' ? 'check' : vs.mode, vs.mode === 'pick' ? vs.picks.options : vs.turn?.options || [], names);
    h = voice.press(g, (text) => voiceHeard(text));
    if (h) { b.classList.add('down'); b.textContent = 'Listening… let go when done'; }
  });
  const up = () => { if (!h) return; h.release(); h = null; b.classList.remove('down'); b.textContent = 'Hold to talk'; };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => b.addEventListener(t, up));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}

// after every render: set what the voice listens for, and speak a new check once
function voiceView() {
  if (vs.pending || vs.naming || vs.saving) return;
  vs.turn = null; vs.picks = null;
  if (view.name === 'home') {
    vs.mode = 'free';
    if (vs.spokenFor !== 'home') { vs.spokenFor = 'home'; voice.say("What's wrong? Hold the bar and describe it."); }
    return;
  }
  if (view.name === 'diag' && lastRes) {
    const n = currentCheck(lastRes);
    vs.mode = 'check';
    if (!n) {
      vs.turn = { fid: null, options: [], lines: [] };
      if (vs.spokenFor !== '-') { vs.spokenFor = '-'; voice.say("No check left that would change the picture. Say what's leading, or save report."); }
      return;
    }
    vs.turn = checkTurn(kb, job.system, n.feature);
    if (vs.spokenFor !== n.id) { vs.spokenFor = n.id; voice.say(vs.turn.lines); }
    return;
  }
  if (view.name === 'readings' && vs.reading) { vs.mode = 'number'; return; }
  vs.mode = 'idle';
}

function askPending(prompt, onYes, onNo) {
  vs.pending = { prompt, onYes, onNo, back: vs.mode };
  vs.mode = 'confirm';
  voice.say(prompt);
}

function voiceHeard(text) {
  if (vs.saving && !vs.pending) {
    vs.saving = false;
    const name = cleanName(numberWordsToDigits(String(text || '').replace(/\[unk\]/g, '')));
    if (!name) { voice.say('Not saved.'); render(); return; }
    askSaveAs(name);
    return;
  }
  if (vs.naming && !vs.pending) {
    vs.naming = false;
    const name = cleanName(numberWordsToDigits(String(text || '').replace(/\[unk\]/g, '')));
    if (!name) { voice.say('Not named.'); render(); return; }
    askPending(`Name it ${name}? Yes or no.`, () => { nameUnit(name); voice.say(`Named ${name}.`); render(); }, () => { voice.say('Not named.'); render(); });
    return;
  }
  if (vs.mode === 'free' && !vs.pending) {
    // a command still works on the home screen ("stop listening" isn't a complaint)
    const c = interpret('check', text, { turn: { fid: null, options: [] } });
    if (c.do === 'command') { helper(`Heard: “${text}”`); voiceCommand(c.id); return; }
  }
  const mode = vs.mode === 'idle' ? 'check' : vs.mode === 'pick' ? 'check' : vs.mode;
  const turn = vs.mode === 'pick' ? vs.picks : vs.turn || { fid: null, options: [] };
  const a = interpret(mode, text, { turn, unit: vs.reading?.unit });
  helper(text ? `Heard: “${text.replace(/\[unk\]/g, '…')}”` : 'Heard nothing.');
  if (a.do === 'unclear') {
    vs.misses++;
    if (vs.pending) voice.say(`Say yes or no. ${vs.pending.prompt}`);
    else if (vs.misses >= 2 && turn.lines?.length) voice.say(['Say the number of the answer.', turn.lines[turn.lines.length - 1]]);
    else voice.say('Say again?');
    return;
  }
  vs.misses = 0;
  if (vs.pending) {
    const p = vs.pending;
    if (a.do === 'command' && a.id === 'repeat') { voice.say(p.prompt); return; }
    vs.pending = null; vs.mode = p.back;
    (a.do === 'yes' ? p.onYes : p.onNo)();
    return;
  }
  switch (a.do) {
    case 'text': return voiceComplaint(a.text);
    case 'answer':
      if (vs.mode === 'pick') { focusCheck = a.state; vs.spokenFor = null; render(); return; }
      setFinding(a.fid, a.state, 'voice');
      voice.say(a.readback);
      render();
      return;
    case 'reading': return voiceReading(a.text);
    case 'saveas': return voiceSaveAs(a.name);
    case 'command': return voiceCommand(a.id);
    default:
  }
}

function voiceComplaint(text, skipUnit = false) {
  const box = $('#homeq');
  if (box) { box.value = text; homeSearch(); }
  const hit = !skipUnit && matchUnit(text);
  if (hit) {
    askPending(`${hit.unit.name}. Start a job on it? Yes or no.`, () => startUnit(hit.unit.id, hit.rest), () => voiceComplaint(text, true));
    return;
  }
  const sys = guessSystem(text, search.run(text, null));
  if (!sys) { voice.say("I couldn't tell which equipment. Say it again with the equipment's name, or pick it on the screen."); return; }
  askPending(`Sounds like ${kb.systems.get(sys).name}. Start? Yes or no.`,
    () => startFromText(text, sys),
    () => voice.say('Pick the equipment on the screen, or describe it again.'));
}

function voiceCommand(id) {
  const fid = vs.turn?.fid;
  switch (id) {
    case 'repeat': vs.spokenFor = null; voiceView(); return;
    case 'how': voice.say(vs.turn?.how || 'No how-to for this one.'); return;
    case 'skip':
      if (vs.mode === 'number') { voiceNextInput(); return; }
      if (job && fid && !job.skip.includes(fid)) { job.skip.push(fid); focusCheck = null; save(); voice.say('Skipped.'); render(); }
      return;
    case 'undo': {
      if (!job) return;
      const last = Object.entries(job.f).filter(([, r]) => r.src === 'voice').sort((x, y) => (y[1].t || 0) - (x[1].t || 0))[0];
      if (!last) { voice.say('Nothing to undo.'); return; }
      const label = speakable(kb.label(last[0], last[1].s, job.system));
      delete job.f[last[0]]; save();
      focusCheck = last[0]; vs.spokenFor = null;
      voice.say(`Undone: ${label}.`);
      if (view.name === 'diag') render(); else go('#/diag');
      return;
    }
    case 'leading': {
      if (!job || !lastRes) { voice.say('No job open.'); return; }
      const top = lastRes.post.slice(0, 3);
      const lines = [];
      if (top[0]?.cause.safety) lines.push(`Safety first: ${speakable(top[0].cause.safety)}`);
      lines.push(top.map((r) => `${speakable(r.cause.name.split(' — ')[0])}, ${pct(r.p)} percent.`).join(' '));
      voice.say(lines);
      return;
    }
    case 'numbers': {
      const ids = (fid ? focusInputs(fid) : []).filter((id) => { const i = kb.inputs.get(id); return kb.inSystem(i, job.system) && kb.requireFactor(i, job.ctx) > 0; });
      if (!ids.length) { voice.say('This check has no numbers to enter.'); return; }
      vs.reading = { ids, i: -1, back: fid };
      go(`#/readings?f=${encodeURIComponent(fid)}`);
      voiceNextInput();
      return;
    }
    case 'other': {
      const alts = (lastRes?.next || []).filter((x) => x.id !== fid).slice(0, 3);
      if (!alts.length) { voice.say('No other checks.'); return; }
      vs.picks = { fid: null, options: alts.map((x) => ({ id: x.id, label: x.feature.name, keys: [] })) };
      vs.mode = 'pick';
      voice.say(`Other checks. ${alts.map((x, i) => `${['one', 'two', 'three'][i]}: ${speakable(kb.fill(x.feature.name, job.system))}.`).join(' ')} Say the number.`);
      return;
    }
    case 'stop': voiceToggle(); return;
    case 'name':
      if (!job) { voice.say('No job open.'); return; }
      vs.naming = true; vs.mode = 'free';
      voice.say('Say the name.');
      return;
    case 'save': {
      if (!job) { voice.say('No job open.'); return; }
      const name = unitOf(job.unit)?.name;
      finishSave(); voice.say(name ? `Saved as ${name}.` : 'Report saved on the phone.');
      return;
    }
    case 'delete':
      if (!job) { voice.say('No job open.'); return; }
      askPending('Delete this job? Nothing is saved. Say yes to delete.', () => { finishDelete(); voice.say('Deleted.'); }, () => voice.say('Kept.'));
      return;
    default:
  }
}

// "save as <name>": the name the recognizer caught, or ask for it. The job's own unit name saves straight away;
// any other name is read back for a yes first, since it files the report under that unit.
function voiceSaveAs(heardName) {
  if (!job) { voice.say('No job open.'); return; }
  if (!heardName) { vs.saving = true; vs.mode = 'free'; voice.say('Save as what? Say the name.'); return; }
  askSaveAs(cleanName(numberWordsToDigits(heardName)));
}

function askSaveAs(name) {
  const known = knownUnits().find((u) => u.system === job.system && norm(u.name) === norm(name));
  const label = known?.name || name;
  if (job.unit && known?.id === job.unit) { finishSave(); voice.say(`Saved as ${label}.`); return; }
  askPending(`Save as ${label}? Yes or no.`, () => { finishSave(label); voice.say(`Saved as ${label}.`); }, () => voice.say('Not saved. Say save as, and the name.'));
}

// readings by voice: one input at a time, each read back and confirmed before it's entered
function voiceNextInput() {
  const r = vs.reading;
  if (!r) return;
  r.i++;
  if (r.i >= r.ids.length) {
    vs.reading = null; vs.spokenFor = null;
    voice.say('Done. Back to the diagnosis.');
    go('#/diag');
    return;
  }
  const inp = kb.inputs.get(r.ids[r.i]);
  r.unit = inp.unit || '';
  vs.mode = 'number';
  voice.say(`Say the ${speakable(inp.name)}${inp.unit ? `, in ${speakable(inp.unit)}` : ''}. Or say skip.`);
}

function voiceReading(text) {
  const r = vs.reading;
  if (!r || r.i < 0) return;
  const inp = kb.inputs.get(r.ids[r.i]);
  const got = calc.readValue(text, inp.unit || '');
  if (got.v == null) { voice.say(`That didn't read as a number${got.note ? `: ${speakable(got.note)}` : ''}. Say it again.`); return; }
  askPending(`${fmt(got.v, 2)} ${speakable(inp.unit || '')}. Right?`, () => {
    job.inputs[inp.id] = String(got.v); save();
    if (view.name === 'readings') render();
    voiceNextInput();
  }, () => { r.i--; voiceNextInput(); });
}

// ---------------------------------------------------------------- sheet: change a finding
function openSheet(fid) {
  const f = kb.features.get(fid);
  if (!f) return;
  const cur = job.f[fid]?.s;
  $('#sheet').innerHTML = `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" role="dialog" aria-label="${esc(f.name)}">
    <div class="q">${esc(kb.ask(f, job.system))}</div>
    ${f.caution ? `<div class="safety"><b>Before you do this:</b> ${esc(kb.fill(f.caution, job.system))}</div>` : ''}
    <div class="answers">${f.stateIds.map((s) => `<button class="ans ${cur === s ? 'nums' : ''}" data-act="sheet-set" data-f="${esc(fid)}" data-s="${esc(s)}">${esc(kb.fill(String(f.states[s]), job.system))}</button>`).join('')}
      <button class="ans skip" data-act="sheet-remove" data-f="${esc(fid)}">Remove this finding</button></div></div></div>`;
}
const closeSheet = () => { $('#sheet').innerHTML = ''; };

// ---------------------------------------------------------------- events
function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  if (a === 'sheet-close' && e.target !== el) return; // clicks inside the sheet
  switch (a) {
    case 'home': go('#/'); break;
    case 'setup': if (job) go('#/setup'); break;
    case 'tools': go('#/tools'); break;
    case 'tool': go(`#/tool/${el.dataset.id}`); break;
    case 'theme': {
      const cur = store.get(KEY_THEME, 'auto');
      const dark = cur === 'dark' || (cur === 'auto' && !window.matchMedia('(prefers-color-scheme: light)').matches);
      applyTheme(dark ? 'light' : 'dark');
      break;
    }
    case 'go': go(el.dataset.href); break;
    case 'negate': {
      // the phone's number pad has no minus key: flip the sign of the box next to this button
      const box = el.parentElement.querySelector('input');
      if (!box) break;
      const v = box.value.trim().replace(/^[\u2212\u2013]/, '-');
      box.value = v.startsWith('-') ? v.slice(1) : `-${v}`;
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.focus();
      break;
    }
    case 'sys': newJob(el.dataset.id); go('#/setup'); break;
    case 'start-text': {
      const text = $('#homeq')?.value || '';
      const sys = el.dataset.sys || guessSystem(text, search.run(text, null));
      if (sys) startFromText(text, sys);
      break;
    }
    case 'resume': go('#/diag'); break;
    case 'reopen': {
      const hist = store.get(KEY_HIST, []);
      const h = hist[+el.dataset.i];
      if (h) { if (job) archive(); job = h.job; save(); go('#/diag'); }
      break;
    }
    case 'finish': finishSheet(); break;
    case 'finish-save': finishSave($('#saveas')?.value || null); break;
    case 'finish-delete': finishSheet(true); break;
    case 'finish-delete-yes': finishDelete(); break;
    case 'voice': voiceToggle(); break;
    case 'report-share': shareReports([el.dataset.id]); break;
    case 'report-delete': deleteReport(el.dataset.id, el.dataset.sure === '1'); break;
    case 'backup': shareReports(null); break;
    case 'unit-start': startUnit(el.dataset.id, el.dataset.text || ''); break;
    case 'unit-name': nameUnit($('#unitname')?.value || ''); render(); break;
    case 'unit-link': linkUnit(el.dataset.id); render(); break;
    case 'unit-rename': renameUnit(el.dataset.id, $('#unitrename')?.value || ''); break;
    case 'unit-forget': forgetUnit(el.dataset.id, el.dataset.sure === '1'); break;
    case 'ctx': {
      const k = el.dataset.k, v = el.dataset.v;
      if (v === '') delete job.ctx[k]; else job.ctx[k] = v;
      save();
      if (view.name === 'readings') { $('#vitals').innerHTML = vitalsHtml(); el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); }
      else render();
      break;
    }
    case 'answer': setFinding(el.dataset.f, el.dataset.s); render(); $('#nextcard')?.scrollIntoView({ block: 'nearest' }); break;
    case 'skip': if (!job.skip.includes(el.dataset.f)) job.skip.push(el.dataset.f); focusCheck = null; save(); render(); break;
    case 'unskip': job.skip = []; save(); render(); break;
    case 'focus': focusCheck = el.dataset.f; render(); $('#nextcard')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
    case 'chip': openSheet(el.dataset.f); break;
    case 'sheet-set': setFinding(el.dataset.f, el.dataset.s, 'edit'); closeSheet(); render(); break;
    case 'sheet-remove': delete job.f[el.dataset.f]; save(); closeSheet(); render(); break;
    case 'sheet-close': closeSheet(); break;
    case 'add-chip': setFinding(el.dataset.f, el.dataset.s, 'text'); render(); break;
    case 'add-picks': {
      const text = $('#diagq')?.value || '';
      for (const p of search.run(text, job.system).picks) setFinding(p.f, p.s, 'text');
      render();
      break;
    }
    case 'cause': go(`#/cause/${encodeURIComponent(el.dataset.id)}`); break;
    case 'clear-readings': job.inputs = {}; save(); render(); break;
    case 'copy': copySummary(); break;
    default: break;
  }
}

function onInput(e) {
  const t = e.target;
  if (t.id === 'homeq') { homeSearch(); return; }
  if (t.id === 'diagq') { diagSearch(); return; }
  if (t.id === 'jobnotes') { job.notes = t.value; save(); return; }
  if (t.dataset.in) {
    const v = t.value.trim();
    if (v === '') delete job.inputs[t.dataset.in]; else job.inputs[t.dataset.in] = v;
    save();
    const note = t.closest('.field')?.querySelector('.readnote');
    if (note) note.textContent = calc.readValue(v, kb.inputs.get(t.dataset.in)?.unit).note || '';
    $('#vitals').innerHTML = vitalsHtml();
    return;
  }
  if (t.dataset.ctxsel) {
    if (t.value) job.ctx[t.dataset.ctxsel] = t.value; else delete job.ctx[t.dataset.ctxsel];
    save();
    if (view.name === 'readings') $('#vitals').innerHTML = vitalsHtml(); else render();
    return;
  }
  if (t.dataset.tool) updateTool(t.dataset.tool);
}

function onKey(e) {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'homeq') {
    const text = e.target.value;
    const hit = matchUnit(text);
    if (hit) { startUnit(hit.unit.id, hit.rest); return; }
    const sys = guessSystem(text, search.run(text, null));
    if (sys) startFromText(text, sys);
  } else if (e.target.id === 'unitname') {
    nameUnit(e.target.value); render();
  } else if (e.target.id === 'diagq') {
    const text = e.target.value;
    const picks = search.run(text, job.system).picks;
    if (picks.length) {
      for (const p of picks) setFinding(p.f, p.s, 'text');
      render();
      setTimeout(() => $('#diagq')?.focus(), 30);
    }
  }
}

// plain text for a work order: what, the unit, what was found, the numbers, the likely causes
function jobSummary() {
  const { m, res } = evaluate();
  const sys = kb.systems.get(job.system);
  const lines = [`${sys.name} — ${new Date(job.t0).toLocaleString()}`];
  const ctx = contextLine().replace(/&amp;/g, '&');
  if (ctx) lines.push(`Unit: ${ctx}`);
  const found = [...Object.entries(job.f).map(([fid, r]) => kb.label(fid, r.s, job.system)),
    ...Object.entries(m.findings).filter(([fid]) => !job.f[fid]).map(([fid, r]) => kb.label(fid, r.s, job.system))];
  if (found.length) lines.push('Found:', ...found.map((x) => `- ${x}`));
  const vals = m.results.filter((r) => Number.isFinite(r.v) && !r.measure.hidden && (!r.sets || m.findings[r.sets]?.from === r.id));
  if (vals.length) lines.push('Readings:', ...vals.map((r) => `- ${r.measure.name}: ${fmt(r.v)} ${r.measure.unit || ''}${r.t != null && Number.isFinite(r.t) ? ` (target ${fmt(r.t)})` : ''}${r.state ? ` — ${r.state}` : ''}`));
  lines.push('Likely causes:', ...res.post.slice(0, 3).map((r) => `- ${r.cause.name} (${pct(r.p)}%)`));
  if (job.notes) lines.push('Notes:', job.notes);
  return lines.join('\n');
}

async function copySummary() {
  const text = jobSummary();
  try { await navigator.clipboard.writeText(text); toast('Copied — paste it into the work order'); }
  catch {
    $('#sheet').innerHTML = `<div class="sheet-bg" data-act="sheet-close"><div class="sheet"><div class="q">Copy this</div>
      <textarea rows="12" style="width:100%;font-size:15px;border-radius:12px;padding:10px;background:var(--panel2);border:1px solid var(--line)">${esc(text)}</textarea></div></div>`;
  }
}

function diagSearch() {
  const text = $('#diagq')?.value || '';
  const box = $('#diagres');
  if (!box) return;
  if (!text.trim()) { box.innerHTML = ''; return; }
  const r = search.run(text, job.system);
  const sys = job.system;
  let html = '';
  if (r.picks.length) {
    html += `<div class="chips">${r.picks.map((p) => `<button class="chip add" data-act="add-chip" data-f="${esc(p.f)}" data-s="${esc(p.s)}">+ ${esc(p.label)}</button>`).join('')}</div>`;
    if (r.picks.length > 1) html += `<button class="cta" data-act="add-picks" style="margin-bottom:8px">Add all ${r.picks.length}</button>`;
  }
  const more = r.chips.filter((c) => !r.picks.some((p) => p.f === c.f && p.s === c.s)).slice(0, 5);
  if (more.length) html += `<div class="results"><div class="grp">Or did you mean</div>${more.map((c) => `<button class="res" data-act="add-chip" data-f="${esc(c.f)}" data-s="${esc(c.s)}">${esc(c.label)}</button>`).join('')}</div>`;
  if (r.causes.length) html += `<div class="results"><div class="grp">Causes</div>${r.causes.slice(0, 3).map((c) => `<button class="res" data-act="cause" data-id="${esc(c.id)}">${esc(c.label)}<span class="k">read ›</span></button>`).join('')}</div>`;
  if (r.tools.length) html += `<div class="results"><div class="grp">Calculators</div>${r.tools.map((t) => `<button class="res" data-act="tool" data-id="${t.id}">${esc(t.label)}</button>`).join('')}</div>`;
  box.innerHTML = html || `<p class="muted">No match yet — try other words ("${esc(kb.fill('{output}', sys))}", a part name, what it's doing).</p>`;
}

boot();
