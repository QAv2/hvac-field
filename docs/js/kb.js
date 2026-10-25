// The knowledge base in memory: the systems tree, context questions, features (things you can
// observe), measures (numbers that set features), and causes with their signatures.
//
// A signature says how a cause moves each feature. In the YAML a sign is written as a state name
// with a strength mark: "high!" (nearly always, 0.95), "high" (usually, 0.85), "high?" (often,
// 0.6). "low|normal" spreads the strength over both states, and an explicit map such as
// {low: 0.1, normal: 0.5, high: 0.4} says it exactly. Whatever a sign leaves over goes to the
// other states in proportion to the feature's base rates.

export const STRENGTH = { '!': 0.95, '': 0.85, '?': 0.6 };
const NORMAL_LIFT = { '!': 0.6, '': 0.4, '?': 0.15 };
export const PRIOR = { very_common: 10, common: 5, occasional: 2.5, uncommon: 1.2, rare: 0.5 };
export const UNKNOWN_REQUIRE = 0.6; // prior factor per requirement on a context answer we don't know
// A cause that says nothing about a feature leaves it at its leak rate: the abnormal states shrink
// to this share of their base rate (the population base rate includes the faults that DO move the
// feature, so it overstates what an unrelated fault shows). Weather/history features are exempt.
export const SILENT_ABNORMAL = 0.35;
const FLOOR = 0.005;

const SIGN_RE = /^([a-z0-9_]+(?:\|[a-z0-9_]+)*)([!?]?)$/;

function normalize(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) { arr[i] = Math.max(arr[i], FLOOR); s += arr[i]; }
  for (let i = 0; i < arr.length; i++) arr[i] /= s;
  return arr;
}

export function prepFeature(f) {
  const states = Object.keys(f.states || {});
  f.stateIds = states;
  f.idx = Object.fromEntries(states.map((s, i) => [s, i]));
  if (!f.normal) f.normal = 'normal' in f.idx ? 'normal' : 'no' in f.idx ? 'no' : 'ok' in f.idx ? 'ok' : states[0];
  const base = new Float64Array(states.length);
  if (f.base) {
    for (const s of states) base[f.idx[s]] = f.base[s] ?? 0;
  } else {
    const pn = states.length === 2 ? 0.92 : states.length === 3 ? 0.86 : 0.82;
    for (const s of states) base[f.idx[s]] = s === f.normal ? pn : (1 - pn) / (states.length - 1);
  }
  f.baseDist = normalize(base);
  // How techs report it: `confuse: {none: {weak: 0.25}}` = a quarter of true "none" cases get
  // reported as "weak" (a cold zone in a building that's mostly warm). Distributions are compared
  // with the answer only after passing through this.
  f.confusion = null;
  if (f.confuse) {
    const n = states.length;
    const C = states.map(() => new Float64Array(n));
    for (let t = 0; t < n; t++) {
      let off = 0;
      for (const [r, q] of Object.entries(f.confuse[states[t]] || {})) { C[t][f.idx[r]] = q; off += q; }
      C[t][t] = Math.max(0, 1 - off);
    }
    f.confusion = C;
  }
  f.obsBase = observe(f, f.baseDist);
  const silent = Float64Array.from(f.baseDist, (b, i) => (f.situational || states[i] === f.normal ? b : b * SILENT_ABNORMAL));
  f.silentTrue = normalize(silent); // before report confusion; followDist builds on it
  f.silentDist = observe(f, f.silentTrue);
  f.cost ??= 2;
  return f;
}

// true-state distribution → reported-state distribution
export function observe(f, dist) {
  if (!f.confusion) return dist;
  const out = new Float64Array(dist.length);
  for (let t = 0; t < dist.length; t++) for (let r = 0; r < dist.length; r++) out[r] += dist[t] * f.confusion[t][r];
  return normalize(out);
}

