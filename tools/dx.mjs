#!/usr/bin/env node
// Field Dx CLI — zero-dependency terminal diagnostic & physics calculator.
// Works directly against docs/data/*.json and docs/js/*.js without a browser or server.
//
// Usage examples:
//   node tools/dx.mjs "central ac not cooling, suction line frosted, low airflow"
//   node tools/dx.mjs --sys vc.ac --ctx refrigerant=R-410A,metering=txv \
//     --in vc.suction_psig=68,vc.suction_line_f=58,vc.liquid_psig=240,vc.liquid_line_f=82 \
//     --find vc.airflow=normal
//   node tools/dx.mjs --cause vc.undercharge
//   node tools/dx.mjs --calc pt R-410A 118.4
//   node tools/dx.mjs --calc clausius 0 48.3 100 317.6 40
//   node tools/dx.mjs --calc 3ph 460 480 470 18.2 21.5 19.1
//   node tools/dx.mjs --calc cap 4.52 370

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KB } from '../docs/js/kb.js';
import { diagnose, explain } from '../docs/js/engine.js';
import { computeMeasures } from '../docs/js/measure.js';
import * as calc from '../docs/js/calcs.js';
import { Search, norm } from '../docs/js/search.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(readFileSync(join(ROOT, 'docs/data/kb.json'), 'utf8'));
calc.setData({
  pt: JSON.parse(readFileSync(join(ROOT, 'docs/data/pt.json'), 'utf8')),
  glycol: JSON.parse(readFileSync(join(ROOT, 'docs/data/glycol.json'), 'utf8')),
  charging: JSON.parse(readFileSync(join(ROOT, 'docs/data/charging.json'), 'utf8')),
});
const kb = new KB(raw);
const search = new Search(kb);

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(`Field Dx CLI — Offline HVAC/R Diagnostics & Physics Calculator
Built: ${raw.meta?.built || 'unknown'} · ${raw.meta?.counts?.causes || kb.causes.length} causes · ${raw.meta?.counts?.features || kb.features.size} checks · ${raw.meta?.counts?.measures || kb.measures.length} calculations

Usage:
  node tools/dx.mjs "<symptom text>"
  node tools/dx.mjs --sys <system> [--ctx k=v,...] [--in k=v,...] [--find f=s,...] ["<symptom text>"]
  node tools/dx.mjs --cause <cause_id> [--sys <system>]
  node tools/dx.mjs --systems
  node tools/dx.mjs --calc pt <ref> <psig_or_tempF> [psig|temp] [elev_ft]
  node tools/dx.mjs --calc clausius <T1_F> <P1_psig> <T2_F> <P2_psig> <query_T_or_P> [temp|psig]
  node tools/dx.mjs --calc 3ph <V1> <V2> <V3> [<I1> <I2> <I3>]
  node tools/dx.mjs --calc cap <amps> <volts> [hz]
  node tools/dx.mjs --calc affinity <Q1> <N1> <N2> [<SP1> <BHP1>]`);
  process.exit(0);
}

