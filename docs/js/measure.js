// Numbers → findings. Each measure in the knowledge base computes a value from raw readings
// (and the job's context), compares it with a target, and names the state of a feature:
// superheat 24 °F against a target of 12 → "Superheat: high".

import { evaluate, register } from './expr.js';
import * as calc from './calcs.js';

let active = {}; // context of the job being evaluated, read by the refrigerant functions

register('tsat_dew', (p) => calc.tsat(active.refrigerant, p, 'dew'));
register('tsat_bubble', (p) => calc.tsat(active.refrigerant, p, 'bubble'));
register('tsat_mid', (p) => calc.tsat(active.refrigerant, p, 'mid'));
register('psat_dew', (t) => calc.psat(active.refrigerant, t, 'dew'));
register('psat_bubble', (t) => calc.psat(active.refrigerant, t, 'bubble'));
register('wetbulb', (db, rh) => calc.wetbulb(db, rh));
register('dewpoint', (db, rh) => calc.dewpoint(db, rh));
register('rh_from_wb', (db, wb) => calc.rhFromWb(db, wb));
register('fo_target_sh', (iwb, odb) => calc.foTargetSh(iwb, odb));
register('split_target', (db, wb) => calc.splitTarget(db, wb));
register('glycol_freeze', (pct, type) => calc.glycolFreeze(pct, type));
register('flue_eff', (stack, air, o2) => calc.combustion({ stackF: stack, airF: air, o2 })?.eff ?? null);
register('co_airfree', (co, o2) => (co * 20.9) / (20.9 - o2));

export const EXPR_FUNCTIONS = ['tsat_dew', 'tsat_bubble', 'tsat_mid', 'psat_dew', 'psat_bubble', 'wetbulb', 'dewpoint',
  'rh_from_wb', 'fo_target_sh', 'split_target', 'glycol_freeze', 'flue_eff', 'co_airfree'];