// Parse one sign into a distribution over the feature's states. Throws on anything malformed,
// so the checker can point at the exact cause and feature.
// A sign's distribution over the feature's true states, before report confusion.
export function signDistTrue(f, spec) {
  const n = f.stateIds.length;
  const out = new Float64Array(n);
  if (spec && typeof spec === 'object') {
    let used = 0;
    const given = new Set();
    for (const [s, v] of Object.entries(spec)) {
      if (!(s in f.idx)) throw new Error(`state "${s}" is not a state of ${f.id} (${f.stateIds.join(', ')})`);
      if (typeof v !== 'number' || v < 0) throw new Error(`weight for ${f.id}.${s} must be a number ≥ 0`);
      out[f.idx[s]] = v;
      used += v;
      given.add(s);
    }
    if (used > 1.0001) return normalize(out);
    spread(f, out, given, 1 - used);
    return normalize(out);
  }
  const m = SIGN_RE.exec(String(spec).trim());
  if (!m) throw new Error(`can't read sign "${spec}" for ${f.id}`);
  const targets = m[1].split('|');
  for (const s of targets) if (!(s in f.idx)) throw new Error(`state "${s}" is not a state of ${f.id} (${f.stateIds.join(', ')})`);
  let strength = STRENGTH[m[2]];
  // Any sign (single state or union like "low|normal" or "off|running") must make the named
  // states more likely than chance, and must never boost the unnamed states above their base rate.
  let bTaken = 0;
  for (const s of targets) bTaken += f.baseDist[f.idx[s]];
  strength = Math.max(strength, bTaken + (1 - bTaken) * NORMAL_LIFT[m[2]]);
  for (const s of targets) out[f.idx[s]] = strength / targets.length;
  spread(f, out, new Set(targets), 1 - strength);
  return normalize(out);
}

export function signDist(f, spec) {
  return observe(f, signDistTrue(f, spec));
}

// A feature that `follows` another (a box warm is the cooling falling short) gives a cause that doesn't
// mention it the cause's own reading of the other feature: each mapped state takes the summed share of its
// source states, and a state with no source (box too cold) keeps its leak-rate share.
export function followDist(f, map, src, srcTrue) {
  const out = new Float64Array(f.stateIds.length);
  let free = 1;
  for (const s of f.stateIds) if (!map[s]) { out[f.idx[s]] = f.silentTrue[f.idx[s]]; free -= out[f.idx[s]]; }
  for (const [s, from] of Object.entries(map)) {
    let p = 0;
    for (const x of from) p += srcTrue[src.idx[x]] ?? 0;
    out[f.idx[s]] = free * p;
  }
  return observe(f, normalize(out));
}

function spread(f, out, taken, mass) {
  if (mass <= 0) return;
  let bs = 0;
  for (const s of f.stateIds) if (!taken.has(s)) bs += f.baseDist[f.idx[s]];
  if (bs <= 0) return;
  for (const s of f.stateIds) if (!taken.has(s)) out[f.idx[s]] += (mass * f.baseDist[f.idx[s]]) / bs;
}

// does a context condition {key: value | [values]} hold? 'yes' / null (unknown) / 'no'
export function ctxMatch(cond, ctx) {
  let unknown = 0;
  for (const [k, want] of Object.entries(cond || {})) {
    const have = ctx[k];
    if (have === undefined || have === null || have === 'unknown') { unknown++; continue; }
    const list = Array.isArray(want) ? want : [want];
    if (!list.map(String).includes(String(have))) return { ok: false, unknown };
  }
  return { ok: true, unknown };
}

export class KB {
  constructor(raw) {
    this.raw = raw;
    this.systems = new Map(raw.systems.map((s) => [s.id, s]));
    this.context = new Map((raw.context || []).map((c) => [c.id, c]));
    this.features = new Map(raw.features.map((f) => [f.id, prepFeature(f)]));
    this.inputs = new Map((raw.inputs || []).map((i) => [i.id, i]));
    this.measures = raw.measures || [];
    this.causes = raw.causes;
    this.cause = new Map(raw.causes.map((c) => [c.id, c]));
    this.refs = new Map((raw.refs || []).map((r) => [r.id, r]));
    this.synonyms = raw.synonyms || [];
  }

  // a system and its ancestors, nearest first
  lineage(sysId) {
    const out = [];
    for (let s = this.systems.get(sysId); s; s = s.parent ? this.systems.get(s.parent) : null) out.push(s.id);
    return out;
  }

