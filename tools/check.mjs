// Deep checks and tests for the knowledge base. Run after `python3 tools/build.py`:
//   node tools/check.mjs                 everything
//   node tools/check.mjs --module boiler-oil.yaml   self-tests only for that file's causes
//   node tools/check.mjs --quiet         only failures and the summary
//   node tools/check.mjs --kb .lane/blr/kb.json --scenarios .lane/blr/scenarios.json --module boiler-oil.yaml
// Checks: every sign compiles; every expression parses and names only things that exist; the
// calculators agree with reference values; every scenario lands; every cause can be recognized
// from its own signature; no two causes in a system are impossible to tell apart.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KB, signDist } from '../docs/js/kb.js';
import { diagnose, prepare, posterior } from '../docs/js/engine.js';
import { refs, knownFunction } from '../docs/js/expr.js';
import { computeMeasures, checkSanity } from '../docs/js/measure.js';
import * as calc from '../docs/js/calcs.js';
import { Search } from '../docs/js/search.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const QUIET = args.includes('--quiet');
const ONLY = opt('--module');

const raw = JSON.parse(readFileSync(opt('--kb') || join(ROOT, 'docs/data/kb.json'), 'utf8'));
calc.setData({ pt: JSON.parse(readFileSync(join(ROOT, 'docs/data/pt.json'), 'utf8')),
  glycol: JSON.parse(readFileSync(join(ROOT, 'docs/data/glycol.json'), 'utf8')),
  charging: JSON.parse(readFileSync(join(ROOT, 'docs/data/charging.json'), 'utf8')) });
const kb = new KB(raw);
const problems = [];
const warn = [];
const say = (...a) => { if (!QUIET) console.log(...a); };

// 1. signs compile
for (const c of kb.causes) {
  const all = [['signs', c.signs || {}], ...(c.when || []).map((w, i) => [`when[${i}]`, w.signs || {}])];
  for (const [label, signs] of all) {
    for (const [fid, spec] of Object.entries(signs)) {
      try { signDist(kb.features.get(fid), spec); } catch (e) { problems.push(`${c.module} [${c.id}] ${label}.${fid}: ${e.message}`); }
    }
  }
  // a cause whose signs only touch features outside its own systems can never be scored
  for (const fid of Object.keys(c.signs || {})) {
    const f = kb.features.get(fid);
    if (f && !(c.systems || []).some((s) => s === '*' || kb.inSystem(f, s))) {
      problems.push(`${c.module} [${c.id}] signs.${fid}: that feature never applies to this cause's systems (${(c.systems || []).join(', ')})`);
    }
  }
}

// 2. expressions parse and refer to real things
const ctxIds = new Set(kb.context.keys());
const measureIds = new Set(kb.measures.map((m) => m.id));
for (const m of kb.measures) {
  const exprs = [['value', m.value], ['target', m.target], ...Object.entries(m.let || {}).map(([k, e]) => [`let.${k}`, e]),
    ...(m.states || []).map(([s, e]) => [`states.${s}`, e])];
  const local = new Set([...Object.keys(m.let || {}), 'v', 't']);
  for (const [label, src] of exprs) {
    if (src === undefined || src === null) continue;
    try {
      const r = refs(String(src));
      for (const id of r.ids) {
        if (local.has(id) || kb.inputs.has(id) || measureIds.has(id)) continue;
        if (id.startsWith('ctx.') && ctxIds.has(id.slice(4))) continue;
        problems.push(`${m.module} [${m.id}] ${label}: unknown name "${id}"`);
      }
      for (const f of r.fns) if (!knownFunction(f)) problems.push(`${m.module} [${m.id}] ${label}: unknown function ${f}()`);
    } catch (e) {
      problems.push(`${m.module} [${m.id}] ${label}: ${e.message}`);
    }
  }
}

