# Field Dx — offline HVAC/R field diagnostics

Type what you see ("walk-in freezer warm, coil iced, fans running"); the app ranks the likely causes and
names the one check that would narrow it down fastest for the least effort. Gauge and probe numbers become
findings automatically (superheat, subcooling, condensing temperature over ambient, temperature split…).
Everything runs on the device — built for McMurdo, where the connection can't be counted on.

**Run it (PWA / server):** `python3 -m http.server 8787 --directory docs` → http://127.0.0.1:8787/
**Run it (single file, no server, USB / `file://`):** open `docs/field-dx-standalone.html` directly in any browser.
**Run it (terminal CLI):** `node tools/dx.mjs "walk-in freezer warm, coil iced, fans running"`
**Phone:** host `docs/` on any HTTPS static host (GitHub Pages works), open it once in Safari, Share → Add to
Home Screen. The service worker caches everything; after that it works with no connection.

## Coverage (268 causes · 291 checks · 65 calculations · 297 scenarios · 10 systems)
- **Vapor-compression core (`kb/vc-core.yaml`)** — charge, metering (TXV/EEV/piston/cap tube), airflow, non-condensables, restrictions, single/three-phase electrical, compressor mechanical.
- **Commercial refrigeration & ice (`kb/refrigeration.yaml`)** — walk-ins, reach-ins, prep tables, cube/flake ice machines, defrost systems, EPR/CPR, cold-ambient (−40 °F) head-pressure control, water/glycol condensers.
- **Heat pumps & mini-splits (`kb/heatpump.yaml`)** — 4-way reversing valves, defrost boards/sensors, auxiliary strip heat, inverter drives/IPMs, EEV stepper coils, multi-zone port cross-wiring.
- **Oil boilers & furnaces (`kb/boiler-oil.yaml`)** — fuel supply, two-pipe vacuum/tigerloop, nozzle/electrodes/drawer assembly, cad cell & primaries, draft/chimney, aquastats, steam & hydronic trim.
- **Hydronic, glycol & steam (`kb/hydronic.yaml`)** — circulators, air elimination, expansion tanks, zone valves, mixing valves, propylene/ethylene glycol loops, heat exchangers, steam traps, Hartmann loops.
- **Air handling & ventilation (`kb/ahu.yaml`)** — belt/sheave/VFD fans, static pressure & duct faults, economizers (NIST APAR rules), hydronic/steam coils, freeze stats, HRV/ERV cores.

## How it works
- `docs/js/engine.js` — single-fault Bayesian ranking over the causes for the chosen system, and the next
  best check by expected information gain per unit of effort.
- `docs/js/measure.js` + `docs/js/expr.js` — readings → findings, plus First & Second Law thermodynamic conservation sanity checks (`checkSanity`: $T_{\text{wb}} \le T_{\text{db}}$, $T_{\text{suc}} \ge T_{\text{evap,sat}}$, $T_{\text{cond,sat}} \ge T_{\text{amb}}$, $T_{\text{liq}} \le T_{\text{cond,sat}}$, and mixed-air bounds $T_{\text{ma}} \in [T_{\text{oa}}, T_{\text{ra}}]$).
- `docs/js/calcs.js` — refrigerant PT (20 baked CoolProp tables + universal 2-point Clausius–Clapeyron solver for any future fluid), elevation/barometric pressure compensation, psychrometrics, charging targets (California ACM RD-2/RD-3), glycol freeze points, oil/gas combustion efficiency, Fan/Pump Affinity Laws, and 3-phase voltage/current unbalance + live under-load capacitor impedance.
- `docs/js/search.js` — typed symptoms → findings, with trade synonyms, negation and clause splitting.
- `docs/js/main.js`, `tools.js`, `css/app.css` — the app. `docs/sw.js` — offline cache.
- `kb/*.yaml` — the knowledge base. **`kb/README.md` is the authoring guide.**

## Build and test
```
python3 tools/build.py && node tools/check.mjs     # compile KB + standalone HTML, run all checks & 297 scenarios
node tools/coverage.mjs                            # verify per-system and per-module scenario coverage
node tools/dx.mjs --help                           # terminal CLI diagnostics & physics calculators
python3 tools/check_pt.py                          # PT tables vs published manufacturer charts
.venv/bin/python -I tools/bake_pt.py               # re-bake PT and glycol tables (needs CoolProp)
```
`build.py` compiles `docs/data/kb.json`, emits the self-contained single-file `docs/field-dx-standalone.html`, and stamps `docs/sw.js` with a content hash so phones pick up a new version on next launch.

## Sources and rights
Fault directions follow NIST SP 1087 and TN 1648 and the NIST APAR rules (NISTIR 6964) — US Government works —
plus public-domain Army manuals (TM 5-642, TM 5-650) and general practice, written in our own words. Refrigerant
properties from CoolProp (MIT). Charging targets from the California Energy Commission ACM manual (Tables RD-2,
RD-3). Nothing is copied from proprietary diagnostic apps. Research notes are in `research/`.

The probe link (UEi wireless probes over Bluetooth) is a separate track: `tools/ble_scan.py`, `tools/ble_capture.py`.
