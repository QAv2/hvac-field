// Field calculations: refrigerant PT lookups (tables baked from CoolProp), psychrometrics
// (ASHRAE Fundamentals equations), charging targets, glycol freeze points and combustion.
// Imperial units throughout: °F, psig, in. Hg vacuum, %RH.

let PT = null;
let GLY = null;
let CHG = null;

export function setData({ pt, glycol, charging }) {
  if (pt) PT = pt;
  if (glycol) GLY = glycol;
  if (charging) CHG = charging;
}

// ---------- typed readings ----------
// What a tech types into a box for a field in `unit`: "118", "118 psig", "8,1 bar", "24,000", "−5", "40°F".
// Commas: "24,000" and "1,234.5" are thousands; "4,5" is a decimal comma. Pressure in kPa, bar, MPa, psia or
// in. Hg vacuum is converted to the field's psig; °C in a °F field is refused (the same box may hold a
// temperature or a difference, and the two convert differently). A unit that doesn't belong to the field,
// a second decimal point, or a value no instrument could read gives v = null with a note saying why.
const F_C = { c: 1, '°c': 1, degc: 1, celsius: 1, '℃': 1 };
const conv = (k) => (v) => v * k;
const PRESS = { '': 1, psi: 1, psig: 1, lb: 1, lbs: 1, '#': 1, kpa: conv(0.145038), kpag: conv(0.145038), bar: conv(14.5038),
  barg: conv(14.5038), mpa: conv(145.038), psia: (v) => v - P_ATM, inhg: (v) => -Math.abs(v) / 2.03602, '"hg': (v) => -Math.abs(v) / 2.03602, hg: (v) => -Math.abs(v) / 2.03602 };
const READING = {
  '°F': { range: [-200, 3000], u: { '': 1, f: 1, '°f': 1, '°': 1, deg: 1, degf: 1, degrees: 1, fahrenheit: 1, '℉': 1 } },
  psig: { range: [-14.7, 3000], u: PRESS },
  psi: { range: [-14.7, 3000], u: PRESS },
  'in. Hg': { range: [0, 30], u: { '': 1, inhg: 1, in: 1, '"': 1, '"hg': 1, hg: 1 } },
  'in. w.c.': { range: [-40, 40], u: { '': 1, in: 1, inwc: 1, wc: 1, '"wc': 1, iwc: 1, '"': 1, pa: conv(1 / 249.089) } },
  '%': { range: [0, 100], u: { '': 1, '%': 1, pct: 1, percent: 1 } },
  '% RH': { range: [0, 100], u: { '': 1, '%': 1, rh: 1, '%rh': 1, pct: 1 } },
  '% by mass': { range: [0, 100], u: { '': 1, '%': 1 } },
  A: { range: [0, 5000], u: { '': 1, a: 1, amp: 1, amps: 1 } },
  V: { range: [0, 15000], u: { '': 1, v: 1, vac: 1, volt: 1, volts: 1 } },
  Hz: { range: [0, 1000], u: { '': 1, hz: 1 } },
  ft: { range: [-2000, 30000], u: { '': 1, ft: 1, "'": 1, feet: 1, m: conv(3.28084) } },
  'µF': { range: [0, 5000], u: { '': 1, uf: 1, 'µf': 1, 'μf': 1, mfd: 1, mf: 1 } },
  'Ω': { range: [0, 1e9], u: { '': 1, ohm: 1, ohms: 1, 'ω': 1, 'Ω': 1, k: conv(1000), kohm: conv(1000), 'kω': conv(1000), 'kΩ': conv(1000) } },
  ppm: { range: [0, 1e6], u: { '': 1, ppm: 1 } },
  min: { range: [0, 1440], u: { '': 1, min: 1, mins: 1, m: 1, minutes: 1 } },
  kW: { range: [0, 1e5], u: { '': 1, kw: 1, w: conv(0.001) } },
  'Btu/h': { range: [0, 1e9], u: { '': 1, btu: 1, btuh: 1, 'btu/h': 1, 'btu/hr': 1, k: conv(1000), kbtu: conv(1000), mbh: conv(1000), ton: conv(12000), tons: conv(12000) } },
  '0–9': { range: [0, 9], u: { '': 1 } },
  phases: { range: [1, 3], u: { '': 1, ph: 1, phase: 1 } },
};
const NUM_RE = /^([+-]?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d*)?|[.,]\d+)\s*(.*)$/;

