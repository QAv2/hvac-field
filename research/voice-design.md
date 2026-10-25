# Voice — design draft (2026-10-24, Opus 5.5)

Joe, 10-24: *"rather than rely on gloved hands … I will need to make this voice responsive, if I have to 'hey siri'
and then a command.. that's one thing but I also want to be able to speak into the app, a verbal callout like
'hey siri' but maybe something custom made would be better if possible."*

Goal: run a whole diagnosis hands-free with gloves on, hearing protection on, in a loud mechanical room, offline.
Platform routes (which recognizer, which wake word) are §6, from `research/voice-prior-art.md`. Sections 1–5 hold
whichever engine wins.

## 1. The loop

```
 wake (callout / push-to-talk / Siri)          ┌──────────── "repeat" ───────────┐
        │                                      ▼                                 │
  COMPLAINT ── dictated text ──► SYSTEM? ──► CHECK: caution (always) → question ──┤
  (free speech → existing           (read back "Walk-in      │                     │
   search: synonyms, negation,       freezer — right?")      ▼                     │
   clause split, startFromText)                         ANSWER (small grammar) ────┘
                                                             │
                                          read-back "Got: running backward." + big on screen
                                                             │  (a short undo window)
                                                             ▼
                                          next check …  /  "what's leading?" → top 3 + safety lines
```

- Every screen already exists. Voice is a driver on top of `startFromText`, `setFinding`, `skip`,
  `focus` and the readings inputs, not a second app. Anything voice does can be seen and undone by touch.
- Two listening modes, because the grammar differs:
  - **Free speech** (the complaint, notes): wide vocabulary, goes through the existing text search.
  - **Answer mode** (each check): a closed list of the check's states plus the global commands (§3). This is
    what makes an offline small model usable in noise: it only has to tell a few phrases apart.

## 2. Spoken answer keys

Data from the KB (10-24 build: 391 checks, 999 distinct answer labels, median 7 words, p90 14):
- The labels are written to be read, not said ("Pulled in but a pole or fuse is open — voltage lost across it").
- The first content word doesn't work as a key: it collides within the same check in **103 of 391** checks
  (ahu.fan: "Running…", "Not running…", "Motor runs…"; ahu.sat: "Supply air…" × 3).
- Yes/no can't be inferred from the question: 116 of the 195 two-state checks are phrased as yes/no questions,
  but the "yes" state flips with the wording ("Is the intake clear?" yes = clear; "Is the strainer plugged?"
  yes = plugged; "Are the coil tubes split?" yes = the bad state). A guessed mapping would invert a diagnosis.

So:
1. **Numbers always work.** The app reads the options as "one: running. two: not running. three: …" and
   accepts "one / two / three", "first / second", "option two". This is the fallback for every check from day one.
2. **Authored spoken keys.** A new optional field per state, e.g. `say: [running, normal]`, two or three short
   words a tech would actually say. Build rule (check.mjs): keys unique within a check, no key equal to a global
   command, no key that is a prefix of another in the same check. Content pass over 391 checks (≈ 1,000 states);
   blind-read like H2/H3 content.
3. **Yes/no only where the KB says so.** `say: [yes]` is authored per state; never derived from the phrasing.
4. The read-back always uses the state's short key + the screen shows the full label, so a mishear is caught.

## 3. Global commands (answer mode)

| say | does |
|---|---|
| repeat / say again | re-reads the caution (if any) and the question |
| how / how do I check | reads the `how` text |
| skip / can't check | `skip` |
| undo / back / wrong | removes the last finding set by voice, re-asks it |
| what's leading / top causes | reads the top 3 with percentages; a hazard cause's safety line first |
| numbers / readings | switches to entering the reading for this check (§4) |
| other check | reads the next 3 alternatives as numbers |
| stop listening / done | ends the voice session |

Short, acoustically distinct, few syllables apart. The final list gets tuned against the engine's confusions.

## 4. Numbers spoken

`calcs.readValue` already parses digits + unit ("62 psi", "-10", "12 kbtu"). Speech adds a layer in front:
- word numbers: "sixty two", "a hundred and eighteen", "minus ten", "negative four", "point five", "two and a half"
- trade idiom: "one twenty-five" = 125, "one-oh-five" = 105, "four-ten" is a refrigerant, not a reading
- unit words: "pounds" / "p s i" → psi, "degrees" → the box's unit, "inches" / "inches of water" → in. w.c.,
  "amps", "volts", "ohms", "micro amps"
- range check stays in `readValue` (an out-of-range number is read back as a question, not entered)

**Built 10-24:** `docs/js/spoken.js` — `spokenReading(heard)` → typed-style text for `readValue`, and
`matchAnswer(heard, options)` → answer / command / unclear (never a guess between two answers; a key said only
inside a longer key loses, so "not running" isn't "running"). `node tools/voice_check.mjs`: 65/65 (43 readings,
2 no-number, 20 answers). Not wired into the app yet. The readings screen gets a "say it" path that targets the
focused input (or the check's measure).

## 5. Noise, mishears, safety

- **Below the engine's confidence threshold → "Say again?"**, never a best guess. Two misses in a row → the app
  reads the options as numbers.
- **Read-back + undo window** on every answer; the screen shows what was heard in large type.
- **Cautions are read before the question, every time**, and can't be skipped by voice (159 of 391 checks carry
  one). "Repeat" re-reads the caution too.
