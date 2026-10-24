#!/usr/bin/env node
// Why does one cause outrank another? Prints, for the leading causes of one case, each finding's
// likelihood under that cause — `~` marks a reading the cause is silent on (leak rate) — plus its prior.
//
//   node tools/why.mjs --scenario "Reach-in freezer coil"        a scenario from tests/scenarios.json, by name
//   node tools/why.mjs '{"system":"vc.ac","findings":{"gen.output":"weak"},"inputs":{...},"ctx":{...}}'
//   options: --top 8 (how many causes)  --also vc.undercharge,_ok (always show these too)
// Run `python3 tools/build.py` first so docs/data/kb.json and tests/scenarios.json are current.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KB } from '../docs/js/kb.js';
import { prepare, posterior } from '../docs/js/engine.js';
import { computeMeasures } from '../docs/js/measure.js';
import * as calc from '../docs/js/calcs.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
calc.setData({ pt: read('docs/data/pt.json'), glycol: read('docs/data/glycol.json'), charging: read('docs/data/charging.json') });
const kb = new KB(read('docs/data/kb.json'));

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
let sc;
if (opt('--scenario')) {
  const all = read('tests/scenarios.json');
  const hits = all.filter((s) => s.name.toLowerCase().includes(opt('--scenario').toLowerCase()));
  if (hits.length !== 1) {
    console.log(hits.length ? `${hits.length} scenarios match — be more specific:\n  ${hits.map((s) => s.name).join('\n  ')}` : 'no scenario matches');
    process.exit(1);
  }
  sc = hits[0];
  console.log(`scenario: ${sc.name}`);
} else if (args[0] && args[0].startsWith('{')) {
  sc = JSON.parse(args[0]);
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

const ctx = { ...kb.defaultCtx(sc.system), ...(sc.ctx || {}) };
const m = computeMeasures(kb, sc.system, ctx, sc.inputs || {});
const findings = { ...Object.fromEntries(Object.entries(m.findings).map(([k, v]) => [k, v.s])), ...(sc.findings || {}) };
const model = prepare(kb, sc.system, ctx);
const post = posterior(model, findings);
const F = Object.entries(findings).filter(([f]) => model.fset.has(f));
const show = new Set([...post.slice(0, Number(opt('--top') || 8)).map((r) => r.id), '_ok', ...(opt('--also') || '').split(',').filter(Boolean)]);

console.log(`system: ${sc.system}   context: ${Object.entries(ctx).map(([k, v]) => `${k}=${v}`).join(' ') || '—'}`);
console.log(`findings: ${F.map(([f, s]) => `${f}=${s}`).join(' ')}\n`);
for (const r of post.filter((x) => show.has(x.id))) {
  const c = model.causes.find((x) => x.id === r.id);
  const parts = F.map(([fid, s]) => {
    const f = kb.features.get(fid);
    const own = c.dist.get(fid);
    const d = own || (c.id === '_ok' && f.complaint ? f.obsBase : f.silentDist);
    return `${fid}${own ? '' : '~'}${d[f.idx[s]].toFixed(2)}`;
  });
  console.log(`${(r.p * 100).toFixed(1).padStart(5)}%  #${post.indexOf(r) + 1}  prior ${c.prior.toFixed(2)}  ${c.id}`);
  console.log(`         ${parts.join('  ')}`);
}