export function readValue(raw, unit = '') {
  if (raw === null || raw === undefined) return { v: null, note: null };
  if (typeof raw === 'number') return Number.isFinite(raw) ? inRange(raw, unit, String(raw)) : { v: null, note: 'not a number' };
  const text = String(raw).trim();
  if (!text) return { v: null, note: null };
  const t = text.replace(/[\u2212\u2012\u2013\u2014\ufe63\uff0d]/g, '-').replace(/[º˚]/g, '°').replace(/^-\s+/, '-');
  const m = NUM_RE.exec(t);
  if (!m) return { v: null, note: `can't read “${text}” as a number` };
  const digits = /^\d{1,3}(,\d{3})+/.test(m[2]) ? m[2].replace(/,/g, '') : m[2].replace(',', '.');
  let v = Number(digits);
  if (!Number.isFinite(v)) return { v: null, note: `can't read “${text}” as a number` };
  if (m[1] === '-') v = -v;
  const said = m[3].toLowerCase().replace(/[\s.]/g, '');
  const spec = READING[unit];
  if (!said) return inRange(v, unit, text);
  if (/^[\d.,]|^e[+-]?\d/.test(said)) return { v: null, note: `can't read “${text}” as a number` };
  if (unit === '°F' && F_C[said]) return { v: null, note: `this box is °F, not °C (${fmtNum(v)} °C = ${fmtNum(v * 1.8 + 32)} °F; a ${fmtNum(v)} °C difference = ${fmtNum(v * 1.8)} °F)` };
  const k = spec?.u[said] ?? spec?.u[m[3].trim()];
  if (k === undefined) return { v: null, note: `“${m[3].trim()}” isn't a unit for ${unit || 'this box'}` };
  if (typeof k === 'function') {
    const out = inRange(k(v), unit, text);
    return out.v === null ? out : { v: out.v, note: `read as ${fmtNum(out.v)} ${unit}` };
  }
  return inRange(v, unit, text);
}

export const readNumber = (raw, unit) => readValue(raw, unit).v;

function inRange(v, unit, text) {
  const r = READING[unit]?.range;
  if (r && (v < r[0] || v > r[1])) return { v: null, note: `${text} ${unit} is outside anything this reading can be (${r[0]} to ${r[1]})` };
  return { v, note: null };
}

const fmtNum = (v) => String(Math.round(v * 10) / 10);
const fin = (...a) => a.every((x) => typeof x === 'number' && Number.isFinite(x));

// Bilinear lookup in a charging grid; null where the table has no value (a dash).
function grid2(tab, row, col) {
  const g = tab.grid;
  const r = Math.min(g.length - 1, Math.max(0, row - tab.row0));
  const c = Math.min(g[0].length - 1, Math.max(0, col - tab.col0));
  const r0 = Math.min(Math.floor(r), g.length - 2), c0 = Math.min(Math.floor(c), g[0].length - 2);
  const fr = r - r0, fc = c - c0;
  const v = [g[r0][c0], g[r0][c0 + 1], g[r0 + 1][c0], g[r0 + 1][c0 + 1]];
  const w = [(1 - fr) * (1 - fc), (1 - fr) * fc, fr * (1 - fc), fr * fc];
  let s = 0, ws = 0;
  for (let i = 0; i < 4; i++) if (w[i] > 1e-9) { if (v[i] === null) return null; s += v[i] * w[i]; ws += w[i]; }
  return ws ? s / ws : null;
}

export const refrigerants = () => (PT ? Object.keys(PT.refrigerants) : []);
export const refInfo = (ref) => PT?.refrigerants[ref] || null;
export const hasGlide = (ref) => Boolean(PT?.refrigerants[ref]?.dew);

function column(r, kind) {
  if (r.p) return r.p;
  if (kind === 'bubble') return r.bubble;
  return r.dew;
}

