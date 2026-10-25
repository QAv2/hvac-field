// Diagnosis engine. Single-fault Bayesian ranking over the causes that apply to the chosen system
// and context, with "next best check" chosen by expected information gain per unit of effort.
//
// P(cause | findings) ∝ prior(cause) · Π P(feature = observed state | cause)^TAU
// A cause that says nothing about a feature uses that feature's base rates, so an abnormal finding
// the cause can't explain counts against it. TAU < 1 tempers overconfidence from features that
// overlap (e.g. a low suction pressure and an iced coil both point the same way).

import { signDist, signDistTrue, followDist, PRIOR } from './kb.js';

export const TAU = 0.9;
const COST_EXP = 0.8;

const log2 = (x) => Math.log(x) / Math.LN2;
function entropy(ps) {
  let h = 0;
  for (const p of ps) if (p > 1e-12) h -= p * log2(p);
  return h;
}

// Fold findings into a {featureId: state} map. Findings may be given as such a map or as a list
// of {f, s} records (the UI keeps where each came from).
function asMap(findings) {
  if (!findings) return {};
  if (Array.isArray(findings)) return Object.fromEntries(findings.map((x) => [x.f, x.s]));
  return findings;
}

export function prepare(kb, system, ctx = {}) {
  const feats = [...kb.features.values()].filter((f) => kb.inSystem(f, system) && kb.requireFactor(f, ctx) > 0);
  const fset = new Set(feats.map((f) => f.id));
  const causes = [];
  for (const c of kb.causes) {
    if (!kb.inSystem(c, system)) continue;
    const rf = kb.requireFactor(c, ctx, system);
    if (rf === 0) continue;
    const signs = kb.signsFor(c, ctx);
    const dist = new Map();
    for (const [fid, spec] of Object.entries(signs)) {
      if (!fset.has(fid)) continue;
      dist.set(fid, signDist(kb.features.get(fid), spec));
    }
    const derived = follow(kb, feats, signs, dist);
    causes.push({ id: c.id, c, prior: (PRIOR[c.prior] ?? PRIOR.occasional) * rf, dist, derived });
  }
  // "Nothing wrong here": the system checks out, so look at load, settings, expectations or the
  // equipment upstream. The system's `ok_signs` say how such calls get reported (mostly "not enough",
  // seldom "nothing at all"); other complaint features stay at base rates, and every check is expected
  // to read normal, at the same leak rate as a silent cause.
  const sys = kb.systems.get(system);
  const okSigns = kb.lineage(system).map((s) => kb.systems.get(s).ok_signs).find(Boolean) || {};
  const okDist = new Map();
  for (const [fid, spec] of Object.entries(okSigns)) {
    if (!fset.has(fid)) continue;
    // a likelihood floor, not a distribution: "nothing wrong" never reads a normal answer worse than a silent
    // cause does, or a call that checks out everywhere could not end in "nothing wrong"
    const f = kb.features.get(fid), d = Float64Array.from(signDist(f, spec)), i = f.idx[f.normal];
    if (i !== undefined) d[i] = Math.max(d[i], f.silentDist[i]);
    okDist.set(fid, d);
  }
  // The complaint told another way (a warm box for "cooling weak") reads through ok_signs too; checks like
  // the air rise across a unit don't, since under "nothing wrong" they read normal.
  const okDerived = follow(kb, feats.filter((f) => f.complaint), okSigns, okDist);
  causes.push({
    id: '_ok', prior: PRIOR.occasional, dist: okDist, derived: okDerived,
    c: { id: '_ok', name: 'Nothing wrong found in this system yet', systems: [system],
      fix: sys?.ok_note || 'Everything entered so far reads normal. Check the load (doors, product, occupancy), the settings, and the equipment that feeds this system, and re-read any number that looked odd.' },
  });
  return { kb, system, ctx, feats, fset, causes };
}

// Features that `follow` another (rf.box_temp follows gen.output) take a silent cause's reading from its
// sign on the feature they follow, so a cause that only says "weak cooling" also predicts a warm box.
// Returns the follower ids it derived (the cause didn't sign them itself).
function follow(kb, feats, signs, dist) {
  const derived = new Set();
  for (const f of feats) {
    if (!f.follows || dist.has(f.id)) continue;
    for (const [src, map] of Object.entries(f.follows)) {
      if (signs[src] === undefined) continue;
      const sf = kb.features.get(src);
      dist.set(f.id, followDist(f, map, sf, signDistTrue(sf, signs[src])));
      derived.add(f.id);
      break;
    }
  }
  return derived;
}

