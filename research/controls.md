# Controls & low-voltage circuits — sources for `kb/controls.yaml`

Status: first pass, 2026-10-25 (cloud session H3). Everything in the module is written in our own words. No
manufacturer manual, wiring diagram, fault-code table or proprietary app was used. Where a cause depends on a
maker's setting (fault codes, O/B polarity, sensor curve, start-up bypass time), the text sends the tech to that
maker's literature instead of quoting it.

## Sources and rights

| id in the KB | Source | Rights | What it supports here |
|---|---|---|---|
| `ufc-3-410-02` | UFC 3-410-02, *Direct Digital Control for HVAC and Other Building Control Systems*, 18 July 2018 (now marked cancelled). https://www.wbdg.org/FFC/DOD/UFC/ARCHIVES/ufc_3_410_02_2018.pdf | Cover and title page read "APPROVED FOR PUBLIC RELEASE; DISTRIBUTION UNLIMITED". US Government work. | Points can be overridden from the front end or a local display (§4-5.3 and the points schedule "O / VO" columns, overrides through the priority array). Overrides are preferred to hand-off-auto switches (§4-5.5). The occupancy schedule has two sets of times: the normal one at the UMCS and a **default schedule in the building that runs if the connection to the UMCS is lost** (§5-10, Occupancy Schedule). Occupancy sensors and after-hours override pushbuttons with an off-delay (Thermostat and Occupancy Sensor Schedule, Fig. 5-2). A fan-status input may be a current switch, a DP switch or an airflow switch (control logic diagrams). Used by `ctl.point_override`, `ctl.schedule_wrong`, `ctl.occ_sensor_bad`, `ctl.comm_lost`, `ctl.controller_reset`, `ctl.bas_output_failed`, `ctl.field_wire_lost`, `ctl.actuator_failed`, `ctl.stat_mislocated`, `ctl.sensor_config`. |
| `tm-5-642` | US Army TM 5-642, *Small Heating Systems* (1990), ch. 7 controls (already in `systems.yaml`). | "Public property and not subject to copyright." | Thermostat, transformer and safety-control practice on small heating plants; heat anticipator set to the control-circuit current. Used by `ctl.short_cable`, `ctl.xfmr_open`, `ctl.rollout_failed`, `ctl.anticipator`. |
| `ntc-curves` | 10 kΩ Type II and Type III tables, Steinhart–Hart fits of published rows, checked against the Veris ZL0010-0E table. | Physical data; the fits are our own computation. | The 10 kΩ table in `ctl.ntc_expected` / `ctl.ntc_ratio`, used by `ctl.thermistor_failed` and `ctl.sensor_config`. |
| `practice` | General field practice in our own words. | Our own text. | The meter work: voltage across an open switch, R to C loaded and unloaded, coil ohms, the isolation test for a short, the R-to-call jumper test, the W-current clamp with 10 wraps, transformer phasing (R to R with the commons tied). |

Also read, not cited as a ref: UFC 3-401-01 *Mechanical Engineering* (28 July 2025, "approved for public
release; distribution unlimited", https://www.wbdg.org/dod/ufc/ufc-3-401-01). It sends controls design to UFC
3-410-02 and the UFGS 23 09 sections and adds nothing field-diagnostic. WBDG also shows a Change 2 (14 May 2026)
cover marked "CANCELLED". Its status is unresolved, so it is not cited.

TM 5-815-3, *HVAC Control Systems* (1991), would be a good second source for the 24 V and sensor material. Its
content went into CEGS 15950 and TI 810-11. No copy was found online in this session (DTIC holds USACERL
reports ADA228326 and ADA265372 on single-loop digital controllers). **Open:** find and read TM 5-815-3.

## The 10 kΩ NTC tables (Type II and Type III)

The module first used one Beta curve (β = 3950 K). It matches neither common HVAC curve in the cold: it reads
about 16 % above Type II at −40 °F, so a good outdoor sensor in a McMurdo winter would have read "failed". The KB
now carries two tables, 10 kΩ Type II and Type III (`ctl.ntc_expected`, `ctl.ntc_expected3`), as Steinhart–Hart
fits interpolated every 10 °F, and a reading passes within ±10 % of the nearer one (about ±4 °F at 77 °F). Under
0.1 kΩ reads as shorted, over 2,000 kΩ (enter 9999 for OL) as open, with or without a temperature.

Checked 2026-10-24 against a sensor maker's table, Veris ZL0010-0E (`research/.dl/ntc/veris-ta_i0e2.pdf`,
https://www.veris.com/ASSETS/DOCUMENTS/ITEMS/EN/ta_i0e2.pdf), "10k Type 2" and "10k Type 3" columns:

| °F | Type II KB | Veris T2 | Type III KB | Veris T3 |
|---:|---:|---:|---:|---:|
| −40 | 336.1 | 344.7 | 239.8 | 245.1 |
| −22 | 178.8 | 180.1 | 136.5 | 137.3 |
| −4 | 98.4 | 98.32 | 79.84 | 79.73 |
| 14 | 55.96 | 55.79 | 48.02 | 47.84 |
| 32 | 32.87 | 32.77 | 29.66 | 29.59 |
| 50 | 19.90 | 19.93 | 18.79 | 18.81 |
| 68 | 12.57 | 12.50 | 12.33 | 12.27 |
| 104 | 5.36 | 5.323 | 5.626 | 5.593 |

Within about 1 % from −22 to 122 °F, and 2–2.5 % low at −40 °F: well inside the ±10 % band. Other curves exist
(BAPI notes at least five 10 kΩ curves in HVAC); a 1 kΩ platinum or nickel sensor, or a 20 kΩ NTC, needs its maker's
chart, which the input hint says.

## How the module was checked

- `python3 tools/build.py && node tools/check.mjs` — zero problems, zero warnings (no shadowed causes, no twins),
  every scenario passing.
- `node tools/coverage.mjs` — every controls cause is the expected answer of at least one scenario.
- Typed-symptom search (the brief's synonyms) checked against `docs/js/search.js` with a scratch script. Results
  and the two gaps are in `cloud-reports/H3.md`.

## Open items

- TM 5-815-3 not found; the sensor and 24 V content rests on general practice plus UFC 3-410-02.
- The cancelled UFC 3-410-02 is still the clearest public statement of the override and default-schedule
  behavior. If the current controls UFC (the UFGS 23 09 series and whatever replaced 3-410-02) is published,
  cite it instead.
