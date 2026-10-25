# Field Dx voice control: prior-art and feasibility sweep

Status date: 2026-10-25. Bound: about 25 to 30 minutes of research, no device tests.

Tag key: **VERIFIED** = I read the primary source, spec, code, or license file (or the registry/API record) myself. **UNVERIFIED** = I only saw a search snippet, a secondary or vendor claim, or nothing at all; or it is my inference and I say so.

Evidence cache (raw READMEs, LICENSE files, API JSON) is in the scratchpad at `/tmp/claude-1000/-home-joseph/59e1c46c-5b5d-467b-86f8-6c112c1e4e2c/scratchpad/src/`. It is downloaded third-party content, treated as data.

---

## Bottom line

1. **iPhone, offline, home-screen app: no route is verified to work end to end.** Web Speech recognition is historically unavailable in Home Screen web apps (WebKit, 2021, not reversed in any later WebKit comment I could read). Current behavior on iOS 26/27 is UNVERIFIED without a device test. Treat the iPhone as "needs a 30-minute device test matrix before we build on it."
2. **Most plausible offline iPhone route: in-browser WASM recognition** (sherpa-onnx WASM, or Moonshine via transformers.js ONNX, or vosk-browser) fed by `getUserMedia` at 16 kHz. This is inference from code licenses and sizes. Its iOS Safari run is UNVERIFIED.
3. **Memory is the binding iPhone constraint.** WebKit's own bug reports on iOS 17 show about 300 to 500 MB usable after reload. A 20 to 50 MB quantized model fits. whisper.cpp "small" (466 MiB) does not, and "tiny" (75 MiB) is marginal.
4. **Laptop (Linux, Chrome or Firefox): the offline route is WASM, not Web Speech.** Chrome's Web Speech uses a server (MDN, VERIFIED). Firefox has the API disabled by default (caniuse, VERIFIED). Best laptop route: vosk-browser or sherpa-onnx WASM.
5. **Best constrained-grammar candidate: vosk-browser.** Its code passes an optional grammar string into the Vosk recognizer (VERIFIED in source). Model `vosk-model-small-en-us-0.15` is 40 MB, Apache-2.0 (VERIFIED, Vosk models page).
6. **Best custom wake-word candidate: sherpa-onnx open-vocabulary keyword spotting.** Keywords are a text file with no retraining (VERIFIED docs), Apache-2.0 code (VERIFIED), and a WASM KWS demo exists in the repo (VERIFIED). **Its bundled model license is UNVERIFIED.** Check it before shipping.
7. **Ruled out for shipping:** openWakeWord's pretrained models are CC BY-NC-SA 4.0 (non-commercial, VERIFIED). Porcupine needs a Picovoice AccessKey at engine init and its free-trial access is revocable at Picovoice's discretion (VERIFIED terms). A reported free-tier shutdown on 2026-06-30 is UNVERIFIED at a primary Picovoice source.
8. **Speech output:** iOS SpeechSynthesis works in Safari tabs and its offline/standalone behavior is UNVERIFIED. Treat it as a prerequisite to test, not a given.
9. **Headset:** WebKit bug 189645 (Bluetooth mic not capturing in Safari web pages) is still open (last modified 2022). Opening the mic likely drops AirPods to 8 to 16 kHz HFP (secondhand, UNVERIFIED). Plan on a wired ear-defender boom mic, and test Bluetooth separately.
10. **Confidence:** high on license and size facts (I read the files). Low on any iOS runtime behavior (no device tests, no iOS source-level proof). The biggest open items are the sherpa KWS model license and the iPhone 14 standalone mic and recognition test.

---

## 1. iOS Safari and Home Screen web apps: Web Speech SpeechRecognition

**Availability (caniuse, fetched 2026-10-25, page undated):**
- iOS Safari: "Partial" from 14.5 to 26.6, 27.0, and 27.1 to 27.2. Not supported before 14.5. The table does not separate `webkitSpeechRecognition` from the unprefixed name. Source: https://caniuse.com/speech-recognition. **VERIFIED** (I read the table); the "partial" meaning is not defined on the page.
- Safari desktop: same pattern, partial from 14.1. **VERIFIED.**
- Firefox desktop: disabled by default from 22 onward (caniuse). **VERIFIED.**
- Chrome Android: partial from 156 (caniuse). **VERIFIED.**