// 3. calculators against reference values
const near = (a, b, tol) => a !== null && Math.abs(a - b) <= tol;
const calcCases = [
  ['pws(68 °F) psia', calc.pws(68), 0.3393, 0.002],
  ['wet bulb 80 °F / 51.1 %', calc.wetbulb(80, 51.1), 67.0, 0.3],
  ['dew point 80 °F / 51.1 %', calc.dewpoint(80, 51.1), 60.3, 0.4],
  ['RH from 80/67', calc.rhFromWb(80, 67), 51.1, 0.8],
  ['R-410A dew @118.4 psig', calc.tsat('R-410A', 118.4, 'dew'), 40, 0.1],
  ['R-22 @40 °F psig', calc.psat('R-22', 40), 68.6, 0.2],
  ['R-134a @100 °F psig', calc.psat('R-134a', 100), 124.1, 0.6],
  ['R-404A @-20 °F dew psig (Arkema vapor 16.0)', calc.psat('R-404A', -20, 'dew'), 16.0, 0.6],
  ['fixed-orifice target 67 WB / 95 OD (RD-2: 12.0)', calc.foTargetSh(67, 95), 12.0, 0.01],
  ['fixed-orifice target 62.5 WB / 85.5 OD (RD-2 bilinear)', calc.foTargetSh(62.5, 85.5), (8.5 + 10.3 + 7.8 + 9.6) / 4, 0.01],
  ['target split 80 DB / 67 WB (RD-3: 18.3)', calc.splitTarget(80, 67), 18.3, 0.01],
  ['fixed-orifice target outside table → formula', calc.foTargetSh(67, 120), (3 * 67 - 80 - 120) / 2 < 5 ? 5 : (3 * 67 - 80 - 120) / 2, 0.01],
  ['EG 50 wt % freeze °F (Dow SR-1: −28.9)', calc.glycolFreeze(50, 'EG'), -28.9, 0.5],
  ['oil 400 net stack @ 4.7 % O2 eff (US chart ≈ 83.5)', calc.combustion({ stackF: 470, airF: 70, o2: 4.7 }).eff, 83.5, 1.0],
  ['patmFromElev(5280 ft Denver) psia', calc.patmFromElev(5280), 12.1, 0.1],
  ['Clausius-Clapeyron R-410A 0/100°F → 40°F psig', calc.clausiusPsat(calc.clausiusFit(0, 48.3, 100, 317.6), 40), 118.4, 2.5],
  ['Clausius-Clapeyron R-410A 0/100°F → 118.4 psig °F', calc.clausiusTsat(calc.clausiusFit(0, 48.3, 100, 317.6), 118.4), 40.0, 0.8],
  ['Affinity laws 1.2x speed → SP ratio', calc.affinityLaws({ flow1: 1000, dp1: 1.0, bhp1: 2.0, speed1: 1000, speed2: 1200 }).dp2, 1.44, 0.01],
  ['Affinity laws 1.2x speed → BHP ratio', calc.affinityLaws({ flow1: 1000, dp1: 1.0, bhp1: 2.0, speed1: 1000, speed2: 1200 }).bhp2, 3.456, 0.01],
  ['3-phase voltage unbalance 460/480/470 %', calc.threePhase({ v1: 460, v2: 480, v3: 470 }).vUnbal, 2.13, 0.05],
  ['Live capacitor 4.52A @ 370V 60Hz µF', calc.capUnderLoad(4.52, 370, 60), 32.4, 0.2],
  ['Sanity check: wet bulb > dry bulb flagged', checkSanity({ 'vc.air_in_f': 75, 'vc.air_in_wb': 80 }, {}).length, 1, 0],
  ['3-phase 3 % unbalance derate (MG-1 0.88)', calc.threePhase({ v1: 466.9, v2: 466.9, v3: 446.2 })?.derate, 0.88, 0.006],
  ['3-phase 3 % unbalance value', calc.threePhase({ v1: 466.9, v2: 466.9, v3: 446.2 })?.vUnbal, 3.0, 0.05],
  ['3-phase 4.1 % unbalance derate (MG-1 ≈0.81)', calc.threePhase({ v1: 466, v2: 466, v3: 438 })?.derate, 0.814, 0.006],
  ['capacitor under load 5 A at 370 V (µF)', calc.capUnderLoad(5, 370), 35.85, 0.05],
  ['R-410A 40 °F dew at 9,300 ft (gauge reads higher)', calc.psat('R-410A', 40, 'dew', calc.patmFromElev(9300)), 118.4 + (14.696 - calc.patmFromElev(9300)), 0.05],
  ['Clausius 2-point fit (R-410A 20/100 °F) at 60 °F', calc.clausiusTsat(calc.clausiusFit(20, calc.psat('R-410A', 20), 100, calc.psat('R-410A', 100)), calc.psat('R-410A', 60)), 60, 1.5],
];
for (const [label, got, want, tol] of calcCases) {
  if (!near(got, want, tol)) problems.push(`calc ${label}: got ${got}, want ${want} ± ${tol}`);
}