// Once the source of a `follows` pair is answered, the follower is the same fact told again. For a cause
// that doesn't sign the follower itself it is then one shared term, the same for every such cause: likely
// where the two answers agree, the leak rate where they don't. So an agreeing pair isn't counted twice, and
// a disagreeing one (a call at the thermostat that never reaches T–T) counts for the causes that predict
// exactly that, instead of being explained away as a misreport.
const AGREE = 0.9;
const sameFactCache = new WeakMap();
function sameFact(kb, f, F) {
  for (const src of Object.keys(f.follows)) {
    const x = F[src];
    if (x === undefined) continue;
    let byState = sameFactCache.get(f);
    if (!byState) sameFactCache.set(f, (byState = new Map()));
    const key = `${src}=${x}`;
    if (!byState.has(key)) {
      const expect = f.stateIds.filter((s) => (f.follows[src][s] || []).includes(x));
      let d = f.silentDist;
      if (expect.length) {
        d = new Float64Array(f.stateIds.length);
        let rest = 0;
        for (const s of f.stateIds) if (!expect.includes(s)) rest += f.silentDist[f.idx[s]];
        for (const s of f.stateIds) {
          const i = f.idx[s];
          d[i] = expect.includes(s) ? AGREE / expect.length : rest > 0 ? ((1 - AGREE) * f.silentDist[i]) / rest : 0;
        }
      }
      byState.set(key, d);
    }
    return byState.get(key);
  }
  return null;
}

// The distribution a cause predicts for a feature: its sign if it has one; the leak rate if it is
// silent (see SILENT_ABNORMAL in kb.js). "Nothing wrong found" takes the plain base rate on the
// complaint features its ok_signs don't cover, so a complaint alone doesn't count against it.
// F (the answers so far) switches a follower to its shared term once its source is answered.
function distFor(cause, f, F, kb) {
  if (F && f.follows && !(cause.dist.has(f.id) && !cause.derived?.has(f.id))) {
    const d = sameFact(kb, f, F);
    if (d) return d;
  }
  const d = cause.dist.get(f.id);
  if (d) return d;
  if (cause.id === '_ok' && f.complaint) return f.obsBase;
  return f.silentDist;
}

function lik(model, cause, fid, state, F) {
  const f = model.kb.features.get(fid);
  const i = f.idx[state];
  return i === undefined ? 1 : distFor(cause, f, F, model.kb)[i];
}

export function posterior(model, findings) {
  const M = asMap(findings);
  const F = Object.entries(M).filter(([fid]) => model.fset.has(fid));
  const logs = model.causes.map((c) => {
    let l = Math.log(c.prior);
    for (const [fid, s] of F) l += TAU * Math.log(lik(model, c, fid, s, M));
    return l;
  });
  const mx = Math.max(...logs);
  let z = 0;
  const w = logs.map((l) => { const e = Math.exp(l - mx); z += e; return e; });
  return model.causes
    .map((c, i) => ({ id: c.id, cause: c.c, p: w[i] / z, log: logs[i] }))
    .sort((a, b) => b.p - a.p);
}

// Which findings speak for or against a cause, compared with the feature's base rates.
export function explain(model, findings, causeId) {
  const c = model.causes.find((x) => x.id === causeId);
  if (!c) return { support: [], against: [], silent: [] };
  const support = [], against = [], silent = [];
  const M = asMap(findings);
  for (const [fid, s] of Object.entries(M)) {
    if (!model.fset.has(fid)) continue;
    const f = model.kb.features.get(fid);
    const p = lik(model, c, fid, s, M);
    const b = f.obsBase[f.idx[s]];
    const row = { f: fid, s, p, base: b, lr: p / b, label: model.kb.label(fid, s, model.system) };
    const own = c.dist.has(fid) && !c.derived?.has(fid);
    const told = !own && f.follows && sameFact(model.kb, f, M);
    if (told) { if (p < AGREE / 2 && s !== f.normal) silent.push(row); } // agrees with its source: nothing new
    else if (!c.dist.has(fid)) { if (s !== f.normal && !f.situational) silent.push(row); }
    else if (row.lr >= 1.5) support.push(row);
    else if (row.lr <= 0.67) against.push(row);
  }
  support.sort((a, b) => b.lr - a.lr);
  against.sort((a, b) => a.lr - b.lr);
  return { support, against, silent };
}

