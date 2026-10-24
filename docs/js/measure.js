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
register('co_airfree', (co, o2) => (o2 >= 0 && o2 < 20.9 && co >= 0 ? (co * 20.9) / (20.9 - o2) : null));

export const EXPR_FUNCTIONS = ['tsat_dew', 'tsat_bubble', 'tsat_mid', 'psat_dew', 'psat_bubble', 'wetbulb', 'dewpoint',
  'rh_from_wb', 'fo_target_sh', 'split_target', 'glycol_freeze', 'flue_eff', 'co_airfree'];

const num = (x) => calc.readNumber(x);

// Typed readings → numbers in each input's own unit. A box that can't be read, or holds a value no
// instrument could show, is left out (not replaced by its default) and gets a warning.
export function readInputs(kb, inputs) {
  const vals = {}, warnings = [];
  for (const [id, raw] of Object.entries(inputs || {})) {
    const inp = kb.inputs.get(id);
    const r = calc.readValue(raw, inp?.unit || '');
    if (r.v !== null) vals[id] = r.v;
    else if (r.note) {
      warnings.push({ title: 'Reading not used.', ids: [id], msg: `${inp?.name || id}: ${r.note}. Fix it and the results update.` });
    }
  }
  return { vals, warnings };
}

// Evaluate every measure that applies. Returns {results: [{id, measure, v, t, state, sets}],
// findings: {featureId: {s, from: measureId, v, t}}, sanity: [{title, msg, ids}]}. When two measures
// set the same feature, the first one listed in the knowledge base that has its numbers wins.
// Readings that break a law of physics together (wet bulb above dry bulb, a suction line colder than
// the refrigerant boiling in it) are flagged and left out, so they can't turn into a diagnosis.
export function computeMeasures(kb, system, ctx, inputs) {
  active = ctx || {};
  const { vals: read, warnings } = readInputs(kb, inputs);
  const blocked = new Set(warnings.flatMap((w) => w.ids));
  let run = evalMeasures(kb, system, ctx || {}, read, blocked);
  const sanity = checkSanity(read, run.vals);
  const drop = sanity.flatMap((w) => w.ids || []);
  if (drop.length) run = evalMeasures(kb, system, ctx || {}, read, new Set([...blocked, ...drop]));
  return { results: run.results, findings: run.findings, sanity: [...warnings, ...sanity] };
}

