// Spoken input checks: what a recognizer hands back → the reading the app enters, and short answers →
// the check's answer or a command. Run: node tools/voice_check.mjs
import { spokenReading, matchAnswer } from '../docs/js/spoken.js';
import { readValue } from '../docs/js/calcs.js';

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log(`FAIL ${msg}`); } };

// [heard, box unit, value the box should get (null = refused)]
const READINGS = [
  ['sixty two', 'psig', 62], ['sixty two pounds', 'psig', 62], ['suction is sixty-two psi', 'psig', 62],
  ['one twenty five', 'psig', 125], ['one twenty-five pounds', 'psig', 125], ['one oh five', '°F', 105],
  ['two fifty', 'psig', 250], ['three eighteen', 'psig', 318], ['one one eight', 'psig', 118],
  ['a hundred and eighteen', 'psig', 118], ['one hundred twenty five', 'psig', 125], ['twelve hundred', 'V', 1200],
  ['two thousand four hundred', 'Ω', 2400], ['minus ten', '°F', -10], ['negative four degrees', '°F', -4],
  ['ten below', '°F', -10], ['ten below zero', '°F', -10], ['thirty two degrees fahrenheit', '°F', 32],
  ['point five', 'in. w.c.', 0.5], ['zero point five inches of water', 'in. w.c.', 0.5], ['point oh five', 'in. w.c.', 0.05],
  ['two and a half', 'A', 2.5], ['seven point two amps', 'A', 7.2], ['two hundred and eight volts', 'V', 208],
  ['forty five micro farads', 'µF', 45], ['forty-five mic', 'µF', 45], ['ninety percent', '%', 90],
  ['twenty eight inches of mercury', 'in. Hg', 28], ['sixty hertz', 'Hz', 60], ['62 psi', 'psig', 62],
  ['118', 'psig', 118], ['-10', '°F', -10], ['1,200 volts', 'V', 1200], ['zero', 'A', 0], ['oh point five', 'A', 0.5],
  ['five degrees celsius', '°F', null], ['sixty two amps', 'psig', null], ['twenty', 'psig', 20], ['twenty twenty', 'V', 2020],
  ['four point two kilo ohms', 'Ω', 4200], ['ten kilopascals', 'psig', 1.45], ['three hundred fifty', '°F', 350],
  ['ten degrees below zero', '°F', -10], ['five degrees below', '°F', -5], ['minus ten degrees fahrenheit', '°F', -10],
  ['sixty two oh', 'psig', 62], ['twenty below zero', '°F', -20],
];
for (const [heard, unit, want] of READINGS) {
  const text = spokenReading(heard);
  const v = text == null ? null : readValue(text, unit).v;
  const good = want === null ? v === null : v != null && Math.abs(v - want) < 0.01;
  ok(good, `reading "${heard}" [${unit}] → "${text}" → ${v}, want ${want}`);
}
ok(spokenReading('the fan is not running') === null, 'no number in plain words');
ok(spokenReading('oh') === null, '"oh" alone is not a reading');

// answers: options in read-out order
const FAN = [
  { id: 'running', keys: ['running', 'turning'] },
  { id: 'off', keys: ['not running', 'off', 'silent'] },
  { id: 'slip', keys: ['wheel not turning', 'belt'] },
  { id: 'trips', keys: ['trips', 'hums'] },
];
const ANSWERS = [
  ['two', 'answer', 'off'], ['number two', 'answer', 'off'], ['second', 'answer', 'off'], ['to', 'answer', 'off'],
  ['four', 'answer', 'trips'], ['five', 'unclear'], ['off', 'answer', 'off'], ['uh it\'s off', 'answer', 'off'],
  ['not running', 'answer', 'off'], ['running', 'answer', 'running'], ['belt', 'answer', 'slip'],
  ['repeat', 'command', 'repeat'], ['say again', 'command', 'repeat'], ['undo', 'command', 'undo'], ['what\'s leading', 'command', 'leading'],
  ['can\'t check', 'command', 'skip'], ['stop listening', 'command', 'stop'],
  ['running not running', 'unclear'], ['the motor is running but the wheel is not turning and it trips', 'unclear'], ['', 'unclear'],
  ['banana', 'unclear'], ['what turning one', 'unclear'], ["what's hums one", 'unclear'], ['what [unk] [unk]', 'unclear'],
  ['[unk] off', 'unclear'], ['what', 'unclear'], ['done', 'unclear'], ['it is off', 'answer', 'off'],
];
for (const [heard, kind, id] of ANSWERS) {
  const r = matchAnswer(heard, FAN);
  ok(r.kind === kind && (id === undefined || r.id === id), `answer "${heard}" → ${JSON.stringify(r)}, want ${kind} ${id ?? ''}`);
}

console.log(`${n - fail}/${n} voice checks pass`);
process.exit(fail ? 1 : 0);
