# Field Dx — offline HVAC/R field diagnostics

Type what you see ("walk-in freezer warm, coil iced, fans running"); the app ranks the likely causes and
names the one check that would narrow it down fastest for the least effort. Gauge and probe numbers become
findings automatically (superheat, subcooling, condensing temperature over ambient, temperature split…).
Everything runs on the device — built for McMurdo, where the connection can't be counted on.

**Run it (PWA / server):** `python3 -m http.server 8787 --directory docs` → http://127.0.0.1:8787/
**Run it (single file, no server, USB / `file://`):** open `docs/field-dx-standalone.html` directly in any browser.
**Run it (terminal CLI):** `node tools/dx.mjs "walk-in freezer warm, coil iced, fans running"`
**Phone:** open https://qav2.github.io/hvac-field/ once in Safari, then Share → Add to Home Screen. The service
worker caches everything; after that it works with no connection, and it updates itself the next time it is
opened online.

## Coverage (372 causes · 345 checks · 71 calculations · 599 scenarios · 11 systems)
- **Vapor-compression core (`kb/vc-core.yaml` + `kb/common.yaml`, 43 causes)** — charge, metering (TXV/EEV/piston/cap tube), airflow, non-condensables, restrictions, single/three-phase electrical, compressor mechanical.
- **Commercial refrigeration & ice (`kb/refrigeration.yaml`, 58 causes)** — walk-ins, reach-ins, prep tables, cube/flake ice machines, defrost systems, EPR/CPR, cold-ambient (−40 °F) head-pressure control, water/glycol condensers.
- **Heat pumps & mini-splits (`kb/heatpump.yaml`, 41 causes)** — 4-way reversing valves, defrost boards/sensors, auxiliary strip heat, inverter drives/IPMs, EEV stepper coils, multi-zone port cross-wiring.
- **Oil boilers & furnaces (`kb/boiler-oil.yaml`, 58 causes)** — fuel supply, two-pipe vacuum/tigerloop, nozzle/electrodes/drawer assembly, cad cell & primaries, draft/chimney, aquastats, steam & hydronic trim.
- **Hydronic, glycol & steam (`kb/hydronic.yaml`, 60 causes)** — circulators, air elimination, expansion tanks, zone valves, mixing valves, propylene/ethylene glycol loops, heat exchangers, steam traps, Hartmann loops.
- **Terminal heating units (`kb/terminal.yaml`, 47 causes)** — hot-water, glycol and steam unit heaters, cabinet unit heaters, 2- and 4-pipe fan coils, baseboard/convectors/radiators, radiant panels, electric unit and baseboard heaters: valves and actuators, air-bound and plugged coils, fan motors and interlocks, freeze-stats, unit steam traps and vacuum breakers, elements, limits, contactors and line-voltage thermostats.
- **Air handling & ventilation (`kb/ahu.yaml`, 65 causes)** — belt/sheave/VFD fans, static pressure & duct faults, economizers (NIST APAR rules), hydronic/steam coils, freeze stats, HRV/ERV cores.

## How it works
- `docs/js/engine.js` — single-fault Bayesian ranking over the causes for the chosen system, and the next
  best check by expected information gain per unit of effort.
- `docs/js/measure.js` + `docs/js/expr.js` — readings → findings, plus sanity checks that catch a bad reading
  before it becomes a diagnosis (`checkSanity`): wet bulb above dry bulb, suction line colder than evaporator
  saturation, supply air colder than evaporator saturation, condensing saturation below the air entering the
  condenser, liquid line hotter than condensing saturation, mixed air outside the outdoor-to-return range (NIST
  APAR rules 26–27), a draft entered with a plus sign, and a pressure outside the refrigerant's PT table. Readings
  that can't all be right are left out of the diagnosis until they agree. Typed readings are read in the box's own
  unit: "8,1 bar" or "815 kPa" in a psig box is converted, "24,000" is twenty-four thousand, "4,5" is 4.5; °C in a
  °F box, a unit that doesn't belong, or a value no instrument could show is refused with a note.
- `docs/js/calcs.js` — refrigerant PT (22 baked CoolProp tables, plus a two-point Clausius–Clapeyron fit for a
  refrigerant that isn't in them), elevation correction for gauge readings, psychrometrics, charging targets
  (California ACM RD-2/RD-3), glycol freeze points, oil and gas combustion efficiency, fan and pump affinity laws,
  three-phase voltage and current unbalance with NEMA MG-1 motor derating, and run-capacitor µF under load.
- `docs/js/search.js` — typed symptoms → findings, with trade synonyms, negation and clause splitting.
- `docs/js/main.js`, `tools.js`, `css/app.css` — the app. `docs/sw.js` — offline cache.
- `kb/*.yaml` — the knowledge base. **`kb/README.md` is the authoring guide.**

## Build and test
```
python3 tools/build.py && node tools/check.mjs     # compile KB + standalone HTML, run every check and scenario
node tools/coverage.mjs                            # verify per-system and per-module scenario coverage
node tools/fuzz.mjs                                # odd input: search text, readings, calculators, engine
node tools/offline_check.mjs                       # headless Chromium: precache, offline launch, updates, file://
npm install && node tools/a11y_check.mjs           # axe-core, 44 px tap targets, no sideways scroll at 360 px, both themes
node tools/dx.mjs --help                           # terminal CLI diagnostics & physics calculators
python3 tools/check_pt.py                          # PT tables vs published manufacturer charts
node tools/physics_check.mjs                       # 44 calculator outputs vs independent published values
.venv/bin/python -I tools/bake_pt.py               # re-bake PT (needs CoolProp) and glycol tables
```
`build.py` compiles `docs/data/kb.json`, emits the self-contained single-file `docs/field-dx-standalone.html`, and stamps `docs/sw.js` with a content hash so phones pick up a new version on next launch.
The browser checks need Playwright with Chromium (`npm i -g playwright && npx playwright install chromium`);
`npm install` adds axe-core, the only dev dependency (the app itself has none).
`offline_check.mjs` serves `docs/` locally, loads the app online, goes offline and diagnoses; ships a new build and
checks the cache is replaced byte for byte; breaks an update halfway and checks the old version still works; and
opens the standalone file from `file://` with the network blocked.

## Sources and rights
Fault directions follow NIST SP 1087 and TN 1648 and the NIST APAR rules (NISTIR 6964) — US Government works —
plus public-domain Army manuals (TM 5-642, TM 5-650) and general practice, written in our own words. Refrigerant
properties from CoolProp (MIT). Terminal-unit faults also draw on the DOE steam trap tip sheet (US Government
work). Charging targets from the California Energy Commission ACM manual (Tables RD-2, RD-3). Glycol freeze points
from the Dow DOWTHERM SR-1 and DOWFROST HD product tables. Nothing is copied from proprietary diagnostic apps.
Research notes are in `research/`.

The probe link (UEi wireless probes over Bluetooth) is a separate track: `tools/ble_scan.py`, `tools/ble_capture.py`.
