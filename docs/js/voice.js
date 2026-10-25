// Voice I/O for the app: the offline recognizer (Vosk, from the voice pack), the microphone, hold-to-talk, and the
// phone's own voice for speaking. What the words mean lives in dialog.js; main.js decides what to do with them.
// Nothing here needs a connection once the voice pack has been loaded once.

const PACK = 'voice/vosk.js';
const MODEL = 'voice/vosk-model-small-en-us-0.15.tar.gz';

let model = null, ctx = null, stream = null, sink = null, ready = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Vosk) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('voice pack not available offline yet'));
    document.head.appendChild(s);
  });
}

// Must start from a tap (iOS opens the microphone and audio only on a user gesture).
export function start(onProgress = () => {}) {
  if (ready) return ready;
  ready = (async () => {
    onProgress('Opening the microphone…');
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = (e) => { if (sink) sink(e.inputBuffer); };
    src.connect(proc); proc.connect(ctx.destination);
    onProgress('Loading the voice pack (the first time downloads about 41 MB)…');
    await loadScript(PACK);
    // an absolute URL: the recognizer keeps the unpacked model in the phone's storage under this name
    model = await window.Vosk.createModel(new URL(MODEL, location.href).href, -1);
    navigator.storage?.persist?.().catch(() => {});
    primeSpeech();
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

export function stop() {
  stopSpeaking();
  sink = null;
  stream?.getTracks().forEach((t) => t.stop());
  ctx?.close().catch(() => {});
  model?.terminate();
  model = ctx = stream = ready = null;
}

export const isOn = () => model != null;

// One utterance: feed the mic from press() until release(); the final text arrives through onText.
// The recognizer answers every audio chunk with one event and the final request with one result, so the count says when it's done.
export function press(grammar, onText) {
  if (!model || !ctx) return null;
  if (ctx.state !== 'running') ctx.resume().catch(() => {}); // after a call or Siri the audio can sit suspended
  stopSpeaking(); // talking over the app cuts it off
  const rec = grammar ? new model.KaldiRecognizer(ctx.sampleRate, JSON.stringify(grammar)) : new model.KaldiRecognizer(ctx.sampleRate);
  const st = { sent: 0, seen: 0, texts: [], released: false };
  const tick = () => { st.seen++; if (st.released && st.seen === st.sent + 1) { rec.remove(); onText(st.texts.filter(Boolean).join(' ').trim()); } };
  rec.on('result', (m) => { st.texts.push(m.result.text); tick(); });
  rec.on('partialresult', tick);
  sink = (buf) => { rec.acceptWaveform(buf); st.sent++; };
  return {
    release() { if (st.released) return; st.released = true; sink = null; rec.retrieveFinalResult(); },
  };
}

// ---------- speaking ----------
// say() resolves to one flag per line: true = it played to the end (or there's no voice to play it on — the screen
// shows the text), false = it was cut off. Cutting off (stopSpeaking) also drops lines queued behind it.
let speakQueue = Promise.resolve();
let gen = 0, dry = false;
const live = new Set(); // resolvers of lines in flight, settled at once when speech is cut off
function primeSpeech() { try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch { /* no speech output */ } }
export const spokenLog = []; // dry mode: what would have been said
export function setDry(on) { dry = on; } // tests: everything "plays" instantly, nothing is spoken

export function stopSpeaking() {
  gen++;
  for (const r of live) r(false);
  live.clear();
  try { speechSynthesis.cancel(); } catch { /* none */ }
}

export function say(lines) {
  const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
  if (dry) spokenLog.push(...list);
  if (dry || !list.length || !('speechSynthesis' in window)) return Promise.resolve(list.map(() => true));
  const g = gen;
  const run = () => (g !== gen ? Promise.resolve(list.map(() => false)) : Promise.all(list.map((text) => new Promise((resolve) => {
    let settled = false;
    const done = (ok) => { if (settled) return; settled = true; clearTimeout(cap); live.delete(done); resolve(ok); };
    live.add(done);
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    // some phones never fire onend: after a generous wait, a line that wasn't cut off counts as played
    const cap = setTimeout(() => done(g === gen), 4000 + text.length * 90);
    u.onend = () => done(g === gen);
    u.onerror = (e) => done(e.error === 'interrupted' || e.error === 'canceled' ? false : g === gen); // a voice that can't speak: the screen has it
    speechSynthesis.speak(u);
  }))));
  speakQueue = speakQueue.then(run, run);
  return speakQueue;
}