// saturation pressure (psig) at t °F; kind = 'dew' (vapor), 'bubble' (liquid) or 'mid'
export function psat(ref, t, kind = 'dew', patm = P_ATM) {
  const r = PT?.refrigerants[ref];
  if (!r || !fin(t, patm)) return null;
  if (kind === 'mid' && !r.p) {
    const a = psat(ref, t, 'dew', patm), b = psat(ref, t, 'bubble', patm);
    return a == null || b == null ? null : (a + b) / 2;
  }
  const arr = column(r, kind);
  const x = t - PT.meta.t0;
  if (x < 0 || x > arr.length - 1) return null;
  const i = Math.min(Math.floor(x), arr.length - 2);
  const f = x - i;
  const pSea = arr[i] + f * (arr[i + 1] - arr[i]);
  return pSea + (P_ATM - patm);
}

// saturation temperature (°F) at p psig; null outside the table
export function tsat(ref, p, kind = 'dew', patm = P_ATM) {
  const r = PT?.refrigerants[ref];
  if (!r || !fin(p, patm)) return null;
  if (kind === 'mid' && !r.p) {
    const a = tsat(ref, p, 'dew', patm), b = tsat(ref, p, 'bubble', patm);
    return a == null || b == null ? null : (a + b) / 2;
  }
  const pSea = p - (P_ATM - patm);
  const arr = column(r, kind);
  if (pSea < arr[0] || pSea > arr[arr.length - 1]) return null;
  let lo = 0, hi = arr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= pSea) lo = mid; else hi = mid;
  }
  const span = arr[hi] - arr[lo];
  const f = span > 0 ? (pSea - arr[lo]) / span : 0;
  return PT.meta.t0 + lo + f;
}

// ---------- Universal Clausius-Clapeyron 2-point refrigerant solver (ln P_abs = A - B / T_R) ----------
// Works for any pure fluid or azeotrope discovered in the next 100 years from any two (T °F, P psig) points.
export function clausiusFit(t1F, p1Psig, t2F, p2Psig, patm = P_ATM) {
  if ([t1F, p1Psig, t2F, p2Psig].some((x) => x == null || !Number.isFinite(x))) return null;
  const T1 = t1F + 459.67, T2 = t2F + 459.67;
  const P1 = p1Psig + patm, P2 = p2Psig + patm;
  if (T1 <= 0 || T2 <= 0 || Math.abs(T1 - T2) < 1 || P1 <= 0.05 || P2 <= 0.05) return null;
  const B = Math.log(P2 / P1) / (1 / T1 - 1 / T2);
  if (B <= 0) return null;
  const A = Math.log(P1) + B / T1;
  return { A, B, patm };
}

export function clausiusPsat(fit, tF) {
  if (!fit || tF == null || !Number.isFinite(tF)) return null;
  const T = tF + 459.67;
  if (T <= 0) return null;
  return Math.exp(fit.A - fit.B / T) - fit.patm;
}

export function clausiusTsat(fit, psig) {
  if (!fit || psig == null || !Number.isFinite(psig)) return null;
  const P = psig + fit.patm;
  if (P <= 0.05) return null;
  return fit.B / (fit.A - Math.log(P)) - 459.67;
}

// gauge reading below zero → inches of mercury vacuum
export const inHg = (psig) => (psig < 0 ? -psig * 2.03602 : 0);
export const fromInHg = (inches) => -inches / 2.03602;

// ---------- psychrometrics & barometric pressure (sea level unless elevation/patm is given) ----------
export const P_ATM = 14.696; // psia at standard sea level
export const patmFromElev = (elevFt = 0) => (Number.isFinite(elevFt)
  ? P_ATM * Math.pow(1 - 6.87535e-6 * Math.max(-1500, Math.min(30000, elevFt)), 5.25588) : P_ATM);
export const airDensityFactor = (patm = P_ATM, tF = 70) => (patm / P_ATM) * (529.67 / (tF + 459.67));
const toK = (f) => (f - 32) / 1.8 + 273.15;
const toF = (k) => (k - 273.15) * 1.8 + 32;

