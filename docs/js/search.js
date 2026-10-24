// Symptom search. Typed text ("walk-in freezer warm, coil iced, fans running") is split into
// clauses, each clause is matched against the findings' phrases, and the best finding per clause
// is offered as a chip. Synonyms and trade abbreviations are folded to one word first (evap →
// evaporator, TXV → expansion valve), negation is respected (fan running ≠ fan not running), and
// causes, systems and calculators are searchable too.

const STOP = new Set(('a an the of to in on at by for from with is are was were be been being it its this that '
  + 'these those my our your i we me us you they them their there here please just very really also so then than '
  + 'has have had do does did get gets got make makes made unit system thing stuff some any up out down about '
  + 'like seems seem looks look still all').split(' '));
const NEG = 'not';

export function norm(s) {
  return String(s ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9%°.]+/g, ' ').replace(/\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

const SUFFIX = [['ies', 'y'], ['ing', ''], ['ied', 'y'], ['ed', ''], ['es', ''], ['s', '']];
function stem(w) {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.length === 4) return w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
  for (const [suf, rep] of SUFFIX) if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length) + rep;
  return w;
}

export class Search {
  constructor(kb) {
    this.kb = kb;
    // synonym variants → canonical tokens, longest first
    this.canon = new Map();
    this.maxN = 1;
    for (const group of kb.synonyms || []) {
      const head = norm(group[0]).split(' ');
      for (const v of group) {
        const k = norm(v);
        if (!k) continue;
        this.canon.set(k, head);
        this.maxN = Math.max(this.maxN, k.split(' ').length);
      }
    }
    this.cache = new Map();
  }

  // text → canonical stemmed tokens (stopwords out, negations kept as "not")
  tokens(text) {
    const raw = norm(text).split(' ').filter(Boolean);
    const out = [];
    for (let i = 0; i < raw.length;) {
      let hit = null, len = 0;
      for (let n = Math.min(this.maxN, raw.length - i); n >= 1; n--) {
        const k = raw.slice(i, i + n).join(' ');
        if (this.canon.has(k)) { hit = this.canon.get(k); len = n; break; }
      }
      if (hit) { out.push(...hit); i += len; } else { out.push(raw[i]); i += 1; }
    }
    return out.filter((w) => !STOP.has(w)).map((w) => (w === NEG ? w : stem(w)));
  }

