// Calculators: each is a small form whose answer updates as you type. All offline.
import * as calc from './calcs.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => calc.readNumber(v);
const f1 = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toFixed(d));

export const TOOL_LIST = [
  { id: 'pt', label: 'PT chart — pressure ↔ temperature (+ custom fluid)', help: 'Pick the refrigerant (or Custom 2-point fluid), then type a temperature or a pressure.' },
  { id: 'shsc', label: 'Superheat & subcooling', help: 'Pressures from the gauges, line temperatures from the probes.' },
  { id: 'target', label: 'Target superheat (piston / fixed orifice)', help: 'Indoor wet bulb at the return, outdoor dry bulb at the condenser.' },
  { id: 'psy', label: 'Wet bulb, dew point, humidity (altitude-aware)', help: 'Dry bulb and humidity — or dry bulb and wet bulb.' },
  { id: 'split', label: 'Target temperature split (A/C)', help: 'Return air dry bulb and humidity; compare with return − supply.' },
  { id: 'glycol', label: 'Glycol freeze point', help: 'Concentration ↔ freeze point for ethylene or propylene glycol.' },
  { id: 'combustion', label: 'Combustion & flue efficiency (oil)', help: 'Gross stack temperature, the air temperature at the burner, and O2.' },
  { id: 'flow', label: 'Flow from ΔT & fan/pump affinity laws', help: 'Load & ΔT for GPM/CFM, or speed ratio for affinity laws (Q ∝ N, ΔP ∝ N², BHP ∝ N³).' },
  { id: 'elec', label: '3-phase unbalance & live capacitor test', help: 'Phase voltages/currents for motor derating, or start-winding amps & volts for live µF.' },
];

// Units whose readings can be below zero get a ± key next to the box: the phone's number pad has none.
const SIGNED = new Set(['°F', 'psig', 'psi', 'in. w.c.', 'ft']);
export const numBox = (input, unit) => (SIGNED.has(unit)
  ? `<div class="inrow">${input}<button type="button" class="pm" data-act="negate" aria-label="Change sign (minus)">±</button></div>` : input);