// saturation vapor pressure over water / ice, Hyland & Wexler (ASHRAE Fundamentals), psia
// valid from −148 to 392 °F (−100 to 200 °C); null outside
export function pws(tF) {
  if (!fin(tF) || tF < -148 || tF > 392) return null;
  const T = toK(tF);
  let ln;
  if (T < 273.15) {
    ln = -5.6745359e3 / T + 6.3925247 - 9.677843e-3 * T + 6.2215701e-7 * T ** 2
      + 2.0747825e-9 * T ** 3 - 9.484024e-13 * T ** 4 + 4.1635019 * Math.log(T);
  } else {
    ln = -5.8002206e3 / T + 1.3914993 - 4.8640239e-2 * T + 4.1764768e-5 * T ** 2
      - 1.4452093e-8 * T ** 3 + 6.5459673 * Math.log(T);
  }
  return Math.exp(ln) / 6894.757293168;
}

export const humRatio = (pw, p = P_ATM) => (0.621945 * pw) / (p - pw);

// humidity ratio (lb/lb) from dry bulb and wet bulb, ASHRAE eq. 35/37 (IP)
export function wFromWb(db, wb, p = P_ATM) {
  if (!fin(db, wb, p) || pws(wb) === null) return null;
  const wsStar = humRatio(pws(wb), p);
  if (wb >= 32) return ((1093 - 0.556 * wb) * wsStar - 0.24 * (db - wb)) / (1093 + 0.444 * db - wb);
  return ((1220 - 0.04 * wb) * wsStar - 0.24 * (db - wb)) / (1220 + 0.444 * db - 0.48 * wb);
}

// RH past 100 % or below 0 isn't air: null rather than a clamped answer
const rhOk = (rh) => fin(rh) && rh >= 0 && rh <= 100;

export function wFromRh(db, rh, p = P_ATM) {
  if (!fin(db, p) || !rhOk(rh) || pws(db) === null) return null;
  return humRatio((rh / 100) * pws(db), p);
}

export function dewpoint(db, rh, p = P_ATM) {
  if (!fin(db) || !rhOk(rh) || rh <= 0 || pws(db) === null) return null;
  const pw = (rh / 100) * pws(db);
  let lo = -148, hi = db;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (pws(mid) > pw) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

export function wetbulb(db, rh, p = P_ATM) {
  const W = wFromRh(db, rh, p);
  if (W === null) return null;
  let lo = Math.max(-148, dewpoint(db, rh, p) ?? db - 60), hi = db;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (wFromWb(db, mid, p) > W) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

// null when the wet bulb is above the dry bulb or so far below it the air would be drier than dry
export function rhFromWb(db, wb, p = P_ATM) {
  if (!fin(db, wb) || wb > db + 0.5 || pws(db) === null) return null;
  const W = wFromWb(db, wb, p);
  if (W === null || W < -0.0005) return null;
  const pw = (Math.max(0, W) * p) / (0.621945 + Math.max(0, W));
  return Math.min(100, (100 * pw) / pws(db));
}

// enthalpy, Btu per lb of dry air
export const enthalpy = (db, W) => 0.24 * db + W * (1061 + 0.444 * db);

// ---------- charging and air-side targets ----------

// Fixed-orifice (piston) target superheat from return-air wet bulb and outdoor dry bulb.
// Inside the California ACM Table RD-2 range (outdoor 55–115 °F, wet bulb 50–76 °F) the table
// is used; outside it, the field formula (3 × WB − 80 − outdoor) / 2. Where the table has a dash
// (target under 5 °F, too hot and dry to charge by superheat) we return 5. Nameplate charts win.
export function foTargetSh(iwb, odb) {
  if (!fin(iwb, odb) || iwb < 20 || iwb > 100 || odb < -40 || odb > 140) return null;
  const T = CHG?.superheat;
  if (T && odb >= 55 && odb <= 115 && iwb >= 50 && iwb <= 76) {
    const v = grid2(T, odb, iwb);
    return v === null ? 5 : v;
  }
  const t = (3 * iwb - 80 - odb) / 2;
  return Math.max(5, Math.min(45, t));
}

// Target temperature split (return − supply dry bulb) across an A/C evaporator at 400 cfm per
// ton, from California ACM Table RD-3 (return dry bulb 70–84 °F × return wet bulb 50–76 °F).
// Outside the dry-bulb rows we shift by the table's own slope (≈0.55 °F per °F of return air).
export function splitTarget(db, wb) {
  if (!fin(db, wb) || wb > db + 0.5 || db < 40 || db > 120) return null;
  const T = CHG?.split;
  if (!T) return null;
  const dbc = Math.min(84, Math.max(70, db));
  const wbc = Math.min(76, Math.max(50, wb));
  let v = grid2(T, dbc, wbc);
  if (v === null) return null; // the table says these readings don't make sense together
  return v + 0.55 * (db - dbc);
}

// ---------- glycol ----------
export function glycolFreeze(pct, type = 'EG') {
  const arr = GLY?.[type === 'PG' ? 'MPG' : 'MEG'];
  if (!arr || !fin(pct) || pct < 0) return null;
  // Past 60 % the freeze point climbs back up (neat glycol freezes near +9 °F), and the table stops
  // there — so no number rather than a falsely reassuring one.
  if (pct > arr.length - 1) return null;
  const i = Math.min(Math.floor(pct), arr.length - 2);
  return arr[i] + (pct - i) * (arr[i + 1] - arr[i]);
}

export function glycolPctFor(freezeF, type = 'EG') {
  const arr = GLY?.[type === 'PG' ? 'MPG' : 'MEG'];
  if (!arr || !fin(freezeF)) return null;
  if (freezeF >= arr[0]) return 0;
  if (freezeF < arr[arr.length - 1]) return null;
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i + 1] <= freezeF) return i + (arr[i] - freezeF) / (arr[i] - arr[i + 1]);
  }
  return null;
}