// How well the leading cause accounts for what was seen: abnormal findings it doesn't predict.
export function fit(model, findings, causeId) {
  const e = explain(model, findings, causeId);
  const misses = [...e.against.filter((r) => r.p < 0.12), ...e.silent];
  return { misses, ok: misses.length < 2 };
}

function askable(model, f, F, skip) {
  if (F[f.id] !== undefined) return false;
  if (skip?.has(f.id)) return false; // the tech said they can't check it now
  if (f.ask === false) return false;
  for (const [fid, states] of Object.entries(f.ask_if || {})) {
    const have = F[fid];
    if (have === undefined) return false;
    if (!(Array.isArray(states) ? states : [states]).includes(have)) return false;
  }
  // never suggest a check that a finding makes unsafe or pointless (e.g. watching another start
  // after repeated lockouts, or with CO in the room)
  for (const [fid, states] of Object.entries(f.ask_unless || {})) {
    const have = F[fid];
    if (have !== undefined && (Array.isArray(states) ? states : [states]).includes(have)) return false;
  }
  return true;
}

function effort(model, f, F) {
  let cost = f.cost;
  if (f.needs) {
    // the setup (gauges on, analyzer in the flue…) is paid once
    const paid = Object.keys(F).some((fid) => model.kb.features.get(fid)?.needs === f.needs);
    if (paid) cost = Math.max(1, cost - 1.5);
  }
  return cost;
}

// Rank the checks you haven't made by information gained per unit of effort.
// opts.limit: how many to return. opts.skip: checks the tech can't make now (left out before the limit,
// so skipping many never empties the list while useful checks remain). Each result lists, per answer, how likely it is and which cause
// it would point to, so the card can say "if it's high → restriction; if normal → …".
export function nextChecks(model, findings, post, opts = {}) {
  const F = asMap(findings);
  post ??= posterior(model, F);
  const byId = new Map(model.causes.map((c) => [c.id, c]));
  const P = post.map((r) => r.p);
  const C = post.map((r) => byId.get(r.id));
  const H0 = entropy(P);
  const out = [];
  const skip = opts.skip ? new Set(opts.skip) : null;
  for (const f of model.feats) {
    if (!askable(model, f, F, skip)) continue;
    const n = f.stateIds.length;
    const pk = new Float64Array(n);
    const lk = C.map((c) => distFor(c, f, F, model.kb));
    // a check that no cause in play has an opinion on can't help
    if (!C.some((c, i) => P[i] > 0.01 && c.dist.has(f.id))) continue;
    for (let i = 0; i < C.length; i++) for (let k = 0; k < n; k++) pk[k] += P[i] * lk[i][k];
    let eh = 0;
    const outcomes = [];
    for (let k = 0; k < n; k++) {
      if (pk[k] < 1e-6) continue;
      const q = C.map((c, i) => P[i] * lk[i][k] ** TAU);
      const z = q.reduce((a, b) => a + b, 0);
      const qn = q.map((x) => x / z);
      eh += pk[k] * entropy(qn);
      let best = 0;
      for (let i = 1; i < qn.length; i++) if (qn[i] > qn[best]) best = i;
      outcomes.push({ state: f.stateIds[k], p: pk[k], top: C[best].id, topP: qn[best] });
    }
    const ig = H0 - eh;
    if (ig <= 1e-4) continue;
    const cost = effort(model, f, F);
    out.push({ feature: f, id: f.id, ig, cost, score: ig / cost ** COST_EXP, outcomes });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, opts.limit ?? 5);
}

// One call for the UI and the tests.
export function diagnose(kb, { system, ctx = {}, findings = {} }, opts = {}) {
  const model = prepare(kb, system, ctx);
  const post = posterior(model, findings);
  const next = nextChecks(model, findings, post, opts);
  const top = post[0];
  return { model, post, next, fit: top ? fit(model, findings, top.id) : null };
}
