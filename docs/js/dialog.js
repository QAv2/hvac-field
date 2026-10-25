// Voice dialog: what the app says for the current check, which words it listens for, and what a heard phrase means.
// No audio and no screen here — main.js supplies the job and carries out the returned action, so
// tools/voice_sim.mjs can drive a whole job with typed transcripts.
import { matchAnswer, spokenReading, COMMANDS } from './spoken.js';

export const JOB_COMMANDS = {
  save: ['save report', 'save the report', 'save it'], // "save as <name>" is handled in interpret()
  delete: ['delete job', 'delete the job', 'delete it'],
  name: ['name this unit', 'name the unit'],
};
const CHECK_COMMANDS = { ...COMMANDS, ...JOB_COMMANDS };
const YES = ['yes', 'yeah', 'yep', 'correct', 'right', 'affirmative'];
const NO = ['no', 'nope', 'negative', 'wrong'];
const SAY_NUM = ['one', 'two', 'three', 'four', 'five', 'six'];
const SAY_ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const NUM_WORDS = ('zero oh one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen '
  + 'seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand point minus negative '
  + 'below and a half pounds psi degrees fahrenheit celsius inches of water mercury amps volts hertz ohms kilo micro farads '
  + 'percent feet minutes').split(' ');

// text the phone's voice reads well: units spelled out, asides dropped
export function speakable(text) {
  return String(text ?? '')
    .replace(/\s*\([^()]*\)/g, '').replace(/[()]/g, '')
    .replace(/\s*°F\b/g, ' degrees').replace(/\s*°C\b/g, ' degrees Celsius').replace(/°/g, ' degrees')
    .replace(/(\d)\s*–\s*(\d)/g, '$1 to $2').replace(/(\d)\s*%/g, '$1 percent').replace(/%/g, ' percent')
    .replace(/\bpsig\b/g, 'P S I').replace(/\bpsi\b/g, 'P S I').replace(/\bΔT\b/g, 'temperature difference').replace(/Δ/g, 'delta ')
    .replace(/\bin\. w\.c\./g, 'inches of water').replace(/\bin\. Hg\b/g, 'inches of mercury')
    .replace(/µF/g, 'microfarads').replace(/µ/g, 'micro').replace(/kΩ/g, 'kilohms').replace(/Ω/g, 'ohms').replace(/≈/g, 'about ')
    .replace(/∞/g, 'infinite').replace(/\s+—\s+/g, ', ').replace(/\s{2,}/g, ' ').trim();
}

// an answer label read as an option: the part before the dash
const shortLabel = (label) => speakable(String(label).replace(/\s*\([^()]*\)/g, '').split(' — ')[0]);

// The current check as speech + the answers it takes. Options keep the KB's state order (= the spoken numbers).
// A state's own spoken keys come from `say:` in the KB when authored; numbers always work.
export function checkTurn(kb, sys, feature) {
  const f = feature;
  const labels = f.stateIds.map((s) => kb.fill(String(f.states[s]), sys));
  const options = f.stateIds.map((s, i) => ({ id: s, label: labels[i], keys: [...(f.say?.[s] || [])] }));
  const lines = [];
  if (f.caution) lines.push(`Before you do this: ${speakable(kb.fill(f.caution, sys))}`);
  lines.push(speakable(kb.ask(f, sys)));
  lines.push(options.map((o, i) => `${SAY_NUM[i] ?? i + 1}: ${shortLabel(o.label)}.`).join(' '));
  return { fid: f.id, lines, options, how: f.how ? speakable(kb.fill(f.how, sys)) : null };
}

const phrasesOf = (cmds) => Object.values(cmds).flat().map((p) => p.replace(/\bcant\b/, "can't").replace(/\bwhats\b/, "what's"));

// a number as the words someone would say for it: 155 → one hundred fifty five, and the trade way, one fifty five
const ONES_W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS_W = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const under100 = (n) => (n < 20 ? [ONES_W[n]] : [TENS_W[Math.floor(n / 10)], ...(n % 10 ? [ONES_W[n % 10]] : [])]);
export function numberWords(n) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n) || n < 0 || n > 9999) return [];
  if (n < 100) return under100(n);
  const words = [];
  if (n >= 1000) words.push(...under100(Math.floor(n / 1000)), 'thousand');
  const h = Math.floor((n % 1000) / 100), r = n % 100;
  if (h) words.push(ONES_W[h], 'hundred');
  if (r) words.push(...under100(r));
  if (n < 1000 && h && r) words.push(...under100(h), 'oh'); // "one fifty five", "one oh five"
  return words;
}

// the words of known unit names, for "save as galley walk in" in one breath
export function nameWords(names) {
  const out = new Set();
  for (const name of names) {
    for (const w of String(name).toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(Boolean)) {
      if (/^\d+$/.test(w)) numberWords(w).forEach((x) => out.add(x)); else out.add(w);
    }
  }
  return [...out];
}

// the words the recognizer may hear in each mode ([unk] = "something not on the list")
export function grammar(mode, options = [], names = []) {
  if (mode === 'check') return [...SAY_NUM.slice(0, options.length), ...SAY_ORD.slice(0, options.length), 'number', 'option',
    ...options.flatMap((o) => o.keys), ...phrasesOf(CHECK_COMMANDS), 'save as', ...nameWords(names), '[unk]'];
  if (mode === 'confirm') return [...YES, ...NO, 'repeat', 'say again', '[unk]'];
  if (mode === 'number') return [...NUM_WORDS, 'skip', "can't check", 'repeat', 'say again', 'undo', 'back', '[unk]'];
  return null; // free speech
}

const said = (heard) => String(heard ?? '').toLowerCase().replace(/\[unk\]/g, ' ').replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');

// heard text → what to do. turn = checkTurn(...) in check mode; unit = the input's unit in number mode.
export function interpret(mode, heard, { turn, unit } = {}) {
  if (mode === 'free') {
    const text = String(heard ?? '').replace(/\[unk\]/g, '').trim();
    return text ? { do: 'text', text } : { do: 'unclear' };
  }
  if (mode === 'check') {
    // "save as <name>": the save call. A name the recognizer didn't know comes back as [unk]; then ask for it.
    const sa = /^\s*save as\b(.*)$/i.exec(String(heard ?? ''));
    if (sa) {
      const rest = sa[1];
      const name = said(rest);
      return { do: 'saveas', name: /\[unk\]/.test(rest) || !name ? null : name };
    }
  }
  if (/\[unk\]/.test(heard ?? '')) return { do: 'unclear' };
  const s = said(heard);
  if (mode === 'confirm') {
    if (YES.includes(s)) return { do: 'yes' };
    if (NO.includes(s)) return { do: 'no' };
    if (['repeat', 'say again', 'again'].includes(s)) return { do: 'command', id: 'repeat' };
    return { do: 'unclear' };
  }
  if (mode === 'number') {
    const m = matchAnswer(heard, [], { repeat: COMMANDS.repeat, skip: COMMANDS.skip, undo: COMMANDS.undo });
    if (m.kind === 'command') return { do: 'command', id: m.id };
    const text = spokenReading(heard);
    return text == null ? { do: 'unclear' } : { do: 'reading', text, unit };
  }
  const m = matchAnswer(heard, turn.options, CHECK_COMMANDS);
  if (m.kind === 'answer') {
    const o = turn.options.find((x) => x.id === m.id);
    return { do: 'answer', fid: turn.fid, state: m.id, readback: `Got it: ${shortLabel(o.label)}.` };
  }
  if (m.kind === 'command') return { do: 'command', id: m.id };
  return { do: 'unclear' };
}