// ---------- combustion (fuel oil: No. 2, kerosene, JP-8/AN8 are close enough here) ----------
// Siegert flue-gas loss, the standard field-analyzer formula: loss % = (Tflue − Tair)[°C] ×
// (A2 / (21 − O2) + B), with A2 = 0.68 and B = 0.007 for light fuel oil. That loss is against
// the fuel's lower heating value; US charts and analyzers quote efficiency on the higher heating
// value, so eff = (100 − loss) × LHV/HHV (0.935 for light oil, 0.90 for natural gas). Sensible
// flue loss only: no allowance for unburned fuel (CO, smoke) or jacket losses.
export function combustion({ stackF, airF = 70, o2, co = null, fuel = 'oil' }) {
  // O2 at room air or above, or a flue cooler than the air feeding the fire, is a probe problem, not a number
  if (!fin(stackF, airF, o2) || o2 < 0 || o2 >= 20.9 || stackF <= airF) return null;
  const A2 = fuel === 'gas' ? 0.66 : 0.68, B = fuel === 'gas' ? 0.009 : 0.007;
  const co2max = fuel === 'gas' ? 11.7 : 15.4;
  const lhvHhv = fuel === 'gas' ? 0.9 : 0.935;
  const dT = (stackF - airF) / 1.8;
  const loss = dT * (A2 / (21 - o2) + B);
  return {
    loss, effLHV: 100 - loss, eff: (100 - loss) * lhvHhv,
    co2: (co2max * (20.9 - o2)) / 20.9,
    excessAir: (100 * o2) / (20.9 - o2),
    coAirFree: fin(co) && co >= 0 ? (co * 20.9) / (20.9 - o2) : null,
    netStack: stackF - airF,
  };
}

// ---------- flow & fan/pump affinity laws ----------
// the sign of the temperature difference (supply − return or return − supply) doesn't matter
export const gpm = (btuh, dT, factor = 500) => (fin(btuh, dT, factor) && btuh > 0 && dT && factor > 0 ? btuh / (factor * Math.abs(dT)) : null); // water: 500
export const cfm = (btuhSensible, dT, patm = P_ATM) => (fin(btuhSensible, dT, patm) && btuhSensible > 0 && dT && patm > 0
  ? btuhSensible / (1.08 * (patm / P_ATM) * Math.abs(dT)) : null);

