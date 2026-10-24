// Coverage of the knowledge base: causes, checks and measures per system, and which causes no
// scenario exercises as its expected answer. node tools/coverage.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KB } from '../docs/js/kb.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const kb = new KB(JSON.parse(readFileSync(join(ROOT, 'docs/data/kb.json'), 'utf8')));
let scen = [];
try { scen = JSON.parse(readFileSync(join(ROOT, 'tests/scenarios.json'), 'utf8')); } catch { /* none */ }
const expected = new Set(scen.flatMap((s) => [s.expect?.top, ...(s.expect?.top3 || [])]).filter(Boolean));
console.log('system        causes  checks  measures  scenarios');
for (const s of kb.systems.values()) {
  if (s.abstract) continue;
  const causes = kb.causes.filter((c) => kb.inSystem(c, s.id)).length;
  const feats = [...kb.features.values()].filter((f) => kb.inSystem(f, s.id)).length;
  const meas = kb.measures.filter((m) => kb.inSystem(m, s.id)).length;
  const sc = scen.filter((x) => x.system === s.id).length;
  console.log(`${s.id.padEnd(13)} ${String(causes).padStart(6)}  ${String(feats).padStart(6)}  ${String(meas).padStart(8)}  ${String(sc).padStart(9)}`);
}
const byModule = new Map();
for (const c of kb.causes) {
  if (!byModule.has(c.module)) byModule.set(c.module, { n: 0, untested: [] });
  const m = byModule.get(c.module);
  m.n++;
  if (!expected.has(c.id)) m.untested.push(c.id);
}
console.log('\nmodule              causes  without a scenario');
for (const [mod, m] of byModule) console.log(`${String(mod).padEnd(19)} ${String(m.n).padStart(6)}  ${m.untested.length}${m.untested.length ? ': ' + m.untested.slice(0, 8).join(', ') + (m.untested.length > 8 ? ' …' : '') : ''}`);