  // the searchable items for one system (or every system when sysId is null)
  index(sysId) {
    const key = sysId || '*';
    if (this.cache.has(key)) return this.cache.get(key);
    const kb = this.kb;
    const items = [];
    for (const f of kb.features.values()) {
      if (sysId && !kb.inSystem(f, sysId)) continue;
      for (const s of f.stateIds) {
        const phrases = [...(f.phrases?.[s] || [])];
        phrases.push(kb.label(f.id, s, sysId)); // the chip text itself is a phrase too
        items.push({ kind: 'chip', f: f.id, s, label: kb.label(f.id, s, sysId), normal: s === f.normal,
          phrases: phrases.map((p) => this.tokens(kb.fill(p, sysId))).filter((t) => t.length),
          bag: this.tokens(`${kb.fill(f.name, sysId)} ${kb.fill(String(f.states[s]), sysId)}`) });
      }
    }
    for (const c of kb.causes) {
      if (sysId && !kb.inSystem(c, sysId)) continue;
      items.push({ kind: 'cause', id: c.id, label: c.name, phrases: [c.name, ...(c.keywords || [])].map((p) => this.tokens(p)),
        bag: this.tokens(`${c.name} ${(c.keywords || []).join(' ')}`) });
    }
    if (!sysId) {
      for (const s of kb.systems.values()) {
        if (s.abstract) continue;
        items.push({ kind: 'system', id: s.id, label: s.name, phrases: [s.name, s.short, ...(s.keywords || [])].filter(Boolean).map((p) => this.tokens(p)),
          bag: this.tokens(`${s.name} ${(s.keywords || []).join(' ')}`) });
      }
    }
    for (const t of TOOLS) items.push({ kind: 'tool', id: t.id, label: t.label, phrases: t.words.map((p) => this.tokens(p)), bag: this.tokens(t.words.join(' ')) });
    // inverse document frequency over every token in the items
    const df = new Map();
    for (const it of items) for (const t of new Set([...it.phrases.flat(), ...it.bag])) df.set(t, (df.get(t) || 0) + 1);
    const N = items.length;
    const idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + N / n)]));
    const out = { items, idf };
    this.cache.set(key, out);
    return out;
  }

  // Best phrase match for an item against query tokens q. A phrase whose words all appear scores
  // high, more so when they appear together and in order ("low suction" in "low suction high
  // superheat" beats "high suction"). Returns {s, used} — the score and the query tokens it used.
  match(it, q, qset, idf) {
    const neg = qset.has(NEG);
    let best = { s: 0, used: [] };
    for (const p of it.phrases) {
      if (!p.length) continue;
      const hit = p.filter((t) => qset.has(t));
      if (!hit.length) continue;
      const w = hit.reduce((a, t) => a + (idf.get(t) || 1), 0);
      const pneg = p.includes(NEG);
      let s;
      if (hit.length === p.length) {
        s = w * (1 + 0.15 * p.length) + 1;
        if (p.length > 1) s *= contiguous(q, p) ? 1.5 : 0.7;
      } else {
        const cov = hit.length / p.length;
        if (cov < 0.5) continue;
        s = cov * cov * w * 0.6;
      }
      if (it.kind === 'chip') {
        if (neg && !pneg) s *= 0.35;   // "fan not running" shouldn't pick "fan running"
        if (pneg && !neg) s *= 0.5;    // …nor the other way round
      }
      s *= 0.6 + 0.4 * Math.min(1, hit.length / Math.max(1, q.length)); // how much of the clause it explains
      if (s > best.s) best = { s, used: hit };
    }
    return best;
  }

  score(it, q, qset, idf) {
    return this.match(it, q, qset, idf).s;
  }

  // Search the whole text: per-clause chip suggestions plus ranked results.
  run(text, sysId) {
    const { items, idf } = this.index(sysId);
    const clauses = String(text ?? '').split(/[,;!?\n]+|\.\s/)
      .flatMap((part) => norm(part).split(/\s+(?:and|but|with|plus|also|then|while)\s+/))
      .filter((c) => c.trim());
    const whole = this.tokens(text);
    const wset = new Set(whole);
    const results = [];
    for (const it of items) {
      const s = this.score(it, whole, wset, idf);
      if (s > 0.8) results.push({ ...it, score: s });
    }
    results.sort((a, b) => b.score - a.score);
    // best chips per clause (up to three, each using up the words it matched), one per feature
    const picks = [];
    const usedF = new Set();
    for (const cl of clauses) {
      let q = this.tokens(cl);
      for (let round = 0; round < 3 && q.some((t) => t !== NEG); round++) {
        const qs = new Set(q);
        let best = null;
        for (const it of items) {
          if (it.kind !== 'chip' || usedF.has(it.f)) continue;
          const m = this.match(it, q, qs, idf);
          if (m.s > 2.2 && (!best || m.s > best.score)) best = { ...it, score: m.s, clause: cl, used: m.used };
        }
        if (!best) break;
        picks.push(best);
        usedF.add(best.f);
        const used = new Set(best.used.filter((t) => t !== NEG));
        q = q.filter((t) => !used.has(t));
      }
    }
    return {
      picks,
      chips: results.filter((r) => r.kind === 'chip').slice(0, 12),
      causes: results.filter((r) => r.kind === 'cause').slice(0, 6),
      systems: results.filter((r) => r.kind === 'system').slice(0, 3),
      tools: results.filter((r) => r.kind === 'tool').slice(0, 3),
    };
  }
}

function contiguous(q, p) {
  for (let i = 0; i + p.length <= q.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (q[i + j] !== p[j]) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

export const TOOLS = [
  { id: 'pt', label: 'PT chart — pressure ↔ temperature', words: ['pt chart', 'pressure temperature', 'saturation temperature', 'pt', 'temperature pressure chart', 'custom refrigerant', 'clausius clapeyron', 'elevation pressure'] },
  { id: 'shsc', label: 'Superheat & subcooling', words: ['superheat calculator', 'subcool calculator', 'superheat', 'subcooling', 'sh sc', 'charge check'] },
  { id: 'target', label: 'Target superheat (piston)', words: ['target superheat', 'fixed orifice charging', 'piston charging', 'charging chart'] },
  { id: 'psy', label: 'Wet bulb, dew point, humidity', words: ['wet bulb', 'dew point', 'humidity', 'psychrometric', 'rh', 'enthalpy'] },
  { id: 'split', label: 'Target temperature split', words: ['temperature split', 'delta t', 'target split', 'airflow check'] },
  { id: 'glycol', label: 'Glycol freeze point', words: ['glycol', 'freeze point', 'antifreeze', 'refractometer', 'burst protection'] },
  { id: 'combustion', label: 'Combustion & flue efficiency', words: ['combustion', 'efficiency', 'flue gas', 'stack temperature', 'o2', 'co2', 'excess air', 'co air free'] },
  { id: 'flow', label: 'Water flow, airflow & affinity laws', words: ['gpm', 'flow rate', 'btu', 'cfm', 'airflow', 'water flow', 'affinity laws', 'fan laws', 'pump laws', 'static pressure', 'brake horsepower'] },
  { id: 'elec', label: '3-phase unbalance & live capacitor test', words: ['three phase', '3 phase', 'voltage unbalance', 'current unbalance', 'nema derating', 'capacitor test', 'microfarad', 'mfd under load', 'start winding'] },
];