  // Does an item tagged with `systems` belong to the chosen system? Tags on the system itself or
  // an ancestor count; if the chosen system is a group (e.g. all refrigeration), tags on its
  // members count too.
  inSystem(item, sysId) {
    const tags = item.systems || ['*'];
    if (tags.includes('*')) return true;
    const mine = this.lineage(sysId);
    return tags.some((t) => mine.includes(t) || this.lineage(t).includes(sysId));
  }

  // 0 when a known context answer rules the item out; otherwise a prior factor. For an answer
  // we don't know yet, the factor is the share of units that would qualify when the options
  // carry shares (`p`: e.g. most split systems are ducted), else a flat UNKNOWN_REQUIRE. With `system`, a
  // question that system never asks (the heat-pump type on a furnace) doesn't weigh at all.
  requireFactor(item, ctx, system) {
    if (!item.requires) return 1;
    let f = 1;
    for (const [k, want] of Object.entries(item.requires)) {
      const list = (Array.isArray(want) ? want : [want]).map(String);
      const have = ctx[k];
      if (have === undefined || have === null || have === 'unknown') {
        if (system && !this.asks(k, system)) continue;
        f *= this.unknownShare(k, list);
        continue;
      }
      if (!list.includes(String(have))) return 0;
    }
    return f;
  }

  unknownShare(k, list) {
    const opts = (this.context.get(k)?.options || []).filter((o) => o && typeof o === 'object' && typeof o.p === 'number');
    const tot = opts.reduce((a, o) => a + o.p, 0);
    if (!opts.length || tot <= 0) return UNKNOWN_REQUIRE;
    const got = opts.filter((o) => list.includes(String(o.id))).reduce((a, o) => a + o.p, 0);
    return Math.max(0.05, got / tot);
  }

  // whether a system asks context question k at all
  asks(k, sysId) {
    const c = this.context.get(k);
    return Boolean(c && this.inSystem(c, sysId));
  }

  // context questions that matter for a system
  contextFor(sysId) {
    return [...this.context.values()].filter((c) => this.inSystem(c, sysId));
  }

  // the answers a system implies (A/C coils run at A/C temperatures, etc.)
  defaultCtx(sysId) {
    const out = {};
    for (const c of this.contextFor(sysId)) {
      for (const s of this.lineage(sysId)) {
        if (c.defaults && c.defaults[s] !== undefined) { out[c.id] = String(c.defaults[s]); break; }
      }
    }
    return out;
  }

  // a cause's signs with the context-specific `when` overrides folded in
  signsFor(cause, ctx) {
    let signs = { ...(cause.signs || {}) };
    for (const w of cause.when || []) {
      const m = ctxMatch(w.if, ctx);
      if (m.ok && m.unknown === 0) signs = { ...signs, ...w.signs };
    }
    return signs;
  }

  // Chip text for a finding. Features marked `chip: state` have state labels that read alone
  // ("No cooling at all"); the rest read "Superheat: High".
  label(fid, state, sysId) {
    const f = this.features.get(fid);
    if (!f) return `${fid}=${state}`;
    const sl = String(f.states[state] ?? state);
    const s = f.chip === 'state' ? sl : (f.chip && typeof f.chip === 'object' && f.chip[state]) || `${f.name}: ${sl}`;
    return this.fill(s, sysId);
  }

  // The question for a feature on this system: `ask_for: {vc.hp: '…'}` overrides `ask` where the
  // shared wording would mislead (on a heat pump in heating, the "evaporator" is the outdoor coil).
  ask(f, sysId) {
    let q = f.ask;
    if (f.ask_for && sysId) for (const s of this.lineage(sysId)) if (f.ask_for[s]) { q = f.ask_for[s]; break; }
    return this.fill(q, sysId);
  }

  // {output} / {Output} → the system's word for what it delivers (cooling, heat, ice, air)
  fill(text, sysId) {
    const w = (sysId && this.systems.get(sysId)?.output) || 'output';
    return String(text ?? '').replace(/\{output\}/g, w).replace(/\{Output\}/g, w[0].toUpperCase() + w.slice(1));
  }
}