**Network and on-device (MDN, fetched 2026-10-25):**
- MDN says "On some browsers, like Chrome, using Speech Recognition on a web page involves a server-based recognition engine. Your audio is sent to a web service for recognition processing, so it won't work offline." Source: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition. **VERIFIED.**
- MDN documents `processLocally` and `SpeechRecognition.install()` for on-device recognition, without naming any browser that supports them. **VERIFIED** (text); browser support **UNVERIFIED.**
- MDN marks the feature "Limited availability." **VERIFIED.**
- WebKit's own IDL for `SpeechRecognition` has `EnabledBySetting=SpeechRecognitionEnabled` and `SecureContext`, and no `processLocally` attribute. Source: https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/Modules/speech/SpeechRecognition.idl (WebKit main branch, read 2026-10-25). **VERIFIED.** So Safari is not exposing an on-device switch to pages in this IDL.
- A macOS 26 test reported by Addpipe (2026-08-17) says `webkitSpeechRecognition` prompted about sending data to Apple and did not work offline. Source: https://blog.addpipe.com/apple-speechanalyzer-api/. **VERIFIED** as the author's report; I did not reproduce it, and it is macOS, not iOS. Inference: Safari's Web Speech path is server-backed, so it is not an offline route. **UNVERIFIED** for iOS.

**Home Screen (standalone) mode, historically broken:**
- WebKit bug 225298 (filed 2021-05-03; status RESOLVED, resolution LATER). On 2021-05-04, WebKit engineer Sihui Liu wrote: "SpeechRecognition API is not available in SafariViewController and web apps added to Home Screen for now. There are some implementation details we need to figure out before we can enable it." Source: https://bugs.webkit.org/show_bug.cgi?id=225298. **VERIFIED.**
- The same bug has no WebKit engineer comments after 2021. Users asked for an update through 2025-03-01 (last comment in the record). **VERIFIED.**
- WebKit main source, read 2026-10-25: the permission path in `SpeechRecognitionPermissionManager.cpp` checks the microphone (AVCaptureDevice), the usage-description string, and the speech-service access, then asks the user. I found no standalone or Home Screen gate in the files I read. Source: https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebKit/UIProcess/SpeechRecognitionPermissionManager.cpp (the file sits directly in `UIProcess`, not in a `Speech` subfolder). **VERIFIED** (absence in the files I read). **Inference:** the 2021 gate may have been removed. Whether it works in a Home Screen app on iOS 26/27 is **UNVERIFIED** and needs a device test.

**Continuous and interimResults:**
- WebKit passes `m_continuous` and `m_interimResults` to its speech connection (`SpeechRecognition.cpp`, around line 92). Source: https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/Modules/speech/SpeechRecognition.cpp. **VERIFIED.**
- An Apple Developer Forums thread (created 2022-02, "iPAD & iOS 15 - webkitSpeechRecognition not working") reports that with continuous mode the mic never stops and no text comes back. No Apple reply. Source: https://developer.apple.com/forums/thread/699881. **VERIFIED** as the reporter's claim. Recommendation (inference): use `continuous = false` and restart per utterance.

**Repeated permission prompts:** the permission manager runs a per-request user check (`m_userPermissionCheck`), but I did not find whether iOS persists the grant per origin in a Home Screen app. **UNVERIFIED / gap.**

