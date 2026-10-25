// The voice dialog driven with typed transcripts: every check's spoken numbers land on the right answer, cautions
// are read first, speech text has no symbols the phone's voice stumbles on, and a simulated tech answering only by
// number reaches the right cause. Run: node tools/voice_sim.mjs [--verbose]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KB } from '../docs/js/kb.js';
import { diagnose, reading } from '../docs/js/engine.js';
import { Search } from '../docs/js/search.js';
import { checkTurn, interpret, grammar, speakable, JOB_COMMANDS, numberWords, nameWords } from '../docs/js/dialog.js';
import { COMMANDS } from '../docs/js/spoken.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const kb = new KB(JSON.parse(readFileSync(join(ROOT, 'docs/data/kb.json'), 'utf8')));
const search = new Search(kb);
const VERBOSE = process.argv.includes('--verbose');
let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; if (fail <= 40) console.log(`FAIL ${msg}`); } };
const NUM = ['one', 'two', 'three', 'four', 'five', 'six'];
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

// 1. every check, every system that asks it: numbers map to the states in order; caution first; clean speech
const leaves = [...kb.systems.values()].filter((s) => !s.abstract);
for (const f of kb.features.values()) {
  const sys = leaves.find((s) => kb.inSystem(f, s.id))?.id;
  if (!sys) continue;
  const turn = checkTurn(kb, sys, f);
  ok(turn.options.length === f.stateIds.length, `${f.id}: options ${turn.options.length} vs states ${f.stateIds.length}`);
  f.stateIds.forEach((s, i) => {
    for (const w of [NUM[i], ORD[i], `number ${NUM[i]}`]) {
      const a = interpret('check', w, { turn });
      ok(a.do === 'answer' && a.state === s && a.fid === f.id, `${f.id}: "${w}" → ${JSON.stringify(a)}, want state ${s}`);
    }
  });
  ok(interpret('check', NUM[f.stateIds.length] || 'seven', { turn }).do === 'unclear', `${f.id}: a number past the last option is unclear`);
  if (f.caution) ok(turn.lines[0].startsWith('Before you do this:'), `${f.id}: caution is not read first`);
  const g = grammar('check', turn.options);
  ok(g.includes('[unk]') && NUM.slice(0, f.stateIds.length).every((w) => g.includes(w)), `${f.id}: grammar misses its numbers`);
  for (const line of [...turn.lines, turn.how || '']) {
    const bad = line.match(/[°%ΔΩµ≈(){}]|\bpsig\b/);
    ok(!bad, `${f.id}: speech keeps "${bad?.[0]}" in: ${line.slice(0, 90)}`);
  }
  // authored spoken keys (when they exist) must not collide with each other or with a command
  const cl = (x) => String(x).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w && !'uh um er ah okay ok so well its it is the a answer option number say i got'.split(' ').includes(w)).join(' ');
  const cmd = new Set(Object.values({ ...COMMANDS, ...JOB_COMMANDS }).flat().map(cl));
  const keys = turn.options.flatMap((o) => o.keys.map((k) => [cl(k), o.id]));
  for (const [k, id] of keys) {
    ok(!cmd.has(k), `${f.id}: key "${k}" is also a command`);
    ok(keys.filter(([k2, id2]) => k2 === k && id2 !== id).length === 0, `${f.id}: key "${k}" names two answers`);
  }
}