let fieldN = 0;
const field = (tool, k, label, unit, val = '', hint = '') => {
  const id = `tf-${tool}-${k}-${++fieldN}`;
  return `<div class="field"><label for="${id}">${esc(label)} <span class="unit">${esc(unit)}</span></label>
  ${numBox(`<input id="${id}" data-tool="${tool}" data-k="${k}" data-unit="${esc(unit)}" type="text" inputmode="decimal" autocomplete="off" value="${esc(val)}">`, unit)}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
};
const select = (tool, k, label, options, cur) => {
  const id = `tf-${tool}-${k}-${++fieldN}`;
  return `<div class="field"><label for="${id}">${esc(label)}</label>
  <select id="${id}" data-tool="${tool}" data-k="${k}">${options.map((o) => `<option value="${esc(o[0])}" ${o[0] === cur ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div>`;
};

export function renderTool(id, { ctx = {}, refrigerants = [] } = {}) {
  const t = TOOL_LIST.find((x) => x.id === id);
  const ref = ctx.refrigerant || 'R-410A';
  const refOpts = [...refrigerants.map((r) => [r, r]), ['CUSTOM', 'Custom / Future Fluid (2-pt Clausius-Clapeyron)']];
  const refSel = (tool) => select(tool, 'ref', 'Refrigerant', refOpts, ref);
  let body = '';
  switch (id) {
    case 'pt':
      body = `<div class="fields">${refSel('pt')}${field('pt', 'elev', 'Elevation (optional)', 'ft', '0', 'Sea level = 0')}
        ${field('pt', 'temp', 'Temperature', '°F')}${field('pt', 'psig', 'or pressure', 'psig')}${field('pt', 'inhg', 'or vacuum', 'in. Hg')}<div></div>
        ${field('pt', 't1', 'Custom Ref Pt 1 Temp', '°F', '0', 'Only if Custom selected')}${field('pt', 'p1', 'Custom Ref Pt 1 Press', 'psig', '48')}
        ${field('pt', 't2', 'Custom Ref Pt 2 Temp', '°F', '100', 'Only if Custom selected')}${field('pt', 'p2', 'Custom Ref Pt 2 Press', 'psig', '318')}</div>`;
      break;
    case 'shsc':
      body = `<div class="fields">${refSel('shsc')}${field('shsc', 'elev', 'Elevation (optional)', 'ft', '0')}
        ${field('shsc', 'sp', 'Suction pressure', 'psig')}${field('shsc', 'st', 'Suction line temp', '°F')}
        ${field('shsc', 'lp', 'Liquid pressure', 'psig')}${field('shsc', 'lt', 'Liquid line temp', '°F')}</div>`;
      break;
    case 'target':
      body = `<div class="fields">${field('target', 'iwb', 'Return air wet bulb', '°F', '', 'or fill dry bulb + humidity')}${field('target', 'odb', 'Outdoor air (condenser inlet)', '°F')}
        ${field('target', 'idb', 'Return air dry bulb', '°F')}${field('target', 'irh', 'Return air humidity', '% RH')}</div>`;
      break;
    case 'psy':
      body = `<div class="fields">${field('psy', 'db', 'Dry bulb', '°F')}${field('psy', 'rh', 'Relative humidity', '% RH')}${field('psy', 'wb', 'or wet bulb', '°F')}${field('psy', 'elev', 'Elevation (optional)', 'ft', '0', 'Adjusts barometric pressure')}</div>`;
      break;
    case 'split':
      body = `<div class="fields">${field('split', 'db', 'Return air dry bulb', '°F')}${field('split', 'rh', 'Return air humidity', '% RH')}
        ${field('split', 'wb', 'or return wet bulb', '°F')}${field('split', 'sa', 'Supply air (optional)', '°F')}</div>`;
      break;
    case 'glycol':
      body = `<div class="fields">${select('glycol', 'type', 'Glycol', [['EG', 'Ethylene (EG)'], ['PG', 'Propylene (PG)']], 'PG')}<div></div>
        ${field('glycol', 'pct', 'Concentration', '% by mass')}${field('glycol', 'fp', 'or freeze point wanted', '°F')}</div>`;
      break;
    case 'combustion':
      body = `<div class="fields">${field('combustion', 'stack', 'Stack temperature (gross)', '°F')}${field('combustion', 'air', 'Combustion air temp', '°F', '70')}
        ${field('combustion', 'o2', 'O2', '%')}${field('combustion', 'co', 'CO as measured (optional)', 'ppm')}</div>`;
      break;
    case 'flow':
      body = `<div class="fields">${field('flow', 'btuh', 'Load', 'Btu/h')}${field('flow', 'dt', 'Temperature difference', '°F')}
        ${select('flow', 'fluid', 'Water side fluid', [['500', 'Water (500)'], ['485', '30% PG (≈485)'], ['470', '40% PG (≈470)'], ['455', '50% PG (≈455)']], '500')}${field('flow', 'elev', 'Elevation (optional)', 'ft', '0')}
        ${field('flow', 'q1', 'Affinity: Current CFM or GPM', '')}${field('flow', 'n1', 'Current RPM or Hz', '')}
        ${field('flow', 'n2', 'New RPM or Hz', '', '', 'or leave blank & enter target flow')}${field('flow', 'q2', 'or Target CFM / GPM', '')}
        ${field('flow', 'dp1', 'Current Static / Head (optional)', 'in.wc/ft')}${field('flow', 'bhp1', 'Current Motor Power (optional)', 'HP/kW')}</div>`;
      break;
    case 'elec':
      body = `<div class="fields">
        ${field('elec', 'v1', 'Phase L1–L2 Voltage', 'V')}${field('elec', 'v2', 'Phase L2–L3 Voltage', 'V')}${field('elec', 'v3', 'Phase L3–L1 Voltage', 'V')}<div></div>
        ${field('elec', 'i1', 'Leg L1 Current', 'A')}${field('elec', 'i2', 'Leg L2 Current', 'A')}${field('elec', 'i3', 'Leg L3 Current', 'A')}<div></div>
        ${field('elec', 'cap_a', 'Live Cap: Start-winding amps', 'A', '', 'uF = 2652.6 × A / V (60 Hz)')}${field('elec', 'cap_v', 'Voltage across capacitor', 'V')}
        ${select('elec', 'hz', 'Line frequency', [['60', '60 Hz'], ['50', '50 Hz']], '60')}<div></div></div>`;
      break;
    default:
      body = '<p>Unknown calculator.</p>';
  }
  return `<h1>${esc(t?.label || 'Calculator')}</h1>${body}<div id="toolout" class="out"></div>
    <div style="margin-top:16px"><a class="block" href="#/tools">‹ All calculators</a></div>`;
}

export function updateTool(id) {
  const out = document.getElementById('toolout');
  if (!out) return;
  // typed boxes are read in their own unit ("8,1 bar" in a psig box, "24,000" Btu/h); a box that can't
  // be read says so instead of being quietly ignored
  const v = {};
  const notes = [];
  document.querySelectorAll(`[data-tool="${id}"]`).forEach((el) => {
    if (el.tagName !== 'INPUT') { v[el.dataset.k] = el.value; return; }
    const r = calc.readValue(el.value, el.dataset.unit || '');
    v[el.dataset.k] = r.v;
    if (r.note) notes.push(`${el.closest('.field')?.querySelector('label')?.firstChild?.textContent.trim() || el.dataset.k}: ${r.note}`);
  });
  out.innerHTML = notes.map((n) => `<p class="warnbox">${esc(n)}</p>`).join('') + compute(id, v);
}

const row = (label, value) => `<div class="row"><span>${esc(label)}</span><b>${value}</b></div>`;

function pressureText(p) {
  if (p == null) return '—';
  return p < 0 ? `${f1(calc.inHg(p))} in. Hg vac` : `${f1(p)} psig`;
}

// exported for tools/fuzz.mjs
export function compute(id, v) {
  const elev = num(v.elev) ?? 0;
  const patm = calc.patmFromElev(elev);
  switch (id) {
    case 'pt': {
      const ref = v.ref;
      const t = num(v.temp);
      let p = num(v.psig);
      const vac = num(v.inhg);
      if (p == null && vac != null) p = calc.fromInHg(vac);
      if (ref === 'CUSTOM') {
        const fit = calc.clausiusFit(num(v.t1), num(v.p1), num(v.t2), num(v.p2), patm);
        if (!fit) return '<p class="warnbox">Enter two distinct valid reference points (Temp °F and Pressure psig) from the cylinder or nameplate.</p>';
        let html = `<div class="muted">Clausius–Clapeyron fit: ln(P_abs) = ${f1(fit.A, 3)} − ${f1(fit.B, 1)} / T_R · P_atm = ${f1(patm, 2)} psia</div>`;
        if (t != null) {
          html += `<div class="big">${pressureText(calc.clausiusPsat(fit, t))}</div>` + customPtTable(fit, Math.round(t));
        } else if (p != null) {
          const tc = calc.clausiusTsat(fit, p);
          html += `<div class="big">${f1(tc)} °F</div>` + (tc != null ? customPtTable(fit, Math.round(tc)) : '');
        } else html += '<p class="muted">Type a temperature, a pressure, or a vacuum.</p>';
        return html;
      }
      const glide = calc.hasGlide(ref);
      const info = calc.refInfo(ref);
      let html = info ? `<div class="muted">${esc(ref)} · ${esc(info.safety)} · ${esc(info.use)}${elev ? ` · P_atm ${f1(patm, 2)} psia` : ''}</div>` : '';
      if (t != null) {
        html += glide
          ? `<div class="big">${pressureText(calc.psat(ref, t, 'dew', patm))}</div>${row('Vapor (dew) — use for superheat', pressureText(calc.psat(ref, t, 'dew', patm)))}${row('Liquid (bubble) — use for subcooling', pressureText(calc.psat(ref, t, 'bubble', patm)))}`
          : `<div class="big">${pressureText(calc.psat(ref, t, 'dew', patm))}</div>`;
        html += ptTable(ref, Math.round(t), patm);
      } else if (p != null) {
        const td = calc.tsat(ref, p, 'dew', patm), tb = calc.tsat(ref, p, 'bubble', patm);
        html += glide
          ? `<div class="big">${f1(td)} °F</div>${row('Dew point (vapor) — for superheat', `${f1(td)} °F`)}${row('Bubble point (liquid) — for subcooling', `${f1(tb)} °F`)}`
          : `<div class="big">${f1(td)} °F</div>`;
        if (td != null) html += ptTable(ref, Math.round(td), patm);
        if (td == null) html += '<p class="muted">Outside the table (−60 to 160 °F, or above the critical point).</p>';
      } else html += '<p class="muted">Type a temperature, a pressure, or a vacuum.</p>';
      return html;
    }
    case 'shsc': {
      const ref = v.ref;
      const sp = num(v.sp), st = num(v.st), lp = num(v.lp), lt = num(v.lt);
      const evap = calc.tsat(ref, sp, 'dew', patm), cond = calc.tsat(ref, lp, 'bubble', patm);
      let html = '';
      if (evap != null) html += row('Evaporator saturation (dew)', `${f1(evap)} °F`);
      if (evap != null && st != null) html += `<div class="big">SH ${f1(st - evap)} °F</div>`;
      if (cond != null) html += row('Condensing saturation (bubble)', `${f1(cond)} °F`);
      if (cond != null && lt != null) html += `<div class="big">SC ${f1(cond - lt)} °F</div>`;
      return html || '<p class="muted">Enter a pressure and its line temperature.</p>';
    }
    case 'target': {
      let wb = num(v.iwb);
      if (wb == null && num(v.idb) != null && num(v.irh) != null) wb = calc.wetbulb(num(v.idb), num(v.irh));
      const odb = num(v.odb);
      const tgt = calc.foTargetSh(wb, odb);
      if (tgt == null) return '<p class="muted">Needs the return wet bulb (or dry bulb + humidity) and the outdoor temperature.</p>';
      const low = tgt <= 5;
      return `<div class="big">${f1(tgt)} °F</div>${row('Return wet bulb used', `${f1(wb)} °F`)}${row('Acceptable band', `${f1(Math.max(0, tgt - 5))} – ${f1(tgt + 5)} °F`)}
        ${low ? '<p class="warnbox">Below 5 °F: too hot and dry to charge by superheat. Come back when the load is higher, or weigh the charge in.</p>' : ''}
        <p class="muted">California ACM Table RD-2 where it applies, the field formula outside it. Measured at the outdoor unit's suction line. The unit's own charging chart wins.</p>`;
    }
    case 'psy': {
      const db = num(v.db);
      let rh = num(v.rh);
      const wbIn = num(v.wb);
      if (db == null) return '<p class="muted">Enter the dry bulb first.</p>';
      if (wbIn != null && wbIn > db + 0.5) return '<p class="warnbox">Wet-bulb cannot exceed dry-bulb — check thermometer calibration or dry wick.</p>';
      if (rh == null && wbIn != null) rh = calc.rhFromWb(db, wbIn, patm);
      if (rh == null) return '<p class="muted">Add humidity or wet bulb.</p>';
      const wb = calc.wetbulb(db, rh, patm), dp = calc.dewpoint(db, rh, patm), W = calc.wFromRh(db, rh, patm);
      return `<div class="big">${f1(wb)} °F WB</div>${row('Relative humidity', `${f1(rh)} %`)}${row('Dew point', `${f1(dp)} °F`)}
        ${row('Humidity ratio', `${f1(W * 7000)} gr/lb`)}${row('Enthalpy', `${f1(calc.enthalpy(db, W))} Btu/lb`)}
        <p class="muted">Barometric pressure: ${f1(patm, 2)} psia (${elev ? `${f1(elev, 0)} ft` : 'sea level'}).</p>`;
    }
    case 'split': {
      const db = num(v.db);
      let wb = num(v.wb);
      if (wb == null && db != null && num(v.rh) != null) wb = calc.wetbulb(db, num(v.rh));
      const t = calc.splitTarget(db, wb);
      if (db == null || wb == null) return '<p class="muted">Needs return dry bulb and humidity (or wet bulb).</p>';
      if (t == null) return '<p class="warnbox">These return-air readings don\'t make sense together (the chart has no target here). Re-measure.</p>';
      const sa = num(v.sa);
      let verdict = '';
      if (sa != null) {
        const actual = db - sa;
        const d = actual - t;
        verdict = row('Actual split', `${f1(actual)} °F`) + `<p class="${Math.abs(d) <= 3 ? 'muted' : 'warnbox'}">${Math.abs(d) <= 3 ? 'Within ±3 °F of target.' : d > 0 ? 'Split too high — low airflow (filter, coil, blower) or low load.' : 'Split too low — low charge, high airflow, or a refrigerant-side problem.'}</p>`;
      }
      return `<div class="big">${f1(t)} °F</div>${row('Target band', `${f1(t - 3)} – ${f1(t + 3)} °F`)}${verdict}<p class="muted">California ACM Table RD-3, 400 cfm per ton.</p>`;
    }
    case 'glycol': {
      const type = v.type || 'PG';
      const pct = num(v.pct), fp = num(v.fp);
      if (pct != null && pct > 60) {
        return '<p class="warnbox">Above 60 % the freeze point climbs back up (neat glycol freezes near +9 °F), the fluid gets thick and heat transfer drops. Dilute with pre-mix of the same chemistry to 50–55 %.</p>';
      }
      if (pct != null) {
        const f = calc.glycolFreeze(pct, type);
        return `<div class="big">${f1(f)} °F</div>${row('Freeze point at', `${f1(pct, 0)} % ${type}`)}<p class="muted">Freeze (slush) point, not burst protection. Burst protection is lower. ${pct > 60 ? 'Above 60 % the freeze point rises again — don\'t go richer.' : ''}</p>`;
      }
      if (fp != null) {
        const need = calc.glycolPctFor(fp, type);
        return need == null ? '<p class="warnbox">Colder than the table goes (60 %). Check the glycol maker\'s data.</p>' : `<div class="big">${f1(need, 0)} %</div>${row(`${type} by mass for a freeze point of`, `${f1(fp, 0)} °F`)}`;
      }
      return '<p class="muted">Type a concentration or the freeze point you need.</p>';
    }
    case 'combustion': {
      const stack = num(v.stack), air = num(v.air) ?? 70, o2 = num(v.o2), co = num(v.co);
      if (stack == null || o2 == null) return '<p class="muted">Needs stack temperature and O2.</p>';
      if (o2 >= 20.9) return '<p class="warnbox">O2 at or above 20.9 % means the probe is reading room air.</p>';
      const r = calc.combustion({ stackF: stack, airF: air, o2, co });
      if (!r) return '<p class="warnbox">The stack has to be hotter than the combustion air, and O2 between 0 and 20.9 %. Re-check the probe and the numbers.</p>';
      return `<div class="big">${f1(r.eff)} %</div>${row('Net stack temperature', `${f1(r.netStack, 0)} °F`)}${row('CO2 (calculated)', `${f1(r.co2)} %`)}
        ${row('Excess air', `${f1(r.excessAir, 0)} %`)}${co != null ? row('CO air-free', `${f1(r.coAirFree, 0)} ppm`) : ''}
        <p class="muted">Flue-loss (Siegert) efficiency on the higher heating value, light fuel oil. Doesn't count CO, smoke or jacket losses. Check smoke number before trusting a high O2 trim.</p>`;
    }
    case 'flow': {
      const btuh = num(v.btuh), dt = num(v.dt), factor = num(v.fluid) ?? 500;
      let html = '';
      if (btuh != null && dt != null && dt !== 0) {
        html += `<div class="big">${f1(calc.gpm(btuh, dt, factor))} GPM</div>${row('Airflow for that load (sensible)', `${f1(calc.cfm(btuh, dt, patm), 0)} CFM`)}`;
      }
      const aff = calc.affinityLaws({ flow1: num(v.q1), speed1: num(v.n1), dp1: num(v.dp1), bhp1: num(v.bhp1), speed2: num(v.n2), flow2: num(v.q2) });
      if (aff) {
        html += `<div class="big">Ratio ${f1(aff.ratio * 100, 0)} %</div>`
          + (aff.flow2 != null ? row('New flow (Q ∝ N)', `${f1(aff.flow2, 1)}`) : '')
          + (aff.speed2 != null ? row('Required speed (RPM or Hz)', `${f1(aff.speed2, 1)}`) : '')
          + (aff.dp2 != null ? row('New static / head (ΔP ∝ N²)', `${f1(aff.dp2, 2)}`) : '')
          + (aff.bhp2 != null ? row('New shaft power (BHP ∝ N³)', `${f1(aff.bhp2, 2)}`) : '');
      }
      if (!html) return '<p class="muted">Enter Load & ΔT for GPM/CFM, or Current/New Speed & Flow for Fan/Pump Affinity Laws.</p>';
      return html + `<p class="muted">Water: Btu/h = 500 × GPM × ΔT. Air: Btu/h = 1.08 × (P/P0) × CFM × ΔT. Affinity laws: Q2/Q1 = N2/N1, ΔP2/ΔP1 = (N2/N1)², BHP2/BHP1 = (N2/N1)³.</p>`;
    }
    case 'elec': {
      let html = '';
      const tp = calc.threePhase({ v1: num(v.v1), v2: num(v.v2), v3: num(v.v3), i1: num(v.i1), i2: num(v.i2), i3: num(v.i3) });
      if (tp) {
        if (tp.vUnbal != null) {
          html += `<div class="big">${f1(tp.vUnbal, 1)} % V unbalance</div>`
            + row('Average phase voltage', `${f1(tp.vAvg, 1)} V`)
            + row('NEMA MG-1 motor derating factor', `${f1(tp.derate * 100, 0)} %`)
            + row('Extra winding temperature rise', `+${f1(tp.tempRiseExtraPct, 0)} %`);
        }
        if (tp.iUnbal != null) {
          html += row('Average leg current', `${f1(tp.iAvg, 1)} A`) + row('Current unbalance', `${f1(tp.iUnbal, 1)} %`);
        }
        if (tp.verdict) html += `<p class="${tp.singlePhased || (tp.vUnbal ?? 0) > 2 || (tp.iUnbal ?? 0) > 10 ? 'warnbox' : 'muted'}">${esc(tp.verdict)}</p>`;
      }
      const uf = calc.capUnderLoad(num(v.cap_a), num(v.cap_v), num(v.hz) ?? 60);
      if (uf != null) {
        html += `<div class="big">${f1(uf, 1)} µF</div>` + row('Live capacitor capacitance under load', `${f1(uf, 1)} µF`);
      }
      return html || '<p class="muted">Enter L1–L2, L2–L3, L3–L1 voltages (or leg currents) for 3-phase unbalance, or start-winding amps & capacitor volts for live µF.</p>';
    }
    default:
      return '';
  }
}

// (a centre far outside any table, e.g. 1e300 °F from a bad custom fit, would make t++ a no-op and the loop endless)
const tableCenter = (c) => Number.isFinite(c) && Math.abs(c) < 1e4;

function ptTable(ref, center, patm = calc.P_ATM) {
  if (!tableCenter(center)) return '';
  const glide = calc.hasGlide(ref);
  let rows = '';
  for (let t = center - 5; t <= center + 5; t++) {
    const d = calc.psat(ref, t, 'dew', patm);
    if (d == null) continue;
    rows += `<tr class="${t === center ? 'hit' : ''}"><td>${t}</td><td>${pressureText(d)}</td>${glide ? `<td>${pressureText(calc.psat(ref, t, 'bubble', patm))}</td>` : ''}</tr>`;
  }
  return `<table class="pt"><thead><tr><th>°F</th><th>${glide ? 'Vapor (dew)' : 'Pressure'}</th>${glide ? '<th>Liquid (bubble)</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>`;
}

function customPtTable(fit, center) {
  if (!tableCenter(center)) return '';
  let rows = '';
  for (let t = center - 5; t <= center + 5; t++) {
    const d = calc.clausiusPsat(fit, t);
    if (d == null) continue;
    rows += `<tr class="${t === center ? 'hit' : ''}"><td>${t}</td><td>${pressureText(d)}</td></tr>`;
  }
  return `<table class="pt"><thead><tr><th>°F</th><th>Saturation Pressure</th></tr></thead><tbody>${rows}</tbody></table>`;
}