function evalMeasures(kb, system, ctx, read, blocked) {
  const vals = {};
  const results = new Map();
  const applies = kb.measures.filter((m) => kb.inSystem(m, system) && kb.requireFactor(m, ctx) > 0);
  const base = (name) => {
    if (name.startsWith('ctx.')) return ctx[name.slice(4)] ?? null;
    if (blocked.has(name)) return null;
    if (name in read) return read[name];
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
      // First true condition wins. When an earlier condition can't be judged (a reference left blank), the
      // bare 'true' catch-all doesn't fire: no verdict, rather than a "normal" nobody checked.
      let state = null, unsure = false;
      for (const [s, cond] of m.states || []) {
        const r = evaluate(cond, env);
        if (r === true) { if (!(unsure && String(cond).trim() === 'true')) state = s; break; }
        if (r === null) unsure = true;
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
  return { results: [...results.values()], findings, vals };
}

// First and Second Law thermodynamic conservation checks on raw readings.
// Catches impossible sensor combinations before the tech chases a non-existent equipment fault.
// Each warning is {title, msg, ids}: `ids` are the readings that can't all be right. computeMeasures
// leaves those out of the diagnosis; a warning with no ids (a plus-sign draft, mixed air outside the
// pair) can be a real fault, so it is shown and the readings still count.
export const SANITY_INPUTS = ['vc.air_in_f', 'vc.air_in_wb', 'vc.suction_line_f', 'vc.suction_psig', 'vc.air_out_f',
  'vc.ambient_f', 'vc.liquid_line_f', 'vc.liquid_psig', 'ahu.oat_f', 'ahu.rat_f', 'ahu.mat_f', 'blr.br_draft_inwc', 'blr.of_draft_inwc'];
export const SANITY_MEASURES = ['vc.evap_sat_t', 'vc.cond_sat_t'];

export function checkSanity(inputs, vals = {}) {
  const w = [];
  const T = 'Thermodynamic sanity check.';
  const LEFT = ' Those readings are left out of the diagnosis until they agree.';
  const g = (k) => { const v = num(inputs?.[k]); return v !== null ? v : (k in vals ? vals[k] : null); };
  const f1 = (v) => String(Math.round(v * 10) / 10);
  // 1. Psychrometric law: wet-bulb cannot exceed dry-bulb
  const db = g('vc.air_in_f');
  const wb = g('vc.air_in_wb');
  if (db !== null && wb !== null && wb > db + 0.5) {
    w.push({ title: T, ids: ['vc.air_in_f', 'vc.air_in_wb'], msg: `Psychrometric check: wet-bulb (${f1(wb)} °F) cannot exceed dry-bulb (${f1(db)} °F) — check thermometer calibration or dry sock.${LEFT}` });
  }
  // 2. Second Law at evaporator: suction line cannot be colder than boiling refrigerant, nor supply air colder than coil
  const evapSat = g('vc.evap_sat_t');
  const sucLine = g('vc.suction_line_f');
  if (evapSat !== null && sucLine !== null && sucLine < evapSat - 2.0) {
    w.push({ title: T, ids: ['vc.suction_line_f', 'vc.suction_psig'], msg: `Thermodynamic check: suction line (${f1(sucLine)} °F) reads colder than evaporator saturation (${f1(evapSat)} °F) — check low-side gauge zero, pipe probe contact, or whether ${active.refrigerant || 'the selected refrigerant'} is right.${LEFT}` });
  }
  const airOut = g('vc.air_out_f');
  if (evapSat !== null && airOut !== null && airOut < evapSat - 1.5) {
    w.push({ title: T, ids: ['vc.air_out_f', 'vc.suction_psig'], msg: `Second-law check: supply air (${f1(airOut)} °F) cannot leave colder than the evaporator saturation (${f1(evapSat)} °F).${LEFT}` });
  }
  // 3. Second Law at condenser: condensing saturation must be above ambient air to reject heat (or the
  // compressor is off: shown, not left out), and liquid line cannot exceed condensing sat
  const condSat = g('vc.cond_sat_t');
  const amb = g('vc.ambient_f');
  if (condSat !== null && amb !== null && condSat < amb - 1.5) {
    w.push({ title: T, ids: [], msg: `Second-law check: condensing saturation (${f1(condSat)} °F) is below condenser inlet air (${f1(amb)} °F) — compressor not running, wrong refrigerant selected, or high-side gauge off.` });
  }
  const liqLine = g('vc.liquid_line_f');
  const condDew = active.refrigerant ? calc.tsat(active.refrigerant, g('vc.liquid_psig'), 'dew') : condSat;
  const condTop = Math.max(condSat ?? -999, condDew ?? -999);
  if (condTop > -500 && liqLine !== null && liqLine > condTop + 2.5) {
    w.push({ title: T, ids: ['vc.liquid_line_f', 'vc.liquid_psig'], msg: `Thermodynamic check: liquid line (${f1(liqLine)} °F) reads hotter than condensing saturation (${f1(condTop)} °F) — shade the pipe probe from sun/discharge air or check high-side gauge.${LEFT}` });
  }
  // 4. Mixing-box energy conservation (NIST APAR Rules 26-27): mixed air must lie between outdoor and return air
  const oa = g('ahu.oat_f'), ra = g('ahu.rat_f'), ma = g('ahu.mat_f');
  if (oa !== null && ra !== null && ma !== null) {
    const lo = Math.min(oa, ra) - 3.0, hi = Math.max(oa, ra) + 3.0;
    if (ma < lo || ma > hi) {
      w.push({ title: T, ids: [], msg: `Energy-balance check (APAR Rules 26–27): mixed air (${f1(ma)} °F) is outside the outdoor/return range (${f1(oa)}–${f1(ra)} °F) — severe air stratification or a drifted mixed-air sensor.` });
    }
  }
  // 5. Draft sign: draft is negative pressure. A plus number means the flue is pushing back.
  for (const [k, label] of [['blr.br_draft_inwc', 'Breech draft'], ['blr.of_draft_inwc', 'Over-fire draft']]) {
    const d = g(k);
    if (d !== null && d > 0.015) {
      w.push({ title: T, ids: [], msg: `${label} entered as +${d} in. w.c. — a plus sign means positive pressure (flue pushing back), not draft. If the gauge read "draft ${d}", enter -${d}.` });
    }
  }
  // 6. A gauge pressure the refrigerant's PT table can't place (past the critical point, or colder than −60 °F)
  if (active.refrigerant && calc.refInfo(active.refrigerant)) {
    for (const [k, label] of [['vc.suction_psig', 'Suction pressure'], ['vc.liquid_psig', 'Liquid / high-side pressure']]) {
      const p = g(k);
      if (p !== null && calc.tsat(active.refrigerant, p, 'dew') === null && calc.tsat(active.refrigerant, p, 'bubble') === null) {
        w.push({ title: 'Reading not used.', ids: [k], msg: `${label} ${f1(p)} psig is outside the ${active.refrigerant} PT table (−60 °F up to its critical point) — check the gauge and the refrigerant picked.` });
      }
    }
  }
  return w;
}