- Hazard complaints (gas smell, CO, flame rollout) keep their existing safety-first ordering; the voice reads the
  safety line before anything else.
- The app's own speech must not trigger its own recognizer (half-duplex: stop listening while speaking).
- Test harness first: `tools/voice_sim.mjs` drives the loop with text transcripts (no audio), so the grammar,
  the keys and the commands are tested like scenarios; recorded noisy clips come later as fixtures.

## 5b. The app's own voice (pre-rendered clips vs the phone's voice)

Joe 10-24: *"I think I have elevenlab credits, 999 is a big number but not an insurmountable one."*
Two different 999s: the **tech's side** (what he says back) is solved by short keys authored in the KB (§2),
which is text work. The **app's side** (what it says) can be pre-rendered audio instead of the phone's built-in voice.

What the app would speak (10-24 build): questions 391 (32.9k chars) · cautions 159 (24.6k) · answer labels 999
(45.2k) · cause names 420 (37.6k) · safety lines 266 (50.4k) = **190.5k chars**; + how-to texts 274 (72.9k) =
263.4k. Roughly 3–3.5 h of audio, ~35–40 MB at 24 kbps mono, precached once before the ice.

- ElevenLabs key (API, 10-24): tier **payg**, 10,000 credits/month, 0 used, refreshes 2026-11-16, no extension.
  The full set is ~19× a month's allowance.
- Gemini 3.8 Flash-Lite TTS over OpenRouter ([[reference-gemini-38-tts]]: $0.011/min, 1.08 % WER benched):
  the full set ≈ $2–3.
- ElevenLabs' 10k fits two jobs: the fixed phrases said on every check (numbers, "Got:", "Say again?",
  "Before you do this:") if its voice wins, and/or a **test corpus of the tech's side** (short answers and
  readings in varied voices, mixed with machine-room noise) to measure the offline recognizer before Joe tries it.
- Casting per [[feedback-voice-register-fit]]: name the ethic (a partner reading checks to a tech in a loud room:
  level, clear, unhurried, never dramatic), blind audition with machine-room noise mixed in, meter intelligibility
  (recognizer word errors under noise), Joe picks blind.
- Clips are content-hashed (text → file); any text without a clip (a KB edit since the last render) falls back
  to the phone's voice, so content changes never break voice.

## 6. Platform routes (from research/voice-prior-art.md, 10-25; lead-verified: Vosk models page + npm)

**Pick: in-browser offline recognition with Vosk** (`vosk-browser` 0.0.8, Apache-2.0; model
`vosk-model-small-en-us-0.15`, 40 MB, Apache-2.0 — both checked at source 10-25). It is the only candidate with a
verified restricted-grammar option, which is what §1's answer mode needs, and it runs the same on the iPhone, the
laptop and Android. Downloaded once as an optional "voice pack", cached for offline.

- **One recognizer, three grammars**: the callout (wake phrase + `[unk]`), the current check's answers + commands,
  and free speech for the complaint. A foreground-only wake word doesn't need a second model.
- **Ruled out**: Web Speech as the main route (Chrome's is server-backed; Firefox has it off; WebKit said in 2021 it
  isn't available in Home Screen apps and never said otherwise). openWakeWord (models CC BY-NC-SA), Porcupine
  (AccessKey at init, revocable trial). whisper small (466 MiB, over the iOS page budget; no grammar).
- **Held as fallbacks**: sherpa-onnx KWS for the callout (Apache-2.0 code; model license UNVERIFIED — read it before
  shipping); Moonshine tiny via transformers.js (MIT, ~28 MB int8) for free speech if Vosk's free mode is too weak.
- **Siri route**: Hey Siri → Shortcut → open the app at `#/?q=<dictated>` — four unknowns (Siri offline, Dictate
  Text offline on the 14, Open URL lands in Safari or the Home Screen app, fragment survives). Phone test only.
- **Push-to-talk stays**: a big hold-to-talk button is the default; the callout is the add-on (Vocollect/RealWear
  pattern: headset close-talk mic, short prompts, confirm numbers).
- **Mic**: plan for a wired boom mic / ear-defender headset; Bluetooth mic capture in Safari has an open WebKit bug
  (189645) — test it with the actual headset.

### The gate: the iPhone 14 device test (one sitting, Joe + phone)
1. Mic in a Safari tab and in the Home Screen app (getUserMedia).
2. The 40 MB model loads and survives a reload (iOS WASM memory budget: 300–500 MB after reload on iOS 17).
3. Grammar recognition: say "two", "not running", "sixty-two pounds" — in airplane mode.
4. The phone's own voice speaks in airplane mode, in the Home Screen app.
5. (Optional) Web Speech in airplane mode; the Siri Shortcut chain; a Bluetooth headset.

### Before the phone: the bench (laptop, headless)
Feed recorded utterances straight into the recognizer (no mic) in Playwright Firefox and WebKit: grammar-mode
accuracy and latency per noise level (clean, 10, 5, 0 dB SNR against machine-room-like noise), free-mode
accuracy on complaints. Corpus = the tech's side, synthesized (ElevenLabs credits, §5b) in several voices.