function parseKV(str) {
  const out = {};
  if (!str) return out;
  for (const part of str.split(',')) {
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

if (args.includes('--systems')) {
  console.log('Equipment Systems:');
  for (const s of kb.systems.values()) {
    if (s.abstract) continue;
    console.log(`  ${s.id.padEnd(14)} ${s.name}`);
  }
  process.exit(0);
}

const calcIdx = args.indexOf('--calc');
if (calcIdx >= 0) {
  const kind = args[calcIdx + 1];
  const rest = args.slice(calcIdx + 2);
  if (kind === 'pt') {
    const [ref, valStr, mode = 'psig', elevStr = '0'] = rest;
    const val = parseFloat(valStr);
    const patm = calc.patmFromElev(parseFloat(elevStr) || 0);
    if (mode === 'temp' || mode === 'f') {
      const pDew = calc.psat(ref, val, 'dew', patm);
      const pBub = calc.psat(ref, val, 'bubble', patm);
      console.log(`${ref} @ ${val} °F (Patm ${patm.toFixed(2)} psia): vapor/dew = ${pDew?.toFixed(1)} psig, liquid/bubble = ${pBub?.toFixed(1)} psig`);
    } else {
      const tDew = calc.tsat(ref, val, 'dew', patm);
      const tBub = calc.tsat(ref, val, 'bubble', patm);
      console.log(`${ref} @ ${val} psig (Patm ${patm.toFixed(2)} psia): vapor/dew = ${tDew?.toFixed(1)} °F, liquid/bubble = ${tBub?.toFixed(1)} °F`);
    }
  } else if (kind === 'clausius') {
    const [t1, p1, t2, p2, q, mode = 'temp'] = rest;
    const fit = calc.clausiusFit(parseFloat(t1), parseFloat(p1), parseFloat(t2), parseFloat(p2));
    if (!fit) { console.error('Invalid 2-point Clausius-Clapeyron reference points.'); process.exit(1); }
    if (mode === 'psig') {
      console.log(`Tsat @ ${q} psig = ${calc.clausiusTsat(fit, parseFloat(q))?.toFixed(1)} °F (ln P_abs = ${fit.A.toFixed(3)} - ${fit.B.toFixed(1)}/T_R)`);
    } else {
      console.log(`Psat @ ${q} °F = ${calc.clausiusPsat(fit, parseFloat(q))?.toFixed(1)} psig (ln P_abs = ${fit.A.toFixed(3)} - ${fit.B.toFixed(1)}/T_R)`);
    }
  } else if (kind === '3ph') {
    const [v1, v2, v3, i1, i2, i3] = rest.map((x) => parseFloat(x));
    const r = calc.threePhase({ v1, v2, v3, i1, i2, i3 });
    console.log(JSON.stringify(r, null, 2));
  } else if (kind === 'cap') {
    const [amps, volts, hz = '60'] = rest.map((x) => parseFloat(x));
    const uf = calc.capUnderLoad(amps, volts, hz);
    console.log(`Live capacitance under load: ${uf?.toFixed(2)} µF (${amps} A @ ${volts} V, ${hz} Hz)`);
  } else if (kind === 'affinity') {
    const [flow1, speed1, speed2, dp1, bhp1] = rest.map((x) => parseFloat(x));
    const r = calc.affinityLaws({ flow1, speed1, speed2, dp1, bhp1 });
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.error(`Unknown --calc mode: ${kind}`);
    process.exit(1);
  }
  process.exit(0);
}

let sys = null, causeId = null;
const ctxIn = {}, rawInputs = {}, manualFindings = {};
const textParts = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--sys') sys = args[++i];
  else if (a === '--cause') causeId = args[++i];
  else if (a === '--ctx') Object.assign(ctxIn, parseKV(args[++i]));
  else if (a === '--in') Object.assign(rawInputs, parseKV(args[++i]));
  else if (a === '--find') Object.assign(manualFindings, parseKV(args[++i]));
  else textParts.push(a);
}

if (causeId) {
  const c = kb.cause.get(causeId);
  if (!c) { console.error(`Unknown cause: ${causeId}`); process.exit(1); }
  const s = sys || (c.systems || []).find((x) => x !== '*') || 'vc.ac';
  console.log(`=== ${c.name} [${c.id}] (${c.prior}) ===`);
  console.log(`Systems: ${(c.systems || []).join(', ')}`);
  if (c.confirm) console.log(`\nConfirm it:\n  ${kb.fill(c.confirm, s)}`);
  if (c.safety) console.log(`\nSafety:\n  ${c.safety}`);
  console.log(`\nFix:\n  ${kb.fill(c.fix, s).replace(/\n/g, '\n  ')}`);
  if (c.notes) console.log(`\nNotes:\n  ${c.notes.replace(/\n/g, '\n  ')}`);
  process.exit(0);
}

const text = textParts.join(' ').trim();
if (!sys && text) {
  const r0 = search.run(text, null);
  if (r0.systems.length && r0.systems[0].score >= 3) {
    sys = r0.systems[0].id;
  } else {
    const votes = new Map();
    for (const p of r0.picks) {
      const f = kb.features.get(p.f);
      const tags = (f.systems || []).filter((t) => t !== '*');
      for (const t of tags) {
        const leaves = [...kb.systems.values()].filter((s) => !s.abstract && kb.lineage(s.id).includes(t));
        for (const l of leaves) votes.set(l.id, (votes.get(l.id) || 0) + p.score / leaves.length);
      }
    }
    const best = [...votes].sort((a, b) => b[1] - a[1])[0];
    if (best) sys = best[0];
  }
}
if (!sys) sys = 'vc.ac';

const ctx = { ...kb.defaultCtx(sys), ...ctxIn };
if (text) {
  const n = ` ${norm(text)} `;
  for (const c of kb.contextFor(sys)) {
    for (const o of c.options || []) {
      if (!(c.id in ctxIn) && (o.words || []).some((w) => n.includes(` ${norm(w)} `))) ctx[c.id] = String(o.id);
    }
  }
}

const m = computeMeasures(kb, sys, ctx, rawInputs);
const findings = {};
for (const [fid, r] of Object.entries(m.findings)) findings[fid] = r.s;
if (text) {
  for (const p of search.run(text, sys).picks) findings[p.f] = p.s;
}
Object.assign(findings, manualFindings);

const res = diagnose(kb, { system: sys, ctx, findings }, { limit: 8 });
const sysObj = kb.systems.get(sys);
console.log(`=== Field Dx: ${sysObj?.name || sys} [${sys}] ===`);
if (Object.keys(ctx).length) {
  console.log(`Context:  ${Object.entries(ctx).map(([k, v]) => `${k}=${v}`).join(', ')}`);
}
if (Object.keys(findings).length) {
  console.log(`Findings: ${Object.entries(findings).map(([f, s]) => `${kb.label(f, s, sys)} [${f}=${s}]`).join(' · ')}`);
}
if (m.results.length) {
  const shown = m.results.filter((r) => Number.isFinite(r.v) && !r.measure.hidden);
  if (shown.length) {
    console.log(`Vitals:   ${shown.map((r) => `${r.measure.name}: ${r.v.toFixed(1)} ${r.measure.unit || ''}${r.state ? ` (${r.state})` : ''}`).join(' · ')}`);
  }
}
if (m.sanity?.length) {
  for (const w of m.sanity) console.log(`! SANITY WARNING: ${w.msg || w}`);
}
if (res.fit && !res.fit.ok && res.post[0]?.id !== '_ok') {
  console.log(`! FIT NOTE: Leading cause does not explain: ${res.fit.misses.map((x) => x.label).join(', ')}`);
}

console.log('\nLikely Causes:');
for (const r of res.post.slice(0, 6)) {
  const pct = (r.p * 100).toFixed(1).padStart(5);
  console.log(`  ${pct}%  ${r.cause.name.padEnd(48)} [${r.id}]`);
}

if (res.next.length) {
  console.log('\nNext Best Checks (Expected Value of Information / Effort):');
  for (const n of res.next.slice(0, 3)) {
    console.log(`  -> ${kb.ask(n.feature, sys)} [${n.id}]`);
    if (n.feature.caution) console.log(`     ⚠ Before you do this: ${kb.fill(n.feature.caution, sys)}`);
    if (n.feature.how) console.log(`     How: ${kb.fill(n.feature.how, sys)}`);
  }
}
