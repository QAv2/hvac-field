// Speech → the text the app already understands. A recognizer hands back words ("sixty two pounds",
// "one twenty-five", "ten below", "point oh five micro farads"); spokenReading turns them into what a tech
// would type ("62 psi", "125", "-10", "0.05 uf") so calcs.readValue does the unit and range checks as before.
// matchAnswer maps a short utterance onto one answer of the current check, or a command, or nothing: it never
// guesses between two answers.

const ONES = { zero: 0, oh: 0, o: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const TEENS = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const MULT = { hundred: 100, thousand: 1000 };
const SIGN = new Set(['minus', 'negative', 'neg']);
const isNumWord = (w) => w in ONES || w in TEENS || w in TENS || w in MULT || /^\d+(?:[.,]\d+)?$/.test(w);

// longest phrase first; the value is a unit word calcs.readValue knows
const UNITS = [
  ['pounds per square inch gauge', 'psig'], ['pounds per square inch', 'psi'], ['p s i g', 'psig'], ['p s i a', 'psia'], ['p s i', 'psi'],
  ['psig', 'psig'], ['psia', 'psia'], ['psi', 'psi'], ['pounds', 'psi'], ['pound', 'psi'], ['lbs', 'psi'],
  ['kilopascals', 'kpa'], ['kilopascal', 'kpa'], ['k pa', 'kpa'], ['kpa', 'kpa'], ['bar', 'bar'],
  ['inches of mercury', 'inhg'], ['inches mercury', 'inhg'], ['inches of vacuum', 'inhg'], ['inches hg', 'inhg'],
  ['inches of water column', 'inwc'], ['inches water column', 'inwc'], ['inches of water', 'inwc'], ['inches w c', 'inwc'],
  ['water column', 'inwc'], ['inches', 'in'], ['inch', 'in'],
  ['degrees fahrenheit', '°F'], ['degrees f', '°F'], ['fahrenheit', '°F'],
  ['degrees celsius', '°C'], ['degrees c', '°C'], ['degrees centigrade', '°C'], ['celsius', '°C'], ['centigrade', '°C'],
  ['degrees', 'degrees'], ['degree', 'degrees'],
  ['percent', '%'], ['per cent', '%'],
  ['amperes', 'amps'], ['amps', 'amps'], ['amp', 'amps'], ['volts', 'volts'], ['volt', 'volts'], ['hertz', 'hz'], ['cycles', 'hz'],
  ['kilo ohms', 'kohm'], ['kilohms', 'kohm'], ['k ohms', 'kohm'], ['ohms', 'ohms'], ['ohm', 'ohms'],
  ['micro farads', 'uf'], ['microfarads', 'uf'], ['micro farad', 'uf'], ['microfarad', 'uf'], ['mfd', 'uf'], ['mic', 'uf'],
  ['feet', 'feet'], ['foot', 'feet'], ['meters', 'm'], ['metres', 'm'],
  ['minutes', 'minutes'], ['minute', 'minutes'], ['parts per million', 'ppm'], ['p p m', 'ppm'], ['ppm', 'ppm'],
  ['kilowatts', 'kw'], ['kilowatt', 'kw'], ['tons', 'tons'], ['ton', 'tons'],
].map(([p, u]) => [p.split(' '), u]);

function words(text) {
  return String(text ?? '').toLowerCase()
    .replace(/(\d),(\d{3})\b/g, '$1$2')          // 1,200 → 1200
    .replace(/([a-z])-(?=[a-z])/g, '$1 ')         // twenty-five, one-oh-five
    .replace(/(^|\s)-\s*(?=\d)/g, '$1minus ')     // -10
    .replace(/(\d)\s*°\s*([fc])?\b/g, (m, d, u) => `${d} ${u ? `degrees ${u}` : 'degrees'}`)
    .replace(/%/g, ' percent')
    .replace(/[^a-z0-9.,\s]/g, ' ')
    .split(/\s+/).filter(Boolean);
}

// Number words → a number. Without "hundred"/"thousand" the groups are read the way techs say pressures:
// "one twenty five" = 125, "one oh five" = 105, "two fifty" = 250. With them it's ordinary counting.
function parseNumber(ws, i) {
  const start = i;
  let neg = false;
  if (SIGN.has(ws[i])) { neg = true; i++; }
  const groups = [];        // [{ s: digit string }] for the spoken-group reading
  let total = 0, cur = 0, counting = false, any = false, intDone = false, dec = '', half = false;
  for (; i < ws.length; i++) {
    const w = ws[i];
    if (/^\d+(?:[.,]\d+)?$/.test(w)) {
      if (intDone) { dec += w.replace(/[.,]/g, ''); any = true; continue; }
      groups.push({ s: w.replace(',', '.') }); cur += Number(w.replace(',', '.')); any = true; continue;
    }
    if (w === 'a' && MULT[ws[i + 1]]) continue;
    if (w === 'and') {
      if (any && ws[i + 1] === 'a' && ws[i + 2] === 'half') { half = true; i += 2; continue; } // "two and a half"
      if (counting && isNumWord(ws[i + 1] || '')) continue;                                // "a hundred and five"
      break;
    }
    if (w === 'point' && !intDone) { intDone = true; any = true; continue; }   // "point five" = 0.5
    if (intDone) {
      if (w in ONES) { dec += String(ONES[w]); continue; }
      if (w in TEENS) { dec += String(TEENS[w]); continue; }
      if (w in TENS) { dec += String(TENS[w] / 10); if (ws[i + 1] in ONES && ONES[ws[i + 1]] > 0) { dec += String(ONES[ws[i + 1]]); i++; } else dec += '0'; continue; }
      break;
    }
    if (w in MULT) {
      counting = true; any = true;
      if (MULT[w] === 100) cur = (cur || 1) * 100;
      else { total += (cur || 1) * 1000; cur = 0; }
      continue;
    }
    if (w in TENS) {
      groups.push({ s: String(TENS[w]), tens: true }); cur += TENS[w]; any = true; continue;
    }
    if (w in TEENS) { groups.push({ s: String(TEENS[w]) }); cur += TEENS[w]; any = true; continue; }
    if (w in ONES) {
      const v = ONES[w];
      const last = groups[groups.length - 1];
      if ((w === 'oh' || w === 'o') && !any && ws[i + 1] !== 'point') break; // "oh" alone isn't a reading
      if ((w === 'oh' || w === 'o') && any && !(ONES[ws[i + 1]] > 0)) break;  // a trailing "oh" ("sixty two oh") isn't a zero
      if (last && last.tens && v > 0 && !last.closed) { last.s = String(Number(last.s) + v); last.closed = true; cur += v; continue; }
      if (v === 0 && (w === 'oh' || w === 'o') && ws[i + 1] in ONES && ONES[ws[i + 1]] > 0) {
        groups.push({ s: `0${ONES[ws[i + 1]]}` }); i++; any = true; continue;
      }
      groups.push({ s: String(v) }); cur += v; any = true; continue;
    }
    break;
  }
  if (!any) return null;
  let v = counting ? total + cur : Number(groups.map((g) => g.s).join('') || '0');
  if (dec) v = Number(`${v}.${dec}`);
  if (half) v += 0.5;
  if (ws[i] === 'below' && !neg) { neg = true; i++; if (ws[i] === 'zero') i++; }
  return { v: neg ? -v : v, end: i, start };
}

function unitAt(ws, i) {
  for (const [p, u] of UNITS) if (p.every((w, k) => ws[i + k] === w)) return { u, end: i + p.length };
  return null;
}

const fmt = (v) => String(Math.round(v * 1e6) / 1e6);

// "suction's sixty two pounds" → "62 psi"; "ten below" → "-10"; nothing numeric → null
export function spokenReading(text) {
  const ws = words(text);
  for (let i = 0; i < ws.length; i++) {
    const lead = isNumWord(ws[i]) || SIGN.has(ws[i]) || (ws[i] === 'a' && MULT[ws[i + 1]]) || (ws[i] === 'point' && isNumWord(ws[i + 1] || ''));
    if (!lead || ((ws[i] === 'oh' || ws[i] === 'o') && ws[i + 1] !== 'point')) continue;
    const n = parseNumber(ws, i);
    if (!n) continue;
    const u = unitAt(ws, n.end);
    let v = n.v;
    if (u && ws[u.end] === 'below' && v > 0) v = -v; // "ten degrees below zero"
    return u ? `${fmt(v)} ${u.u}` : fmt(v);
  }
  return null;
}

// "dorm one fifty five boiler" → "dorm 155 boiler": spoken numbers inside ordinary words, for matching names
export function numberWordsToDigits(text) {
  const ws = words(text);
  const out = [];
  for (let i = 0; i < ws.length;) {
    const startsNum = (ws[i] in ONES && ws[i] !== 'oh' && ws[i] !== 'o') || ws[i] in TEENS || ws[i] in TENS || (ws[i] === 'a' && MULT[ws[i + 1]]);
    const n = startsNum ? parseNumber(ws, i) : null;
    if (n && n.end > i) { out.push(fmt(n.v)); i = n.end; } else { out.push(ws[i]); i++; }
  }
  return out.join(' ');
}

// ---------- answers ----------
const ORD = [
  ['one', 'first', '1'], ['two', 'second', '2', 'to', 'too'], ['three', 'third', '3'],
  ['four', 'fourth', '4', 'for'], ['five', 'fifth', '5'], ['six', 'sixth', '6'],
];
const FILLER = new Set('uh um er ah okay ok so well its it is the a answer option number say i got'.split(' '));

export const COMMANDS = {
  repeat: ['repeat', 'say again'],
  how: ['how', 'how do i check', 'how do i check it'],
  skip: ['skip', 'cant check', 'can not check', 'cannot check'],
  undo: ['undo', 'back', 'go back', 'wrong'],
  leading: ['whats leading', 'what is leading', 'top causes'],
  numbers: ['numbers', 'readings', 'enter numbers'],
  other: ['other check', 'other checks'],
  stop: ['stop listening'],
};

const clean = (s) => String(s ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !FILLER.has(w));

// options: [{ id, keys: ['running', 'normal'] }] in the order they were read out (the numbers)
// → { kind: 'answer', id } | { kind: 'command', id } | { kind: 'unclear', heard }
// The whole utterance (fillers aside) must be one key, one number or one command. A recognizer held to a word list
// turns stray talk into list words ("what time is lunch" → "what turning one"), so anything extra, or any [unk]
// (the recognizer's "something not on the list"), is unclear, never a guess.
export function matchAnswer(heard, options, commands = COMMANDS) {
  if (/\[unk\]/.test(heard)) return { kind: 'unclear', heard };
  const ws = clean(heard);
  const said = ws.join(' ');
  if (!said) return { kind: 'unclear', heard };
  for (const [id, phrases] of Object.entries(commands)) if (phrases.some((p) => clean(p).join(' ') === said)) return { kind: 'command', id };
  const ids = new Set();
  const ord = ws.length === 1 ? ws[0] : ws.length === 2 && ['number', 'option'].includes(ws[0]) ? ws[1] : null;
  if (ord) ORD.slice(0, options.length).forEach((alts, k) => { if (alts.includes(ord)) ids.add(options[k].id); });
  for (const o of options) for (const key of o.keys || []) if (clean(key).join(' ') === said) ids.add(o.id);
  if (ids.size === 1) return { kind: 'answer', id: [...ids][0] };
  return { kind: 'unclear', heard, candidates: [...ids] };
}