// 4. scenarios
let scen = [];
try { scen = JSON.parse(readFileSync(opt('--scenarios') || join(ROOT, 'tests/scenarios.json'), 'utf8')); } catch { /* none yet */ }
let pass = 0;
for (const sc of scen) {
  const ctx = { ...kb.defaultCtx(sc.system), ...(sc.ctx || {}) };
  const measured = computeMeasures(kb, sc.system, ctx, sc.inputs || {});
  const findings = { ...Object.fromEntries(Object.entries(measured.findings).map(([k, v]) => [k, v.s])), ...(sc.findings || {}) };
  let res;
  try { res = diagnose(kb, { system: sc.system, ctx, findings }, { skip: sc.skip }); } catch (e) { problems.push(`scenario "${sc.name}": ${e.message}`); continue; }
  const ids = res.post.map((r) => r.id);
  const top3 = ids.slice(0, 3);
  const fails = [];
  const ex = sc.expect || {};
  if (ex.top && ids[0] !== ex.top) fails.push(`top is ${ids[0]}, want ${ex.top} (rank ${ids.indexOf(ex.top) + 1})`);
  for (const id of ex.top3 || []) if (!top3.includes(id)) fails.push(`${id} not in top 3 (rank ${ids.indexOf(id) + 1})`);
  for (const id of ex.not_top || []) if (ids[0] === id) fails.push(`${id} should not be top`);
  for (const id of ex.not_top3 || []) if (top3.includes(id)) fails.push(`${id} should not be in the top 3 (rank ${ids.indexOf(id) + 1})`);
  if (ex.next_any && !res.next.slice(0, 3).some((n) => ex.next_any.includes(n.id))) fails.push(`next checks ${res.next.slice(0, 3).map((n) => n.id).join(', ')} include none of ${ex.next_any.join(', ')}`);
  for (const fid of ex.unmeasured || []) if (measured.findings[fid]) fails.push(`measured ${fid} = ${measured.findings[fid].s}, want no verdict (a reference is blank)`);
  // engine edge cases (tests/scenarios/engine.yaml)
  for (const id of ex.next_not || []) if (res.next.some((n) => n.id === id)) fails.push(`next checks include ${id}`);
  if (ex.next_min !== undefined && res.next.length < ex.next_min) fails.push(`only ${res.next.length} next check(s), want at least ${ex.next_min}`);
  if (ex.fit && (res.fit?.ok ? 'good' : 'poor') !== ex.fit) fails.push(`fit is ${res.fit?.ok ? 'good' : 'poor'} (${(res.fit?.misses || []).map((x) => `${x.f}=${x.s}`).join(', ')}), want ${ex.fit}`);
  if (ex.top_p_max !== undefined && res.post[0].p > ex.top_p_max) fails.push(`top at ${(res.post[0].p * 100).toFixed(0)}%, want at most ${ex.top_p_max * 100}%`);
  if (ex.tied) {
    const ps = ex.tied.map((id) => res.post.find((r) => r.id === id)?.p);
    const at = ex.tied.map((id) => ids.indexOf(id));
    if (ps.some((x) => x === undefined || Math.abs(x - ps[0]) > 1e-12)) fails.push(`${ex.tied.join(', ')} should tie, got ${ps.map((x) => x?.toFixed(4)).join(', ')}`);
    else if (at.some((x, i) => i && x !== at[i - 1] + 1)) fails.push(`tied causes should sit together in knowledge-base order, got ranks ${at.map((x) => x + 1).join(', ')}`);
  }
  // always: never suggest a check that's answered (typed or measured) or that the tech skipped
  for (const n of res.next) if (findings[n.id] !== undefined || (sc.skip || []).includes(n.id)) fails.push(`next check ${n.id} is already answered or skipped`);
  for (const [fid, s] of Object.entries(ex.measured || {})) {
    if (measured.findings[fid]?.s !== s) fails.push(`measured ${fid} = ${measured.findings[fid]?.s ?? 'nothing'} (value ${measured.findings[fid]?.v?.toFixed?.(1)}), want ${s}`);
  }
  const line = `${sc.name} → ${res.post.slice(0, 3).map((r) => `${r.id} ${(r.p * 100).toFixed(0)}%`).join(', ')} | next: ${res.next.slice(0, 2).map((n) => n.id).join(', ')}`;
  if (fails.length) problems.push(`scenario (${sc._file}) ${line}\n      ✗ ${fails.join('\n      ✗ ')}`);
  else { pass++; say(`  ✓ ${line}`); }
}

