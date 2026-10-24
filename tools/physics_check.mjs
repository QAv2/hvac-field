// Physics spot-check: calculator outputs against independent published values (manufacturer PT charts,
// NIST WebBook, the 1976 US Standard Atmosphere, PsychroLib/ASHRAE, Dow glycol tables, DOE/EPRI/NEMA,
// trade training). Sources and URLs are listed in cloud-reports/H1.md. node tools/physics_check.mjs
// prints a markdown table and exits 1 if any point is outside its tolerance.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as calc from '../docs/js/calcs.js';

const R = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'data');
const load = (f) => JSON.parse(readFileSync(join(R, f), 'utf8'));
calc.setData({ pt: load('pt.json'), glycol: load('glycol.json'), charging: load('charging.json') });
// two equal legs and one low leg giving exactly x % unbalance about a 460 V average
const legs = (x) => calc.threePhase({ v1: 460 * (1 + x / 200), v2: 460 * (1 + x / 200), v3: 460 * (1 - x / 100) });
const vac = (psig) => calc.inHg(psig);
const rows = [
  // [family, quantity, ours, reference, source, tolerance]
  ['PT', 'R-410A −40 °F vapor (psig)', calc.psat('R-410A', -40, 'dew'), 10.7, 'Arkema Forane 410A (REFPROP 9)', 0.5],
  ['PT', 'R-410A −40 °F liquid (psig)', calc.psat('R-410A', -40, 'bubble'), 10.8, 'Arkema Forane 410A', 0.5],
  ['PT', 'R-410A −20 °F vapor (psig)', calc.psat('R-410A', -20, 'dew'), 26.2, 'Arkema Forane 410A', 0.5],
  ['PT', 'R-410A 0 °F vapor (psig)', calc.psat('R-410A', 0, 'dew'), 48.2, 'Arkema Forane 410A', 0.5],
  ['PT', 'R-410A 40 °F vapor (psig)', calc.psat('R-410A', 40, 'dew'), 118.4, 'Arkema Forane 410A', 1.0],
  ['PT', 'R-22 −40 °F (psig)', calc.psat('R-22', -40), 15.262 - 14.696, 'NIST WebBook 15.262 psia', 0.3],
  ['PT', 'R-22 −20 °F (psig)', calc.psat('R-22', -20), 24.905 - 14.696, 'NIST WebBook 24.905 psia', 0.3],
  ['PT', 'R-22 0 °F (psig)', calc.psat('R-22', 0), 38.728 - 14.696, 'NIST WebBook 38.728 psia', 0.3],
  ['PT', 'R-22 40 °F (psig)', calc.psat('R-22', 40), 83.255 - 14.696, 'NIST WebBook 83.255 psia', 0.5],
  ['PT', 'R-404A −40 °F vapor (psig)', calc.psat('R-404A', -40, 'dew'), 4.3, 'Arkema 4.3; Chemours 4.51', 0.5],
  ['PT', 'R-404A −40 °F liquid (psig)', calc.psat('R-404A', -40, 'bubble'), 4.9, 'Arkema 4.9; Chemours 5.12', 0.5],
  ['PT', 'R-404A −20 °F vapor (psig)', calc.psat('R-404A', -20, 'dew'), 16.0, 'Arkema 16.0; Chemours 16.27', 0.6],
  ['PT', 'R-404A −10 °F vapor (psig)', calc.psat('R-404A', -10, 'dew'), 23.6, 'Arkema 23.6; Chemours 23.87', 0.6],
  ['PT', 'R-404A 0 °F liquid (psig)', calc.psat('R-404A', 0, 'bubble'), 33.7, 'Arkema 33.7; Chemours 33.87', 0.6],
  ['PT', 'R-134a −40 °F (in. Hg vac)', vac(calc.psat('R-134a', -40)), 14.8, 'Arkema/NRI/Hudson 14.8"; NIST 7.4272 psia', 0.2],
  ['PT', 'R-134a −20 °F (in. Hg vac)', vac(calc.psat('R-134a', -20)), 3.7, 'Arkema 3.7"; NIST 12.898 psia (3.66")', 0.2],
  ['PT', 'R-134a 0 °F (psig)', calc.psat('R-134a', 0), 21.171 - 14.696, 'NIST WebBook 21.171 psia; charts 6.5', 0.3],
  ['PT', 'R-134a 40 °F (psig)', calc.psat('R-134a', 40), 49.741 - 14.696, 'NIST WebBook 49.741 psia; charts 35.0', 0.3],
  ['PT', 'R-404A 32.6 psig → dew °F (reverse lookup)', calc.tsat('R-404A', 32.6, 'dew'), 0, 'Arkema: 32.6 psig vapor at 0 °F', 0.5],
  ['elev', 'Barometer at 5,000 ft (psia)', calc.patmFromElev(5000), 12.228, '1976 US Std Atmosphere (Eng. ToolBox)', 0.05],
  ['elev', 'Barometer at 10,000 ft (psia)', calc.patmFromElev(10000), 10.108, '1976 US Std Atmosphere', 0.05],
  ['elev', 'R-410A 40 °F vapor gauge reading at 10,000 ft (psig)', calc.psat('R-410A', 40, 'dew', calc.patmFromElev(10000)), 118.4 + (14.696 - 10.108), 'hand: Arkema 118.4 + (14.696 − 10.108)', 1.0],
  ['psy', 'Wet bulb 80 °F / 50 % (°F)', calc.wetbulb(80, 50), 66.66, 'PsychroLib 2.5 (ASHRAE 2017 ch.1); CoolProp agrees', 0.3],
  ['psy', 'Dew point 80 °F / 50 % (°F)', calc.dewpoint(80, 50), 59.71, 'PsychroLib 2.5', 0.3],
  ['psy', 'Wet bulb 95 °F / 40 % (°F)', calc.wetbulb(95, 40), 75.08, 'PsychroLib 2.5', 0.3],
  ['psy', 'Dew point 70 °F / 30 % (°F)', calc.dewpoint(70, 30), 37.18, 'PsychroLib 2.5', 0.3],
  ['psy', 'Humidity ratio 75 °F / 50 % (gr/lb)', calc.wFromRh(75, 50) * 7000, 64.6, 'PsychroLib 64.6; CoolProp 64.9', 0.5],
  ['psy', 'RH from 75 °F DB / 62.55 °F WB (%)', calc.rhFromWb(75, 62.55), 50, 'PsychroLib (inverse of 75/50)', 0.8],
  ['glycol', 'EG 30 wt % freeze (°F)', calc.glycolFreeze(30, 'EG'), 6.7, 'Dow DOWTHERM SR-1 product info (wt %)', 1.5],
  ['glycol', 'EG 40 wt % freeze (°F)', calc.glycolFreeze(40, 'EG'), -8.1, 'Dow DOWTHERM SR-1', 1.5],
  ['glycol', 'EG 50 wt % freeze (°F)', calc.glycolFreeze(50, 'EG'), -28.9, 'Dow DOWTHERM SR-1', 1.5],
  ['glycol', 'PG 30 wt % freeze (°F)', calc.glycolFreeze(30, 'PG'), 9.2, 'Dow DOWFROST HD (wt %); Eng. ToolBox 7', 1.5],
  ['glycol', 'PG 40 wt % freeze (°F)', calc.glycolFreeze(40, 'PG'), -6.0, 'Dow DOWFROST HD; Eng. ToolBox −8', 1.5],
  ['glycol', 'PG 50 wt % freeze (°F)', calc.glycolFreeze(50, 'PG'), -28.3, 'Dow DOWFROST HD; Eng. ToolBox −29', 1.5],
  // the glycol table is now Dow's, so also against a second publisher (Engineering ToolBox, PG by mass)
  ['glycol', 'PG 30 wt % freeze (°F), 2nd source', calc.glycolFreeze(30, 'PG'), 7, 'Engineering ToolBox propylene glycol (mass %)', 2.5],
  ['glycol', 'PG 50 wt % freeze (°F), 2nd source', calc.glycolFreeze(50, 'PG'), -29, 'Engineering ToolBox propylene glycol (mass %)', 2.5],
  ['3φ', 'Unbalance 462/463/455 V (%)', calc.threePhase({ v1: 462, v2: 463, v3: 455 }).vUnbal, 1.1, 'DOE Motor Tip Sheet #7', 0.05],
  ['3φ', 'Unbalance 455/460/492 V (%)', calc.threePhase({ v1: 455, v2: 460, v3: 492 }).vUnbal, 4.9, 'DOE Energy Matters, Winter 2005', 0.05],
  ['3φ', 'Unbalance 460/467/450 V (%)', calc.threePhase({ v1: 460, v2: 467, v3: 450 }).vUnbal, 1.96, 'ABB LVD-EOTKN113U', 0.02],
  ['3φ', 'MG-1 derate at 2 % unbalance', legs(2).derate, 0.95, 'EPRI 1000092 Fig 2-1 (NEMA MG 1)', 0.005],
  ['3φ', 'MG-1 derate at 4 % unbalance', legs(4).derate, 0.82, 'EPRI 1000092 Fig 2-1', 0.005],
  ['3φ', 'MG-1 derate at 5 % unbalance', legs(5).derate, 0.75, 'EPRI 1000092 Fig 2-1', 0.005],
  ['cap', 'Run cap 7.8 A / 292.9 V, 60 Hz (µF)', calc.capUnderLoad(7.8, 292.9), 70.62, 'ACHR News (Orr 2017) worked example', 0.1],
  ['cap', 'Run cap 5 A / 370 V, 60 Hz (µF)', calc.capUnderLoad(5, 370), 5 * 2652.58 / 370, 'hand: 10⁶/(2π·60) × A / V', 0.01],
];
let bad = 0;
console.log('| # | Family | Quantity | Field Dx | Reference | Δ | Tol. | Source | OK |');
console.log('|---|---|---|---|---|---|---|---|---|');
rows.forEach(([fam, q, ours, ref, src, tol], i) => {
  const d = ours - ref;
  const ok = Math.abs(d) <= tol;
  if (!ok) bad++;
  console.log(`| ${i + 1} | ${fam} | ${q} | ${ours?.toFixed(2)} | ${ref.toFixed(2)} | ${d >= 0 ? '+' : ''}${d.toFixed(2)} | ±${tol} | ${src} | ${ok ? '✓' : '✗'} |`);
});
console.log(`\n${rows.length} points, ${bad} outside tolerance`);
if (bad) process.exit(1);
// sanity: the voltage legs used for exact unbalance