// 2. phrases
const anyTurn = checkTurn(kb, 'vc.walkin', kb.features.get([...kb.features.keys()][0]));
const CASES = [
  ['check', 'what turning one', 'unclear'], ['check', 'two [unk]', 'unclear'], ['check', '', 'unclear'],
  ['check', 'save report', 'command:save'], ['check', 'delete job', 'command:delete'], ['check', 'repeat', 'command:repeat'],
  ['check', "can't check", 'command:skip'], ['check', 'undo', 'command:undo'], ["check", "what's leading", 'command:leading'],
  ['confirm', 'yes', 'yes'], ['confirm', 'yeah', 'yes'], ['confirm', 'no', 'no'], ['confirm', 'wrong', 'no'], ['confirm', 'yes no', 'unclear'],
  ['confirm', 'yes [unk]', 'unclear'], ['confirm', 'say again', 'command:repeat'],
  ['number', 'sixty two pounds', 'reading:62 psi'], ['number', 'one twenty five', 'reading:125'], ['number', 'skip', 'command:skip'],
  ['number', 'banana', 'unclear'], ['free', 'the walk in freezer is warm', 'text:the walk in freezer is warm'], ['free', '[unk]', 'unclear'],
];
for (const [mode, heard, want] of CASES) {
  const a = interpret(mode, heard, { turn: anyTurn, unit: 'psig' });
  const got = a.do === 'command' ? `command:${a.id}` : a.do === 'reading' ? `reading:${a.text}` : a.do === 'text' ? `text:${a.text}` : a.do;
  ok(got === want, `${mode} "${heard}" → ${got}, want ${want}`);
}
for (const [heard, want] of [['save as galley walk in', 'galley walk in'], ['save as [unk] [unk]', null], ['save as', null], ['save as dorm one fifty five', 'dorm one fifty five'], ['save as galley [unk]', null]]) {
  const a = interpret('check', heard, { turn: anyTurn });
  ok(a.do === 'saveas' && a.name === want, `"${heard}" → ${JSON.stringify(a)}, want saveas ${want}`);
}
ok(JSON.stringify(numberWords(155)) === JSON.stringify(['one', 'hundred', 'fifty', 'five', 'one', 'oh']), `numberWords(155): ${numberWords(155)}`);
ok(nameWords(['Dorm 155 reach-in']).includes('fifty') && nameWords(['Galley walk-in']).includes('walk'), 'nameWords');
ok(grammar('check', anyTurn.options, ['Galley walk-in']).includes('galley'), 'check grammar carries known unit names');
ok(speakable('Superheat 8–12 °F (TXV) — low') === 'Superheat 8 to 12 degrees, low', `speakable: ${speakable('Superheat 8–12 °F (TXV) — low')}`);
ok(speakable('62 °F') === '62 degrees' && speakable('°F') === 'Fahrenheit', `speakable unit alone: "${speakable('°F')}"`);
ok(speakable('wait the maker\'s time (not under 5 minutes)').includes('not under 5 minutes'), 'a negation in parentheses is spoken');
ok(speakable('Below −20 °F') === 'Below minus 20 degrees', `minus sign: ${speakable('Below −20 °F')}`);
ok(speakable('P(+)–N(−) bus') === 'P plus–N minus bus' || /plus.*minus/.test(speakable('P(+)–N(−) bus')), `bus polarity: ${speakable('P(+)–N(−) bus')}`);
// speech fidelity over the whole KB: no aside carrying a negation, scope or number is dropped; no raw symbols left
const ABBR = /^[A-Z][A-Z/+.\s]{0,7}$/;
for (const f of kb.features.values()) {
  const sys = leaves.find((x) => kb.inSystem(f, x.id))?.id;
  if (!sys) continue;
  for (const src of [kb.ask(f, sys), f.caution && kb.fill(f.caution, sys), f.how && kb.fill(f.how, sys), ...f.stateIds.map((x) => kb.fill(String(f.states[x]), sys))].filter(Boolean)) {
    for (const m of src.matchAll(/\(([^()]*)\)/g)) {
      if (ABBR.test(m[1].trim())) ok(!/\bnot\b|never|only|other than|\d/i.test(m[1]), `${f.id}: dropped aside "${m[1]}"`);
    }
    const spoken = speakable(src);
    ok(!/[−~±<>≈()]/.test(spoken), `${f.id}: raw symbol left in "${spoken.slice(0, 80)}"`);
  }
}
for (const inp of kb.inputs.values()) {
  const t = speakable(inp.unit || '');
  ok(!/[°%ΔΩµ]/.test(t), `unit "${inp.unit}" speaks as "${t}"`);
}

// 3. a tech answering only by number, each answer the one the true cause makes most likely
const RUNS = [
  ['vc.walkin', 'walk-in freezer warm', 'vc.evap_fan_off'],
  ['fuel.boiler', 'no heat, boiler locked out', null],
  ['ahu', 'air handler fan not running', null],
];
for (const [sys, text, wantCause] of RUNS) {
  if (!kb.systems.get(sys)) { ok(false, `system ${sys} missing`); continue; }
  const findings = {};
  for (const p of search.run(text, sys).picks) findings[p.f] = p.s;
  let res = diagnose(kb, { system: sys, ctx: kb.defaultCtx(sys), findings }, { limit: 16 });
  const truth = wantCause ? res.model.causes.find((c) => c.id === wantCause) : res.model.causes.find((c) => c.id === res.post.find((r) => r.id !== '_ok')?.id);
  if (!truth) { ok(false, `${sys}: cause ${wantCause} not in the model`); continue; }
  const path = [];
  for (let step = 0; step < 10; step++) {
    const next = res.next[0];
    if (!next) break;
    const turn = checkTurn(kb, sys, next.feature);
    const best = next.feature.stateIds.map((s, i) => [i, reading(res.model, truth, next.feature.id, s, findings).p]).sort((a, b) => b[1] - a[1])[0][0];
    const a = interpret('check', NUM[best], { turn });
    ok(a.do === 'answer' && a.state === next.feature.stateIds[best], `${sys} step ${step}: "${NUM[best]}" didn't set ${next.feature.stateIds[best]}`);
    findings[a.fid] = a.state;
    path.push(`${next.feature.id}=${a.state}`);
    res = diagnose(kb, { system: sys, ctx: kb.defaultCtx(sys), findings }, { limit: 16 });
    if (res.post[0].id === truth.id && res.post[0].p > 0.6) break;
  }
  const rank = res.post.findIndex((r) => r.id === truth.id);
  ok(rank >= 0 && rank < 3, `${sys}: by-number answers left ${truth.id} at rank ${rank + 1}`);
  if (VERBOSE || rank !== 0) console.log(`${sys} → ${truth.id}: rank ${rank + 1} (${Math.round(100 * (res.post[rank]?.p || 0))}%) after ${path.length} answers: ${path.join(', ')}`);
}

console.log(`${n - fail}/${n} voice dialog checks pass`);
process.exit(fail ? 1 : 0);