// 4b. typed complaint → the system it should pick first. One module's synonym or keyword can hijack the most
// common calls (a terminal-unit synonym once sent "ac not blowing cold air" to the unit-heater system).
const ROUTES = [
  ['ac not blowing cold air', 'vc.ac'], ['walk in cooler not blowing cold air', 'vc.walkin'],
  ['furnace blowing cold air', 'fuel.furnace'], ['ahu supply air blowing cold', 'ahu'],
  ['heat pump blowing cold air in heat mode', 'vc.hp'], ['walk in freezer warm', 'vc.walkin'],
  ['boiler wont fire', 'fuel.boiler'], ['unit heater blowing cold', 'terminal'], ['fan coil not heating', 'terminal'],
  ['glycol unit heater not heating', 'terminal'], ['electric baseboard not heating', 'terminal'],
];
{
  const search = new Search(kb);
  for (const [text, want] of ROUTES) {
    const got = search.run(text, null).systems[0]?.id;
    if (got !== want) problems.push(`route "${text}" picks ${got}, want ${want}`);
  }
}

// 5. self-recognition and 6. confusable pairs, per selectable system
const leaf = [...kb.systems.values()].filter((s) => !s.abstract);
const shadowed = [], twins = [];
for (const sys of leaf) {
  const model = prepare(kb, sys.id, {});
  const mine = model.causes.filter((c) => c.id !== '_ok' && (!ONLY || c.c.module === ONLY));
  for (const c of mine) {
    const ideal = {};
    for (const [fid, d] of c.dist) {
      const f = kb.features.get(fid);
      let best = 0;
      for (let k = 1; k < d.length; k++) if (d[k] > d[best]) best = k;
      if (d[best] >= 0.55) ideal[fid] = f.stateIds[best];
    }
    const post = posterior(model, ideal);
    const rank = post.findIndex((r) => r.id === c.id) + 1;
    if (rank > 3) shadowed.push(`${sys.id}: ${c.id} ranks ${rank} on its own signature; beaten by ${post.slice(0, 2).map((r) => r.id).join(', ')}`);
  }
  const pool = model.causes.filter((x) => x.id !== '_ok');
  for (const a of mine) {
    for (const b of pool) {
      // each pair once
      if (a === b || (mine.includes(b) && pool.indexOf(b) < pool.indexOf(a))) continue;
      let best = 0;
      for (const fid of new Set([...a.dist.keys(), ...b.dist.keys()])) {
        const f = kb.features.get(fid);
        const da = a.dist.get(fid) || f.silentDist, db = b.dist.get(fid) || f.silentDist;
        let tv = 0;
        for (let k = 0; k < da.length; k++) tv += Math.abs(da[k] - db[k]);
        best = Math.max(best, tv / 2);
      }
      if (best < 0.3) twins.push(`${sys.id}: ${a.id} ≈ ${b.id} (best single check separates them by only ${(best * 100).toFixed(0)}%)`);
    }
  }
}
for (const s of [...new Set(shadowed)]) warn.push(`shadowed — ${s}`);
for (const t of [...new Set(twins)]) warn.push(`twins — ${t}`);

// report
const c = raw.meta?.counts || {};
console.log(`\nKB: ${c.causes} causes · ${c.features} features · ${c.measures} measures · ${leaf.length} systems`);
console.log(`scenarios: ${pass}/${scen.length} pass`);
if (warn.length) {
  console.log(`\n${warn.length} warning(s) (fix these: a cause that can't win on its own signature, or two causes no check can separate):`);
  for (const w of warn) console.log('  ~', w);
}
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log('  ✗', p);
  process.exit(1);
}
console.log(warn.length ? '\nOK with warnings' : '\nOK');