// Fan & pump affinity laws: Q2/Q1 = N2/N1, dP2/dP1 = (N2/N1)^2, BHP2/BHP1 = (N2/N1)^3
export function affinityLaws({ flow1, speed1, dp1 = null, bhp1 = null, speed2 = null, flow2 = null }) {
  let r = null;
  if (speed1 > 0 && speed2 > 0) r = speed2 / speed1;
  else if (flow1 > 0 && flow2 > 0) r = flow2 / flow1;
  if (r == null || !Number.isFinite(r) || r <= 0) return null;
  const pos = (x) => fin(x) && x > 0;
  return {
    ratio: r,
    flow2: pos(flow1) ? flow1 * r : pos(flow2) ? flow2 : null,
    speed2: pos(speed1) ? speed1 * r : pos(speed2) ? speed2 : null,
    dp2: pos(dp1) ? dp1 * r ** 2 : null,
    bhp2: pos(bhp1) ? bhp1 * r ** 3 : null,
  };
}

// ---------- 3-phase unbalance, motor derating & run capacitor impedance ----------
export function threePhase({ v1, v2, v3, i1, i2, i3 }) {
  const out = {};
  if ([v1, v2, v3].every((x) => x != null && Number.isFinite(x) && x > 0)) {
    const vAvg = (v1 + v2 + v3) / 3;
    const vMaxDev = Math.max(Math.abs(v1 - vAvg), Math.abs(v2 - vAvg), Math.abs(v3 - vAvg));
    const vUnbal = (100 * vMaxDev) / vAvg;
    // NEMA MG-1 derating curve (1 % → 1.00, 2 % → 0.95, 3 % → 0.88, 4 % → 0.82, 5 % → 0.75; don't run a
    // motor past 5 %), interpolated; extra winding temperature rise ≈ 2 × unbalance² percent.
    const curve = [[1, 1.0], [2, 0.95], [3, 0.88], [4, 0.82], [5, 0.75]];
    let derate = vUnbal <= 1 ? 1.0 : 0.75;
    for (let k = 0; k < curve.length - 1; k++) {
      const [x0, y0] = curve[k], [x1, y1] = curve[k + 1];
      if (vUnbal > x0 && vUnbal <= x1) derate = y0 + ((vUnbal - x0) * (y1 - y0)) / (x1 - x0);
    }
    out.vAvg = vAvg;
    out.vUnbal = vUnbal;
    out.tempRiseExtraPct = 2 * vUnbal ** 2;
    out.derate = derate;
  }
  if ([i1, i2, i3].every((x) => x != null && Number.isFinite(x) && x >= 0)) {
    const iAvg = (i1 + i2 + i3) / 3;
    if (iAvg > 0) {
      const iMaxDev = Math.max(Math.abs(i1 - iAvg), Math.abs(i2 - iAvg), Math.abs(i3 - iAvg));
      out.iAvg = iAvg;
      out.iUnbal = (100 * iMaxDev) / iAvg;
      out.singlePhased = Math.min(i1, i2, i3) < 0.1 * iAvg;
    }
  }
  if (out.singlePhased) {
    out.verdict = 'Single-phased: one leg carries almost no current (blown fuse, burnt contactor pole or open lead). Shut down immediately.';
  } else if (out.vUnbal != null && out.vUnbal > 2) {
    out.verdict = `Voltage unbalance (${out.vUnbal.toFixed(1)}%) exceeds the 2% limit — adds ~${Math.round(out.tempRiseExtraPct)}% extra winding heat. Check utility transformer, loose lugs or single-phase loads upstream.`;
  } else if (out.vUnbal != null && out.vUnbal <= 1.5 && out.iUnbal != null && out.iUnbal > 10) {
    out.verdict = `Voltage is balanced (${out.vUnbal.toFixed(1)}%) but current unbalance is high (${out.iUnbal.toFixed(0)}%) — points to a motor winding or rotor fault, not the supply.`;
  } else if (out.vUnbal != null || out.iUnbal != null) {
    out.verdict = 'Within normal 3-phase balance limits (voltage ≤ 2%, current ≤ 10%).';
  }
  return Object.keys(out).length ? out : null;
}

// Live capacitor microfarads from start-winding amps and voltage across capacitor terminals:
// uF = (10^6 * I) / (2 * pi * f * V) = 2652.58 * I / V at 60 Hz (3183.10 * I / V at 50 Hz)
export function capUnderLoad(amps, volts, hz = 60) {
  if (!fin(amps, volts, hz) || amps <= 0 || volts <= 0 || hz <= 0) return null;
  return (1e6 * amps) / (2 * Math.PI * hz * volts);
}