**Known WebKit bugs seen but not read:** bug 239816 (https://bugs.webkit.org/show_bug.cgi?id=239816) surfaced in search. I did not read it. **UNVERIFIED.**

**Apple's native engine:** SpeechAnalyzer ships in iOS 26 and runs on-device with no network call in the transcription path. Addpipe reports no JavaScript binding and no browser exposure, and says a web app would need a native bridge (for example a React Native module). Source: https://blog.addpipe.com/apple-speechanalyzer-api/ (post date 2026-08-17). **VERIFIED** as the author's statement; the iOS 26 SpeechAnalyzer fact is UNVERIFIED against Apple's own docs.

**Safari release notes:** the Safari 26.0 release notes page at https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes returned only a title. I could not check it for speech changes. **Gap.**

---

## 2. getUserMedia on iOS home-screen apps, and memory limits for in-browser models

**getUserMedia in a Home Screen app:** UNVERIFIED. I did not find a source that confirms or denies it on current iOS. Plan a device test. The sherpa-onnx WASM KWS demo uses `getUserMedia` with `AudioContext({sampleRate: 16000})` and `createScriptProcessor` (VERIFIED in https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/wasm/kws/app.js). Whether iOS honors the 16000 request is **UNVERIFIED.**

**WebAssembly memory on iOS (WebKit bug 269777):**
- Filed 2024-02-20 on Safari 17 / iOS 17. Tested on iPhone Xs (iOS 17.0.3), iPad Pro 12.9 3rd gen (iOS 17.2), iPhone 12 (iOS 17.3.1), iPhone 14 Pro (iOS 17.3.1, 6 GB RAM). Source: https://bugs.webkit.org/show_bug.cgi?id=269777. **VERIFIED.**
- Measurements: first load about 1 GB allocatable, after reload about 300 to 500 MB, worst case 28 MB on one iPhone Xs. Reporter expected up to 4 GB. **VERIFIED.**
- Status: RESOLVED as a duplicate of bug 269937 on 2024-02-22 by Justin Michaud. No fix or version stated in the record I read. **VERIFIED.**
- **Gap:** whether iOS 26 or 27 changed this. I did not confirm. **UNVERIFIED.**
- **Inference:** budget about 300 MB total for the page (model, runtime, and UI). A model of 20 to 50 MB fits. whisper.cpp "small" (466 MiB ggml file, per its README) does not.

**AudioWorklet:** the caniuse AudioWorklet page did not return a support table to my fetch. **Gap.** Both vosk-browser's README example and sherpa-onnx's WASM KWS demo use `createScriptProcessor`, a deprecated API. This is VERIFIED from code. Using it avoids an AudioWorklet dependency, at the cost of deprecation risk.

**WebGPU on iOS 26:** a trade-press claim (App Developer Magazine, August 2025) says iOS 26 has full WebGPU support. Source: https://appdevelopermagazine.com/WebGPU-in-iOS-26/. **UNVERIFIED** (not checked against WebKit or Apple release notes). Do not design around it.

---

## 3. SpeechSynthesis (spoken prompts) on iOS

- Search-snippet evidence (not read at source, so **UNVERIFIED**): Apple Developer Forums threads say `speechSynthesis.getVoices()` returns only preinstalled voices, not downloadable ones (e.g., https://developer.apple.com/forums/thread/723503). Other threads report that Safari requires a user gesture before speech and that the voice list can be empty on first load (BotFramework WebChat issue #995, https://github.com/microsoft/BotFramework-WebChat/issues/995, and a Read-Aloud compatibility guide, https://read-aloud.com/guide-browser-compatibility.html).
- Silent-switch behavior: one forum report says a soft-muted device stays silent for Safari TTS while Siri still plays. **UNVERIFIED.**
- Offline: iOS system voices are on-device by design in my understanding, but I did not find a primary Apple or WebKit source. **UNVERIFIED.**
- Home Screen mode: no evidence found either way. **Gap.**
- **Design implication (inference):** the tap that starts the app should also prime speech output (one `speak('')` on a user gesture), and the app should show text as well as speaking it.

---

## 4. Siri Shortcuts route (Hey Siri → Dictate Text → Open URL)

- **Dictate Text, offline:** a search snippet of Apple's support pages paraphrases that dictation requests are processed on the device in many languages with no internet connection required, and that text dictated into a search box may go to the search provider. Paraphrase, not a quote. Source: https://support.apple.com/es-us/HT208343 (I could not read the body; the fetch returned navigation only). **UNVERIFIED** (snippet only). Apple's current page is https://support.apple.com/guide/iphone/dictate-text-iph2c0651d2/ios (I could not read its body either).
- Older Apple Community threads say offline dictation needs iPhone 6s or later, and that language coverage is partial (secondhand, UNVERIFIED). iPhone 14 (A15) is not confirmed for offline Dictate Text by any source I read. **UNVERIFIED.**
- **Hey Siri trigger:** Apple's Shortcuts guide has a "Run shortcuts with Siri" section (title only, https://support.apple.com/guide/shortcuts/welcome/ios). **VERIFIED** that the title exists; the behavior is UNVERIFIED.
- **Open URLs target (Safari or Home Screen app):** not confirmed by a primary source. A third-party guide (Taethni) implies plain https links open in Safari, with a browser prefix for other browsers. Source: https://taethni.atlassian.net/wiki/x/AYA-N. **UNVERIFIED** (inference). A Glide community thread describes a `webapp://` prefix for opening installed web apps from iOS 26 beta, with a commenter saying Android does not support it. Source: https://community.glideapps.com/t/ios-26-beta-opening-an-installed-web-app-with-an-open-url-action/82464. **UNVERIFIED**, and not a documented Apple mechanism.
- **Scope rule (background, UNVERIFIED):** a 2018 W3C public-webapps mailing-list post says Safari defines no default manifest scope, so links can stay in the Home Screen window unless a scope is declared (https://lists.w3.org/Archives/Public/public-webapps-github/2018Jan/0997.html). Not read at source.
- **Text into the URL:** the Shortcut must percent-encode dictated text before it goes into `#/?q=...` (standard URL rule, inference). I did not verify the Shortcuts action name for this.
- **Practical read:** the Siri chain has four unknowns (Siri's offline behavior, Dictate Text's offline behavior on this phone, where Open URL lands, and whether the home-screen app receives the fragment). Each needs a test on the iPhone 14. **Gap.**

---

## 5. In-browser offline recognition engines

### 5a. vosk-browser (Vosk compiled to WASM)
- **Code license:** Apache-2.0. npm registry `version 0.0.8` (https://registry.npmjs.org/vosk-browser/latest) and GitHub license API (https://api.github.com/repos/ccoreilly/vosk-browser). **VERIFIED.**
- **Repo:** https://github.com/ccoreilly/vosk-browser (GitHub API `pushed_at` 2025-12-07; no GitHub release). **VERIFIED.**
- **Grammar / restricted vocabulary:** yes. `KaldiRecognizer(sampleRate, grammar?)` in `lib/src/model.ts`, and `worker.ts` passes the grammar to `new Vosk.Recognizer(model, sampleRate, grammar)`. The grammar is a string (JSON word list, as in Vosk). `setWords(true)` is also exposed. Source: https://raw.githubusercontent.com/ccoreilly/vosk-browser/master/lib/src/model.ts and worker.ts. **VERIFIED.**
- **Streaming:** `partialresult` and `result` events (README, https://raw.githubusercontent.com/ccoreilly/vosk-browser/master/README.md). **VERIFIED.**
- **Model options and licenses** (Vosk models page, https://alphacephei.com/vosk/models, read 2026-10-25):
  - `vosk-model-small-en-us-0.15`: 40 MB, Apache 2.0, "Lightweight wideband model for Android and RPi." **VERIFIED.**
  - `vosk-model-en-us-0.22-lgraph`: 128 MB, Apache 2.0, "Big US English model with dynamic graph." **VERIFIED.** The dynamic graph should allow per-session vocabulary changes, but I did not confirm this in the browser build (**UNVERIFIED**).
  - `vosk-model-small-en-us-zamia-0.5`: 49 MB, **LGPL-3.0.** Avoid (copyleft).
  - `vosk-model-en-us-daanzu-20200905` and `-lgraph`: **AGPL.** Avoid.
- **iOS / phone evidence:** none found for vosk-browser in Safari. The Vosk models page says the small Android/iOS models are "lightweight wideband" for Android and iOS, which refers to the native Vosk library, not the browser build. **Gap** for browser iOS.
- **Phone latency:** an unsourced April 2026 Chinese blog gives about 50 MB memory for small models. Not a source I can cite. **UNVERIFIED.**
- **Caveat:** the README example uses the deprecated `createScriptProcessor`. **VERIFIED.**

### 5b. sherpa-onnx (k2-fsa), WASM ASR and KWS
- **Code license:** Apache-2.0 (GitHub API license, and README "Apache-2.0 license"). **VERIFIED.** LICENSE file text not read.
- **WASM:** the README says "It also supports WebAssembly." The repo has `wasm/asr`, `wasm/kws`, `wasm/vad`, and others. Source: https://api.github.com/repos/k2-fsa/sherpa-onnx/contents/wasm. **VERIFIED.**
- **Streaming ASR in browser:** the README lists real-time ASR demos (Zipformer, Paraformer, English models) in WASM. The page calls them "Real-time." **VERIFIED** as listed; "streaming" is my inference.
- **Keyword spotting (KWS):**
  - Open-vocabulary, no retraining: "you can specify any keywords without re-training the model." Source: https://k2-fsa.github.io/sherpa/onnx/kws/index.html. **VERIFIED.**
  - Keywords go in a file as encoded BPE/token strings with optional boost (`:score`) and threshold (`#th`). The `sherpa-onnx-cli text2token` tool converts text phrases. **VERIFIED.**
  - Decoder: beam search only, per the docs. **VERIFIED.**
  - A browser KWS demo exists: `wasm/kws/index.html`, `app.js`, and `sherpa-onnx-wasm-main-kws.cc`. The app streams the mic into the keyword spotter and fires on `result.keyword`. Sources: https://api.github.com/repos/k2-fsa/sherpa-onnx/contents/wasm/kws and https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/wasm/kws/app.js. **VERIFIED.**
- **KWS model sizes** (GitHub release `kws-models`, read 2026-10-25): `sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01.tar.bz2` 17.6 MB (mobile variant 15.7 MB); `...wenetspeech-3.3M-2024-01-01` 32.7 MB; `...zh-en-3M-2025-12-20` 32.9 MB. Source: https://api.github.com/repos/k2-fsa/sherpa-onnx/releases/tags/kws-models. **VERIFIED.**
- **KWS model license: UNVERIFIED.** The docs page and the release list state no model license. The GigaSpeech training-data terms are also unverified by me. **Must check before shipping.**
- **iOS:** the repo includes iOS build scripts, Swift and SwiftUI examples, and a Package.swift (README file listing). **VERIFIED** as native iOS support. A Safari run of the WASM build is **UNVERIFIED** (no source found).

### 5c. whisper.cpp (ggml) with WASM examples
- **Code license:** MIT (GitHub API). **VERIFIED.** Repo pushed 2026-10-19.
- **WASM:** README checklist "WebAssembly" linked to `examples/whisper.wasm`. The examples dir also has `stream.wasm` and `command.wasm`. Sources: https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md and https://api.github.com/repos/ggml-org/whisper.cpp/contents/examples. **VERIFIED.**
- **Model sizes** (README table, ggml): tiny 75 MiB, base 142 MiB, small 466 MiB, medium 1.5 GiB, large 2.9 GiB. **VERIFIED.**
- **Model weights license:** the HF card for `openai/whisper-tiny` is tagged `apache-2.0` (https://huggingface.co/api/models/openai/whisper-tiny). **VERIFIED** as the HF tag; the OpenAI primary (Whisper GitHub repo, MIT) was not read. **UNVERIFIED** against OpenAI's own file.
- **Grammar / keyword list:** none seen in the README. Whisper decodes free text, so a restricted grammar is not a standard feature (inference). **UNVERIFIED** (I did not read the code for a negative).
- **Phone latency and iOS evidence:** none found. **Gap.** Its ggml sizes make "small" unlikely to fit the iOS page budget (see section 2).

### 5d. transformers.js (Hugging Face), Whisper and Moonshine
- **Code license:** Apache-2.0 (GitHub API; repo pushed 2026-10-24). **VERIFIED.**
- **Moonshine model (ONNX):** `onnx-community/moonshine-tiny-ONNX` is tagged `mit` (HF API). **VERIFIED.** Sizes: encoder int8 7.9 MB; decoder merged int8 20.2 MB. Source: https://huggingface.co/api/models/onnx-community/moonshine-tiny-ONNX/tree/main. **VERIFIED.**
- **Moonshine code and model licenses:** code MIT; models MIT "by default, in every language and at every size," except the legacy non-streaming models for languages other than English, which are under the Moonshine Community License (non-commercial). Sources: https://github.com/moonshine-ai/moonshine (README; the usefulsensors path redirects here) and its LICENSE file. **VERIFIED.**
- **Moonshine claims:** "Optimized for live streaming," and one library across "Python, JavaScript/WASM, iOS, Android, macOS, Linux, Windows, and Raspberry Pi." Vendor README claims. **VERIFIED** as claims, UNVERIFIED as performance.
- **Grammar / keyword list:** none shown in the README I read. **UNVERIFIED** negative.
- **Whisper via transformers.js:** `Xenova/whisper-tiny.en` is tagged `apache-2.0` (HF API). **VERIFIED** as the tag.
- **Phone latency and iOS evidence:** none verified. **Gap.**

### 5e. Summary of the in-browser engines
- **Constrained grammar:** vosk-browser, the only candidate I verified with a grammar option in code. Model `small-en-us-0.15` is Apache-2.0, 40 MB.
- **Open vocabulary plus streaming:** sherpa-onnx WASM ASR (license of its ASR models UNVERIFIED) and Moonshine via transformers.js (MIT).
- **Accuracy on noisy speech:** none of these has a source I read that measures it. **Gap.**

---

## 6. Wake word and keyword spotting in the browser

| Option | Code license | Pretrained-model license | Custom word | Browser | Verdict |
|---|---|---|---|---|---|
| sherpa-onnx open-vocab KWS | Apache-2.0 (VERIFIED) | UNVERIFIED (none stated) | Yes, text keyword file, no retraining (VERIFIED) | WASM demo exists (VERIFIED) | **Best candidate, pending model license** |
| openWakeWord | Apache-2.0 (VERIFIED) | CC BY-NC-SA 4.0, non-commercial (VERIFIED) | Training needed for a new phrase: the docs describe synthetic positive clips and negative data; the included models were trained on about 30,000 hours of negative data (VERIFIED) | Not in browser: ONNX runtime supports JS but porting "is not currently on the roadmap"; the web example streams audio to a Python backend (VERIFIED) | **Rule out for shipping.** A self-trained model would need its own data and license review |
| microWakeWord (kahrendt, OHF-Voice fork) | Apache-2.0 (VERIFIED) | UNVERIFIED (no terms stated) | Yes, synthetic (Piper) sample generation (VERIFIED) | TensorFlow Lite for Microcontrollers (VERIFIED); no browser path stated | Not browser. Skip |
| Picovoice Porcupine Web | Repo Apache-2.0 (VERIFIED); engine and models under Picovoice Terms (VERIFIED) | Proprietary; license grant at Picovoice's discretion, free-trial access revocable "at any time without notice" (VERIFIED, Terms of Use last updated 2026-03-18, effective 2026-03-30) | Yes, via Picovoice Console `.ppn` (VERIFIED) | WASM binding, "private and offline," Safari listed (VERIFIED) | **Ruled out.** Needs an AccessKey at engine init (VERIFIED, web README). A forum post relays a Picovoice reply that the key is checked before offline processing (secondhand, UNVERIFIED). A HA forum post (2026-06-04) relays a Picovoice email saying the Free Tier stops on 2026-06-30 and "There is no non-commercial tier planned" (secondhand, UNVERIFIED) |

**Best candidate:** sherpa-onnx open-vocabulary KWS in WASM. The "verbal callout" (a custom phrase while the app is in the foreground) fits its text-keyword model. **Open item:** the KWS model license.

**Note:** the user's wake-word need is foreground-only, so the continuous recognizer in section 5 could also cover the callout (inference). That would avoid a second model.

---

## 7. Industrial and maintenance voice prior art (design lessons)

**Sources and what they support (all secondary or vendor, so UNVERIFIED as performance claims):**
- **RealWear HMT-1 "Say What You See."** Company describes voice control as "completely hands-free," four microphones with noise cancellation before recognition, local recognition in loud areas, and a claimed 98% accuracy at 95 dB ambient noise. Sources (search summaries, not read at source): https://realwear.com/blog/product-review-wearable-computers-for-the-industrial-sector, https://www.newequipment.com/research-and-development/article/22059343/tough-talk-introducing-the-first-fully-voicedriven-rugged-wearable. **UNVERIFIED.** Also a company statement that a monocular display is deliberate for situational awareness. **UNVERIFIED.**
- **Honeywell Vocollect (voice picking).** Headset mics filter pallet drops, truck beeps, and freezer fans, and SoundSense reduces unwanted word insertions by "more than 50%" (HighJump blog, https://blog.highjump.com/10-common-myths-about-voice-in-the-warehouse.html, search summary). **UNVERIFIED.** Vendor claims: "correct up to 80 percent of picking errors" and "99.99 percent order accuracy" (Honeywell voice page, search summary). **UNVERIFIED.** Check digits and location validation prevent mis-picks (Cleverence guide and Softguide search summaries). **UNVERIFIED.**
- **Gloves:** no speech-recognition data found. Co-Op's glove detail concerns scanners, not voice. **Gap.**
- **Read-back:** no source found describing Vocollect's read-back behavior. Voice-directed picking typically pairs spoken instructions with short spoken confirmations or numeric codes (secondary, UNVERIFIED).
- **Aviation and maintenance voice checklists:** not searched. **Gap.** Open-source voice-driven checklist or diagnostic web apps: not searched. **Gap.**

**Design rules to carry into Field Dx (inference from the above, plus our constraints; none is a verified finding):**
1. **Constrained vocabulary.** Feed the recognizer only the words the current screen can accept: chip labels, yes/no, normal/high/low, numbers, units. This is what vosk-browser's grammar is for (VERIFIED feature).
2. **Read-back of the picked symptom or value** before advancing, with a one-word undo ("no" or "back"). Vocollect-style check-digit validation maps to "confirm the number with a unit."
3. **Push-to-talk as a fallback** to a wake word. The noisy floor means a trigger-on-button (big glove-friendly target) is the reliable default, and the wake word is an add-on.
4. **Noise.** Rely on the headset's mic and hardware noise cancellation first (section 8). Software noise suppression is secondary. Keep spoken prompts short. Mirror the next check on screen so a missed prompt is recoverable.
5. **Number handling.** Accept digits and spoken numbers with units, but confirm numbers aloud (read back "62 psi?").

---

## 8. Hardware in noise (headsets, ear defenders, Bluetooth on iOS)

**Headsets and ear defenders (trade guides and vendor pages, search summaries; UNVERIFIED):**
- A trade guide says speech in loud plants often does not get through ordinary hearing protection, and close-talk boom mics pick up the voice directly. Source: https://reliamag.com/guides/best-industrial-communication-headsets/. **UNVERIFIED** (search summary).
- A comms headset without certified hearing protection cannot be used in regulated industrial settings (same guide, UNVERIFIED).
- Product examples: 3M Peltor MT15H7A-07 discontinued and replaced by CH-3 (retailer note, UNVERIFIED). Listen Technologies LA-455 with a 25.5 dB NRR and unidirectional electret boom mic (Adorama and vendor listing, UNVERIFIED). Sensear named as a top pick for very loud sites (trade guide, UNVERIFIED).
- Lab NRR ratings usually overstate real-world attenuation (widely reported; no source read). **UNVERIFIED** (inference).
- No source I found reports word error rates or ASR results for any of these headsets. **Gap.**

**Bluetooth mic routing on iOS (WebKit):**
- WebKit bug 189645, "There is no voice when restarting airpods using webrtc in safari," filed 2018-09-14, status NEW, last modified 2022-02-08. On 2020-10-26 a commenter reported Bluetooth audio not recording in web clients on macOS 10.15 and iOS 14, while Chrome works. Source: https://bugs.webkit.org/show_bug.cgi?id=189645. **VERIFIED.** No WebKit engineer response in the record. **Current iOS 26/27 behavior UNVERIFIED.**
- WebKit's `navigator.audioSession` (DOMAudioSession) exposes types including `play-and-record`, behind `EnabledBySetting=DOMAudioSessionEnabled` and a `DisabledByQuirk`. Source: https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/Modules/audiosession/DOMAudioSession.idl (read 2026-10-25). **VERIFIED** for the IDL. Whether it is enabled on iOS Safari and whether it changes HFP routing is **UNVERIFIED.**
- Opening the mic likely switches AirPods from stereo A2DP (about 44.1 kHz, output only) to mono HFP (about 8 to 16 kHz, bidirectional). This comes from an unnamed internal design note, quoted in search summaries, and from JUCE forum threads on iOS HFP sample rates (https://forum.juce.com/t/how-to-stop-ios-using-16khz-sample-rate-when-bluetooth-device-is-connected/34951). **UNVERIFIED** for Safari.
- **Routing answer:** WebKit bug 189645 reports that AirPods mic capture in Safari web pages worked right after pairing and then failed after Bluetooth was toggled (macOS 10.13 report; a 2020 comment reports the same on macOS 10.15 and iOS 14, with Chrome working). Whether iOS 26/27 Safari routes a Bluetooth mic to `getUserMedia` or `SpeechRecognition` (section 1) is **UNVERIFIED.** Treat it as a known-fragile path.

**Recommendation (inference):** for the field build, design around a wired boom mic or the headset's own pickup, with Bluetooth as an optional path to test on the iPhone 14 with the actual headset.

---

## License table

| Engine | Code license | Model license | Model size | Offline | iOS evidence |
|---|---|---|---|---|---|
| Safari Web Speech (`webkitSpeechRecognition`) | WebKit (license not read) | Apple service | n/a | **UNVERIFIED for iOS.** MDN says Chrome is server-backed; a macOS 26 author test prompted to send data to Apple and failed offline | Partial per caniuse; Home Screen unavailable per WebKit 2021 (bug 225298) |
| Apple SpeechAnalyzer (iOS 26, native) | Proprietary | Apple-managed | Apple-managed | Yes (author; UNVERIFIED) | No web binding (author, VERIFIED as statement) |
| vosk-browser | Apache-2.0 (npm 0.0.8, GitHub) VERIFIED | Vosk small-en-us-0.15 Apache-2.0; en-us-0.22-lgraph Apache-2.0 (VERIFIED) | 40 MB; 128 MB (VERIFIED) | Yes by design (UNVERIFIED on phone) | None found |
| sherpa-onnx (WASM ASR and KWS) | Apache-2.0 VERIFIED | **UNVERIFIED** for KWS and ASR models | KWS 15.7 to 17.6 MB archives (VERIFIED) | Yes per repo (UNVERIFIED on phone) | Native iOS build exists (VERIFIED); Safari WASM not verified |
| whisper.cpp WASM | MIT VERIFIED | OpenAI Whisper weights: HF tag apache-2.0 (VERIFIED tag); OpenAI primary UNVERIFIED | tiny 75 MiB, base 142 MiB, small 466 MiB (VERIFIED) | Yes by design (UNVERIFIED on phone) | None found |
| transformers.js (Whisper, Moonshine ONNX) | Apache-2.0 VERIFIED | Moonshine MIT (VERIFIED, LICENSE); Whisper apache-2.0 tag (VERIFIED) | Moonshine tiny int8: encoder 7.9 MB + decoder 20.2 MB (VERIFIED) | Yes by design (UNVERIFIED on phone) | Moonshine README claims iOS and JS/WASM (vendor, UNVERIFIED) |
| Moonshine (native) | MIT VERIFIED | MIT default; non-English legacy non-streaming models under non-commercial Community License (VERIFIED) | see transformers.js row | Yes (vendor claim) | Vendor claims iOS (UNVERIFIED) |
| openWakeWord | Apache-2.0 VERIFIED | **CC BY-NC-SA 4.0 (non-commercial)** VERIFIED | Not checked | Python/ONNX; no browser path | None |
| microWakeWord | Apache-2.0 VERIFIED | **UNVERIFIED** | Not checked | TFLite Micro, no browser | None |
| Picovoice Porcupine Web | Repo Apache-2.0; engine proprietary (VERIFIED) | Proprietary Picovoice Terms (VERIFIED); free-tier status UNVERIFIED | Not checked | Needs AccessKey at init (VERIFIED) | Safari listed in web README (VERIFIED) |

**Flags for the license table:** vosk-model-small-en-us-zamia-0.5 is LGPL-3.0, and the daanzu Vosk models are AGPL (both from the Vosk models page, VERIFIED). Avoid for commercial or closed use.

---

## Gaps and open questions (ranked by impact on the build)

1. **iPhone 14 standalone test (highest).** Does `getUserMedia` work in a Home Screen web app, and does `SpeechRecognition` (if used) work in standalone mode on the current iOS? Needs a device test on the actual phone. Blocks the offline plan.
2. **Offline behavior of Safari Web Speech on iOS.** Confirm whether recognition is server-backed on iOS 26/27 (the author test was macOS).
3. **sherpa-onnx KWS model license.** Read the model's own README or license at its download source before shipping a wake word.
4. **Vosk-browser on iOS Safari and phone latency.** No source found. Test with `small-en-us-0.15`.
5. **iOS memory budget on iOS 26/27.** The bug data is iOS 17. Test a 40 MB model page on the iPhone 14.
6. **Shortcut chain.** Dictate Text offline on iPhone 14, Open URLs target, and whether the Home Screen app takes the fragment. Test on the phone.
7. **Bluetooth headset capture in Safari on iOS 26/27 (WebKit bug 189645 status).** Test with the actual headset.
8. **Aviation and maintenance voice checklists, and open-source voice diagnostic apps.** Not searched. Could be a follow-up if the design needs more precedent.
9. **Picovoice free-tier status.** Check Picovoice's own pricing and console pages. Only one secondhand (forum) source for the 2026-06-30 cutoff.
10. **WebGPU on iOS 26/27.** Trade-press claim only. Check WebKit or Apple release notes if needed.

---

## Sources (URLs read or searched)

- caniuse, SpeechRecognition: https://caniuse.com/speech-recognition
- MDN, SpeechRecognition: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- WebKit bug 225298: https://bugs.webkit.org/show_bug.cgi?id=225298
- WebKit bug 269777: https://bugs.webkit.org/show_bug.cgi?id=269777
- WebKit bug 189645: https://bugs.webkit.org/show_bug.cgi?id=189645
- WebKit source (main): https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/Modules/speech/SpeechRecognition.idl ; https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/Modules/speech/SpeechRecognition.cpp ; https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebKit/UIProcess/Speech/SpeechRecognitionPermissionManager.cpp ; https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/Modules/audiosession/DOMAudioSession.idl
- Apple Developer Forums, iOS 15 webkitSpeechRecognition: https://developer.apple.com/forums/thread/699881
- Addpipe, Apple SpeechAnalyzer (2026-08-17): https://blog.addpipe.com/apple-speechanalyzer-api/
- Safari 26 release notes (title only): https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes
- Apple Dictate Text support (body not read): https://support.apple.com/guide/iphone/dictate-text-iph2c0651d2/ ; https://support.apple.com/es-us/HT208343
- Apple Shortcuts guide: https://support.apple.com/guide/shortcuts/welcome/ios
- vosk-browser: https://github.com/ccoreilly/vosk-browser ; https://registry.npmjs.org/vosk-browser/latest ; https://raw.githubusercontent.com/ccoreilly/vosk-browser/master/lib/src/model.ts ; https://raw.githubusercontent.com/ccoreilly/vosk-browser/master/lib/src/worker.ts
- Vosk models: https://alphacephei.com/vosk/models
- sherpa-onnx: https://github.com/k2-fsa/sherpa-onnx ; https://k2-fsa.github.io/sherpa/onnx/kws/index.html ; https://api.github.com/repos/k2-fsa/sherpa-onnx/releases/tags/kws-models ; https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/wasm/kws/app.js
- whisper.cpp: https://github.com/ggml-org/whisper.cpp ; https://huggingface.co/api/models/openai/whisper-tiny
- Moonshine: https://github.com/moonshine-ai/moonshine (README and LICENSE) ; https://huggingface.co/api/models/onnx-community/moonshine-tiny-ONNX/tree/main
- transformers.js: https://github.com/huggingface/transformers.js ; https://huggingface.co/api/models/Xenova/whisper-tiny.en
- openWakeWord: https://github.com/dscripka/openWakeWord
- microWakeWord: https://github.com/kahrendt/microWakeWord
- Picovoice: https://github.com/Picovoice/porcupine ; https://github.com/Picovoice/porcupine/tree/master/binding/web ; https://picovoice.ai/docs/terms-of-use/ ; HA forum (secondhand): https://community.home-assistant.io/t/fyi-picovoice-confirmed-free-tier-accesskeys-will-stop-working-after-june-30-2026/1012744
- WebAssembly memory (search only): https://bugs.webkit.org/show_bug.cgi?id=221530 (not read)
- WebGPU iOS 26 (trade press, UNVERIFIED): https://appdevelopermagazine.com/WebGPU-in-iOS-26/
- SpeechSynthesis (search summaries, UNVERIFIED): https://developer.apple.com/forums/thread/723503 ; https://github.com/microsoft/BotFramework-WebChat/issues/995 ; https://read-aloud.com/guide-browser-compatibility.html
- Shortcuts Open URL (third-party, UNVERIFIED): https://taethni.atlassian.net/wiki/x/AYA-N ; https://community.glideapps.com/t/ios-26-beta-opening-an-installed-web-app-with-an-open-url-action/82464
- W3C scope (search only): https://lists.w3.org/Archives/Public/public-webapps-github/2018Jan/0997.html
- RealWear and Vocollect (search summaries, UNVERIFIED): https://realwear.com/blog/product-review-wearable-computers-for-the-industrial-sector ; https://www.newequipment.com/research-and-development/article/22059343/tough-talk-introducing-the-first-fully-voicedriven-rugged-wearable ; https://blog.highjump.com/10-common-myths-about-voice-in-the-warehouse.html
- Headsets (trade and vendor, UNVERIFIED): https://reliamag.com/guides/best-industrial-communication-headsets/ ; https://soundpro.com/products/listen-technologies-la-455
- JUCE iOS HFP sample-rate threads (UNVERIFIED for Safari): https://forum.juce.com/t/how-to-stop-ios-using-16khz-sample-rate-when-bluetooth-device-is-connected/34951
