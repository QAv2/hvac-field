// Input robustness: what a cold, gloved tech might type into the search box, the readings and the
// calculators. Nothing may throw, give NaN, or turn garbage into a finding. Run after the build:
//   node tools/fuzz.mjs            fixed regression cases + a seeded random sweep
//   node tools/fuzz.mjs --quiet    only failures and the summary
//   node tools/fuzz.mjs --seed 7 --rounds 2000
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KB } from '../docs/js/kb.js';
import { diagnose } from '../docs/js/engine.js';
import { computeMeasures, checkSanity, SANITY_INPUTS, SANITY_MEASURES } from '../docs/js/measure.js';
import { Search } from '../docs/js/search.js';
import { compute as computeTool, TOOL_LIST } from '../docs/js/tools.js';
import * as calc from '../docs/js/calcs.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const QUIET = args.includes('--quiet');
const SEED = opt('--seed', 1), ROUNDS = opt('--rounds', 600);
const data = (f) => JSON.parse(readFileSync(join(ROOT, 'docs/data', f), 'utf8'));
calc.setData({ pt: data('pt.json'), glycol: data('glycol.json'), charging: data('charging.json') });
const kb = new KB(data('kb.json'));
const search = new Search(kb);
const problems = [];
let checks = 0;
const say = (...a) => { if (!QUIET) console.log(...a); };
const expect = (cond, msg) => { checks++; if (!cond) problems.push(msg); };
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const near = (a, b, tol) => fin(a) && Math.abs(a - b) <= tol;
// every number anywhere in a result is finite (null is fine)
const clean = (x, path = '') => {
  if (x === null || x === undefined || typeof x === 'string' || typeof x === 'boolean') return [];
  if (typeof x === 'number') return Number.isFinite(x) ? [] : [`${path || 'value'} = ${x}`];
  if (Array.isArray(x)) return x.flatMap((v, i) => clean(v, `${path}[${i}]`));
  if (typeof x === 'object') return Object.entries(x).flatMap(([k, v]) => clean(v, path ? `${path}.${k}` : k));
  return [];
};
const tryRun = (label, fn) => { try { return fn(); } catch (e) { problems.push(`${label}: threw ${e.message}`); return undefined; } };