const num = (x) => {
  if (x === null || x === undefined || x === '') return null;
  const n = typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Evaluate every measure that applies. Returns {results: [{id, measure, v, t, state, sets}],
// findings: {featureId: {s, from: measureId, v, t}}}. When two measures set the same feature,
// the first one listed in the knowledge base that has its numbers wins.
export function computeMeasures(kb, system, ctx, inputs) {
  active = ctx || {};
  const vals = {};
  const results = new Map();
  const applies = kb.measures.filter((m) => kb.inSystem(m, system) && kb.requireFactor(m, ctx) > 0);
  const base = (name) => {
    if (name.startsWith('ctx.')) return ctx[name.slice(4)] ?? null;
    const raw = num(inputs?.[name]);
    if (raw !== null) return raw;
    if (name in vals) return vals[name];
    const inp = kb.inputs.get(name);
    return inp && inp.default !== undefined ? inp.default : null;
  };
  // two passes so a measure may use another measure's value regardless of order
  for (let pass = 0; pass < 2; pass++) {
    for (const m of applies) {
      const lets = {};
      const env = (name) => (name in lets ? lets[name] : base(name));
      for (const [k, e] of Object.entries(m.let || {})) lets[k] = evaluate(e, env);
      const v = evaluate(m.value, env);
      if (v === null || typeof v !== 'number') continue;
      vals[m.id] = v;
      lets.v = v;
      const t = m.target ? evaluate(m.target, env) : null;
      lets.t = t;
      let state = null;
      for (const [s, cond] of m.states || []) {
        if (evaluate(cond, env) === true) { state = s; break; }
      }
      results.set(m.id, { id: m.id, measure: m, v, t, state, sets: m.sets || null });
    }
  }
  const findings = {};
  for (const m of applies) {
    const r = results.get(m.id);
    if (!r || !r.sets || !r.state || findings[r.sets]) continue;
    findings[r.sets] = { s: r.state, from: m.id, v: r.v, t: r.t };
  }
  const sanity = checkSanity(inputs, vals);
  return { results: [...results.values()], findings, sanity };
}

// First and Second Law thermodynamic conservation checks on raw readings.
// Catches impossible sensor combinations before the tech chases a non-existent equipment fault.
export function checkSanity(inputs, vals = {}) {
  const w = [];
  const g = (k) => { const v = num(inputs?.[k]); return v !== null ? v : (k in vals ? vals[k] : null); };
  // 1. Psychrometric law: wet-bulb cannot exceed dry-bulb
  const db = g('vc.air_in_f') ?? g('ahu.ra_f');
  const wb = g('vc.air_in_wb') ?? g('ahu.ra_wb');
  if (db !== null && wb !== null && wb > db + 0.5) {
    w.push(`Psychrometric check: wet-bulb (${wb} °F) cannot exceed dry-bulb (${db} °F) — check thermometer calibration or dry sock.`);
  }
  // 2. Second Law at evaporator: suction line cannot be colder than boiling refrigerant, nor supply air colder than coil
  const evapSat = g('vc.evap_sat_t');
  const sucLine = g('vc.suction_line_f');
  if (evapSat !== null && sucLine !== null && sucLine < evapSat - 2.0) {
    w.push(`Thermodynamic check: suction line (${sucLine} °F) reads colder than evaporator saturation (${evapSat.toFixed(1)} °F) — check low-side gauge zero, pipe probe contact, or whether ${active.refrigerant || 'the selected refrigerant'} is right.`);
  }
  const airOut = g('vc.air_out_f');
  if (evapSat !== null && airOut !== null && airOut < evapSat - 1.5) {
    w.push(`Second-law check: supply air (${airOut} °F) cannot leave colder than the evaporator saturation (${evapSat.toFixed(1)} °F).`);
  }
  // 3. Second Law at condenser: condensing saturation must be above ambient air to reject heat, and liquid line cannot exceed condensing sat
  const condSat = g('vc.cond_sat_t');
  const amb = g('vc.ambient_f');
  if (condSat !== null && amb !== null && condSat < amb - 1.5) {
    w.push(`Second-law check: condensing saturation (${condSat.toFixed(1)} °F) is below condenser inlet air (${amb} °F) — compressor not running, wrong refrigerant selected, or high-side gauge off.`);
  }
  const liqLine = g('vc.liquid_line_f');
  const condDew = active.refrigerant ? calc.tsat(active.refrigerant, g('vc.liquid_psig'), 'dew') : condSat;
  const condTop = Math.max(condSat ?? -999, condDew ?? -999);
  if (condTop > -500 && liqLine !== null && liqLine > condTop + 2.5) {
    w.push(`Thermodynamic check: liquid line (${liqLine} °F) reads hotter than condensing saturation (${condTop.toFixed(1)} °F) — shade the pipe probe from sun/discharge air or check high-side gauge.`);
  }
  // 4. Mixing-box energy conservation (NIST APAR Rules 26-27): mixed air must lie between outdoor and return air
  const oa = g('ahu.oa_f'), ra = g('ahu.ra_f'), ma = g('ahu.ma_f');
  if (oa !== null && ra !== null && ma !== null) {
    const lo = Math.min(oa, ra) - 3.0, hi = Math.max(oa, ra) + 3.0;
    if (ma < lo || ma > hi) {
      w.push(`Energy-balance check (APAR Rules 26–27): mixed air (${ma} °F) is outside the outdoor/return range (${oa}–${ra} °F) — severe air stratification or a drifted mixed-air sensor.`);
    }
  }
  // 5. Draft sign: draft is negative pressure. A plus number means the flue is pushing back.
  for (const [k, label] of [['blr.br_draft_inwc', 'Breech draft'], ['blr.of_draft_inwc', 'Over-fire draft']]) {
    const d = g(k);
    if (d !== null && d > 0.015) {
      w.push(`${label} entered as +${d} in. w.c. — a plus sign means positive pressure (flue pushing back), not draft. If the gauge read "draft ${d}", enter -${d}.`);
    }
  }
  return w;
}