// seeded random (mulberry32)
let s0 = SEED >>> 0;
const rnd = () => { s0 = (s0 + 0x6d2b79f5) >>> 0; let t = s0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const GARBAGE = ['', ' ', 'abc', 'NaN', 'Infinity', '-Infinity', 'undefined', 'null', '1e9', '-1e9', '1e400', '0x10', '118.4.2',
  '..', '-', '+', ',', '😀', '🔥🧊', '٣', '１２', '½', '40 V', '40 kg', '<script>', '"', "'", '\\', '\u0000', '９９', 'x'.repeat(5000),
  '1'.repeat(400), '-0', '00000', '+-5', '--5', '5-', '5 5', '1/2', '3+4', '(5)', '$5'];
const NUMBERS = ['0', '-0', '1', '-1', '0.5', '.5', '5.', '40', '-40', '−40', '– 40', '118', '118 psig', '8,1 bar', '815 kPa',
  '4,5', '1,234', '24,000', '70°F', '70 F', '70º', '21°C', '21 C', '100', '101', '150', '-150', '999', '2999', '3001', '-14.7',
  '-15', '29.9', '5 in. Hg', '480 V', '12 A', '35 µF', '35 mfd', '60 Hz', '1500 ft', '450 m', '0.04', '-0.04', '+0.02', '250 Pa'];

// ---------------------------------------------------------------- 1. reading parser (bugs found by this file)
say('\nreadings: typed forms');
const READS = [
  // [typed, unit, want (null = refused), tolerance]
  ['118', 'psig', 118], ['118 psig', 'psig', 118], ['118psi', 'psig', 118], ['  118  ', 'psig', 118], ['+118', 'psig', 118],
  ['8,1 bar', 'psig', 117.48, 0.05],        // was read as 8.1 psig → "evaporator very cold, superheat high"
  ['815 kPa', 'psig', 118.2, 0.05],         // was read as 815 psig
  ['0.81 MPa', 'psig', 117.5, 0.1],
  ['132.7 psia', 'psig', 118.0, 0.05],
  ['5 in. Hg', 'psig', -2.456, 0.01], ['10"hg', 'psig', -4.91, 0.01],
  ['1,234.5', 'psig', 1234.5],              // was 1.234
  ['24,000', 'Btu/h', 24000],               // was 24 Btu/h in the flow calculator
  ['24k', 'Btu/h', 24000], ['2 tons', 'Btu/h', 24000], ['60 MBH', 'Btu/h', 60000],
  ['4,5', '°F', 4.5], ['40,25', '°F', 40.25],
  ['−40', '°F', -40],                       // typographic minus was silently dropped
  ['– 40 °F', '°F', -40], ['-40', '°F', -40], ['40º', '°F', 40], ['40°F', '°F', 40], ['40 deg F', '°F', 40], ['40 F', '°F', 40],
  ['4°C', '°F', null],                      // was read as 4 °F
  ['40C', '°F', null], ['21 celsius', '°F', null],
  ['118.4.2', 'psig', null],                // was 118.4
  ['1e9', 'psig', null], ['-1e9', 'psig', null], ['Infinity', 'psig', null], ['NaN', '°F', null],
  ['40 V', 'psig', null], ['40 kg', '°F', null], ['😀', '°F', null], ['', '°F', null], ['abc', 'A', null],
  ['-20', 'psig', null],                    // below a perfect vacuum
  ['150', '% RH', null], ['-5', '% RH', null], ['101', '%', null],
  ['-500', '°F', null],                     // below absolute zero
  ['-12', 'A', null], ['-480', 'V', null], ['10', '0–9', null], ['31', 'in. Hg', null],
  ['12 kΩ', 'Ω', 12000], ['35 mfd', 'µF', 35], ['35uF', 'µF', 35], ['250 Pa', 'in. w.c.', 1.004, 0.002], ['450 m', 'ft', 1476.4, 0.1],
  ['-0.04', 'in. w.c.', -0.04], ['480V', 'V', 480], ['3 ph', 'phases', 3],
];
for (const [typed, unit, want, tol = 1e-9] of READS) {
  const r = tryRun(`readValue(${JSON.stringify(typed)}, ${unit})`, () => calc.readValue(typed, unit));
  if (!r) continue;
  if (want === null) expect(r.v === null, `"${typed}" in a ${unit} box should be refused, got ${r.v}`);
  else expect(near(r.v, want, tol), `"${typed}" in a ${unit} box should read ${want}, got ${r.v} (${r.note})`);
  if (r.v === null && typed.trim()) expect(Boolean(r.note), `"${typed}" in a ${unit} box is refused without saying why`);
}
for (const g of GARBAGE) for (const unit of ['°F', 'psig', '%', 'A', '']) {
  const r = tryRun(`readValue(${JSON.stringify(g.slice(0, 20))})`, () => calc.readValue(g, unit));
  expect(r && (r.v === null || fin(r.v)), `readValue(${JSON.stringify(g.slice(0, 20))}, ${unit}) gave ${r?.v}`);
}

// ---------------------------------------------------------------- 2. readings → findings
say('readings: garbage never becomes a finding');
const REFS = { 'vc.ac': 'R-410A', 'vc.hp': 'R-410A', 'vc.walkin': 'R-404A', 'vc.reachin': 'R-134a', 'vc.ice': 'R-404A' };
const leaf = [...kb.systems.values()].filter((s) => !s.abstract).map((s) => s.id);
const ctxFor = (sys) => ({ ...kb.defaultCtx(sys), ...(REFS[sys] ? { refrigerant: REFS[sys] } : {}) });
const keyOf = (f) => JSON.stringify(Object.entries(f).map(([k, v]) => [k, v.s]).sort());
for (const sys of leaf) {
  const ctx = ctxFor(sys);
  const base = keyOf(computeMeasures(kb, sys, ctx, {}).findings);
  for (const inp of kb.inputs.values()) {
    if (!kb.inSystem(inp, sys)) continue;
    for (const g of ['abc', '😀', '1e9', '-1e9', 'NaN', '118.4.2', '40 kg', 'x'.repeat(300)]) {
      const m = tryRun(`${sys} ${inp.id}=${g.slice(0, 12)}`, () => computeMeasures(kb, sys, ctx, { [inp.id]: g }));
      if (!m) continue;
      expect(keyOf(m.findings) === base, `${sys}: ${inp.id} = "${g.slice(0, 12)}" changed the findings (${keyOf(m.findings)})`);
      expect(m.sanity.some((w) => (w.ids || []).includes(inp.id)), `${sys}: ${inp.id} = "${g.slice(0, 12)}" was dropped without a warning`);
    }
  }
}

// regression: the cases that were wrong before
{
  const ctx = { ...kb.defaultCtx('vc.ac'), refrigerant: 'R-410A' };
  const m1 = computeMeasures(kb, 'vc.ac', ctx, { 'vc.suction_psig': '8,1 bar', 'vc.suction_line_f': '50' });
  expect(m1.findings['vc.superheat']?.s === 'normal' && near(m1.findings['vc.superheat'].v, 10.4, 0.3),
    `8,1 bar suction with a 50 °F line should be ~10 °F superheat, got ${JSON.stringify(m1.findings['vc.superheat'])}`);
  const m2 = computeMeasures(kb, 'vc.ac', ctx, { 'vc.suction_psig': '118', 'vc.suction_line_f': '4°C' });
  expect(!m2.findings['vc.superheat'], `a °C line temperature in a °F box gave superheat ${JSON.stringify(m2.findings['vc.superheat'])}`);
  // wet bulb above dry bulb: warned AND left out, so no humidity-based verdict is built on it
  const m3 = computeMeasures(kb, 'vc.ac', ctx, { 'vc.air_in_f': '75', 'vc.air_in_wb': '80', 'vc.air_out_f': '58' });
  const m3ok = computeMeasures(kb, 'vc.ac', ctx, { 'vc.air_out_f': '58' });
  expect(m3.sanity.some((w) => /wet-bulb/.test(w.msg)), 'wet bulb above dry bulb not flagged');
  expect(keyOf(m3.findings) === keyOf(m3ok.findings), `wet bulb above dry bulb still produced findings: ${keyOf(m3.findings)}`);
  // suction line colder than the refrigerant boiling in it: superheat −80 °F was "low superheat"
  const m4 = computeMeasures(kb, 'vc.ac', ctx, { 'vc.suction_psig': '118', 'vc.suction_line_f': '-40' });
  expect(!m4.findings['vc.superheat'], `−80 °F superheat became a finding: ${JSON.stringify(m4.findings['vc.superheat'])}`);
  expect(m4.sanity.some((w) => /suction line/.test(w.msg)), 'suction line colder than saturation not flagged');
  // the mixed-air rule named inputs that don't exist (ahu.oa_f/ra_f/ma_f) and never fired
  const m5 = computeMeasures(kb, 'ahu', { ...kb.defaultCtx('ahu'), oa_type: 'mixed' }, { 'ahu.oat_f': '10', 'ahu.rat_f': '70', 'ahu.mat_f': '85' });
  expect(m5.sanity.some((w) => /APAR/.test(w.msg)), 'mixed air outside the outdoor/return pair not flagged');
  for (const id of SANITY_INPUTS) expect(kb.inputs.has(id), `checkSanity reads ${id}, which is not an input`);
  for (const id of SANITY_MEASURES) expect(kb.measures.some((m) => m.id === id), `checkSanity reads ${id}, which is not a measure`);
  // a pressure past the PT table (here: above R-410A's critical point) is said, not silently ignored
  const m6 = computeMeasures(kb, 'vc.ac', ctx, { 'vc.liquid_psig': '1234.5' });
  expect(m6.sanity.some((w) => /PT table/.test(w.msg)), 'liquid pressure past the PT table not flagged');
  // still: real readings work, and the standalone checkSanity still takes plain numbers
  expect(checkSanity({ 'vc.air_in_f': 75, 'vc.air_in_wb': 80 }).length === 1, 'checkSanity on plain numbers');
}

// ---------------------------------------------------------------- 3. calculators
say('calculators: no NaN, no throw');
const SPECIAL = [null, undefined, NaN, Infinity, -Infinity, 0, -0, -1, -40, -459.67, -1000, 1e9, -1e9, 1e300, 0.001, 50, 100, 101, 400, '40', 'abc'];
const CALLS = {
  psat: (a, b) => calc.psat('R-410A', a, 'dew', b), tsat: (a, b) => calc.tsat('R-404A', a, 'bubble', b),
  psatMid: (a) => calc.psat('R-407C', a, 'mid'), tsatUnknownRef: (a) => calc.tsat('R-999', a),
  clausius: (a, b) => calc.clausiusTsat(calc.clausiusFit(a, b, 100, 317.6), 118), clausiusP: (a) => calc.clausiusPsat(calc.clausiusFit(0, 48.3, 100, 317.6), a),
  patmFromElev: (a) => calc.patmFromElev(a), pws: (a) => calc.pws(a), wFromWb: (a, b) => calc.wFromWb(a, b),
  wFromRh: (a, b) => calc.wFromRh(a, b), dewpoint: (a, b) => calc.dewpoint(a, b), wetbulb: (a, b) => calc.wetbulb(a, b),
  rhFromWb: (a, b) => calc.rhFromWb(a, b), wetbulbAlt: (a, b) => calc.wetbulb(a, 50, calc.patmFromElev(b)),
  foTargetSh: (a, b) => calc.foTargetSh(a, b), splitTarget: (a, b) => calc.splitTarget(a, b),
  glycolFreeze: (a) => calc.glycolFreeze(a, 'PG'), glycolPctFor: (a) => calc.glycolPctFor(a, 'EG'),
  combustion: (a, b) => calc.combustion({ stackF: a, airF: 70, o2: b, co: a }), gpm: (a, b) => calc.gpm(a, b), cfm: (a, b) => calc.cfm(a, b),
  affinity: (a, b) => calc.affinityLaws({ flow1: a, speed1: b, dp1: a, bhp1: b, speed2: 1200 }),
  threePhase: (a, b) => calc.threePhase({ v1: a, v2: b, v3: 470, i1: a, i2: b, i3: 10 }), cap: (a, b) => calc.capUnderLoad(a, b),
};
for (const [name, fn] of Object.entries(CALLS)) {
  for (const a of SPECIAL) for (const b of [undefined, ...SPECIAL.slice(0, 12)]) {
    const r = tryRun(`${name}(${a}, ${b})`, () => fn(a, b));
    const bad = clean(r);
    expect(!bad.length, `${name}(${a}, ${b}) → ${bad.join(', ')}`);
  }
}
// regression: confident numbers that were garbage
expect(calc.rhFromWb(80, 85) === null, `RH from a wet bulb above the dry bulb should be null, got ${calc.rhFromWb(80, 85)}`);
expect(calc.dewpoint(80, 150) === null, `dew point at 150 % RH should be null, got ${calc.dewpoint(80, 150)}`);
expect(calc.wetbulb(80, 150) === null, `wet bulb at 150 % RH should be null, got ${calc.wetbulb(80, 150)}`);
expect(calc.combustion({ stackF: 60, airF: 70, o2: 5 }) === null, 'a flue cooler than the room gave an efficiency');
expect(calc.combustion({ stackF: 400, airF: 70, o2: 21 }) === null, 'O2 at room air gave an efficiency');
expect(calc.capUnderLoad(-5, 370) === null, 'negative amps gave a capacitance');
expect(calc.patmFromElev(NaN) === calc.P_ATM, 'unknown elevation is sea level');
expect(calc.foTargetSh(NaN, 95) === null && calc.foTargetSh(1e9, 95) === null, 'target superheat from a nonsense wet bulb');
expect(near(calc.gpm(24000, -10), 4.8, 1e-9), 'GPM from a ΔT typed the other way round');

for (const t of TOOL_LIST) {
  const keys = ['ref', 'elev', 'temp', 'psig', 'inhg', 't1', 'p1', 't2', 'p2', 'sp', 'st', 'lp', 'lt', 'iwb', 'odb', 'idb', 'irh', 'db', 'rh', 'wb',
    'sa', 'type', 'pct', 'fp', 'stack', 'air', 'o2', 'co', 'btuh', 'dt', 'fluid', 'q1', 'n1', 'n2', 'q2', 'dp1', 'bhp1', 'v1', 'v2', 'v3', 'i1', 'i2', 'i3', 'cap_a', 'cap_v', 'hz'];
  for (let r = 0; r < 300; r++) {
    const v = {};
    for (const k of keys) {
      if (rnd() < 0.4) continue;
      v[k] = k === 'ref' ? pick(['R-410A', 'R-22', 'R-404A', 'R-134a', 'CUSTOM', 'R-999', '']) : k === 'type' ? pick(['EG', 'PG', ''])
        : pick([null, ...SPECIAL.filter((x) => typeof x === 'number'), ...[-40, 0, 20, 40, 75, 95, 118, 300, 470].map((x) => x + rnd())]);
    }
    const html = tryRun(`calculator ${t.id}`, () => computeTool(t.id, v));
    expect(typeof html === 'string' && !/NaN|Infinity|undefined/.test(html), `calculator ${t.id} with ${JSON.stringify(v)} shows ${String(html).match(/.{0,40}(NaN|Infinity|undefined).{0,20}/)?.[0]}`);
  }
}

// ---------------------------------------------------------------- 4. search
say('search: odd text');
const TEXTS = ['', '   ', '\n\n', ',,,;;;', '😀😀🔥', '🔥 coil iced 🧊', 'asdf qwerty zxcv', '<img src=x onerror=alert(1)>', 'null', 'undefined',
  '%%%', '°°°', '...', 'not not not', 'no', 'NO NO NO', '118 psig', '40°C', '٣٤٥', 'ｃｏｉｌ ｉｃｅｄ', 'çöîl ïcéd', 'coil\u0000iced', '\\', '"\'`'];
// ("-40" alone is a fair way to say it's extreme cold outside on a boiler or air handler, so it isn't in TEXTS)
const SLANG = [['EVAP ICED UP', 'evap iced up'], ['Compressor Short Cycling', 'compressor short cycling'], ['NO HEAT', 'no heat'],
  ['TXV Hunting, HIGH HEAD', 'txv hunting, high head'], ['Walk-In Freezer WARM, Coil Iced, Fans RUNNING', 'walk-in freezer warm, coil iced, fans running'],
  ['Burner LOCKED OUT on reset', 'burner locked out on reset']];
for (const sys of [null, ...leaf]) {
  for (const t of TEXTS) {
    const r = tryRun(`search ${sys} ${JSON.stringify(t)}`, () => search.run(t, sys));
    if (!r) continue;
    expect(!clean(r.picks.map((p) => p.score)).length, `search score not finite for ${JSON.stringify(t)}`);
    if (!/coil|ｃｏｉｌ|çöîl/.test(t)) expect(!r.picks.length, `${sys}: ${JSON.stringify(t)} became findings: ${r.picks.map((p) => `${p.f}=${p.s}`).join(', ')}`);
  }
  for (const [a, b] of SLANG) {
    const ra = search.run(a, sys), rb = search.run(b, sys);
    expect(JSON.stringify(ra.picks.map((p) => [p.f, p.s])) === JSON.stringify(rb.picks.map((p) => [p.f, p.s])), `${sys}: "${a}" and "${b}" read differently`);
  }
}
// long pastes stay fast: a voice-dictated paragraph, or the same words pasted many times
for (const [label, t] of [['50 000 chars of one word', 'a'.repeat(50000)], ['20 000 commas', 'x, '.repeat(20000)],
  ['8 000 real clauses', 'fan not running, coil iced, high head, '.repeat(2700)], ['one 30 000-char clause', 'coil iced '.repeat(3000)]]) {
  const t0 = Date.now();
  const r = tryRun(`search ${label}`, () => search.run(t, 'vc.walkin'));
  const ms = Date.now() - t0;
  expect(r && ms < 1500, `search on ${label} took ${ms} ms`);
  say(`  ${label}: ${ms} ms, ${r?.picks.length} findings`);
}

// ---------------------------------------------------------------- 5. engine with odd findings
say('engine: odd findings');
for (let r = 0; r < ROUNDS; r++) {
  const sys = pick(leaf);
  const feats = [...kb.features.values()].filter((f) => kb.inSystem(f, sys));
  const findings = {};
  for (let k = Math.floor(rnd() * 25); k > 0; k--) {
    const f = pick(feats);
    findings[f.id] = rnd() < 0.9 ? pick(f.stateIds) : pick(['', 'bogus', null, 42, 'HIGH']);
  }
  if (rnd() < 0.2) findings['no.such_feature'] = 'high';
  const inputs = {};
  for (const inp of kb.inputs.values()) if (kb.inSystem(inp, sys) && rnd() < 0.15) inputs[inp.id] = pick([...NUMBERS, ...GARBAGE.slice(0, 20)]);
  const ctx = ctxFor(sys);
  const m = tryRun(`computeMeasures round ${r}`, () => computeMeasures(kb, sys, ctx, inputs));
  if (!m) continue;
  expect(!clean(m.findings).length && !clean(m.results.map((x) => x.v)).length, `round ${r}: measures not finite ${clean(m.findings)}`);
  for (const [fid, x] of Object.entries(m.findings)) expect(kb.features.get(fid)?.idx[x.s] !== undefined, `round ${r}: ${fid} set to unknown state ${x.s}`);
  const all = { ...Object.fromEntries(Object.entries(m.findings).map(([k, x]) => [k, x.s])), ...findings };
  const res = tryRun(`diagnose round ${r}`, () => diagnose(kb, { system: sys, ctx, findings: all }));
  if (!res) continue;
  const sum = res.post.reduce((a, x) => a + x.p, 0);
  expect(res.post.every((x) => fin(x.p) && x.p >= 0) && Math.abs(sum - 1) < 1e-6, `round ${r} (${sys}): probabilities not a distribution (sum ${sum})`);
  expect(res.next.every((n) => all[n.id] === undefined), `round ${r} (${sys}): next check already answered`);
  expect(res.next.every((n) => fin(n.score)), `round ${r} (${sys}): next-check score not finite`);
}

console.log(`\nfuzz: ${checks} checks, seed ${SEED}, ${ROUNDS} random rounds`);
if (problems.length) {
  const uniq = [...new Set(problems)];
  console.log(`\n${uniq.length} problem(s):`);
  for (const p of uniq.slice(0, 60)) console.log('  ✗', p);
  if (uniq.length > 60) console.log(`  … and ${uniq.length - 60} more`);
  process.exit(1);
}
console.log('OK');
