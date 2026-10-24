# Public-domain HVAC/heating troubleshooting references (for the HVAC-field KB)

Status: COMPLETE (bounded pass) — 2026-10-22, research worker (Fable 5). Local copies of the PDFs and extracted text live in `/home/joseph/hvac-field/research/.dl/`.

## What this means for the build

- **TM 5-642 (Army, Aug 1990) is the anchor reference.** It is explicitly "public property and not subject to copyright," fully text-extractable, and covers exactly our plant scale: small oil/gas boilers <15 psig steam / <30 psig hot water, warm-air furnaces, gun-type oil burners, hydronic and steam distribution, controls. Our symptom→cause rows for oil burners, steam systems, and condensate pumping can be cross-checked line-by-line against its Chapter 3 §III (oil burners), Chapter 4 §§ 4-77..4-87 (steam system troubleshooting), Chapter 7 (controls), and Appendices B/C.
- **TM 5-650 (Army, Oct 1989, Central Boiler Plants) is confirmed "Approved for public release; distribution is unlimited"** but the WBDG PDF is a scan — only the front matter OCRs out of the box. Usable as a citation and for larger-plant depth (water treatment, flue-gas analysis ch.1, boiler fittings ch.2) once pages are OCR'd on demand. Don't plan on grepping it.
- **Numbers to seed the KB now** (all TM 5-642): oil pump 100 psi for heavy oil (nozzles rated at 100 psi reference), starting draft 0.02–0.04 in. w.g. at breeching / 0.03–0.06 in. w.g. firebox on start, flue-gas CO2 ≈ 10% after adjustment, O2 ≤ ~5% without smoke as the burner-health criterion, fusible-link fire valve releases ≈165°F, full-load combustion efficiency 80–90% band.
- **TM 5-642 predates universal CAD-cell wiring detail** — its combustion-safeguard taxonomy is stack switch / "protectostat" / photoelectric eye. Our KB's CAD-cell ohm limits must come from elsewhere (manufacturer literature or a newer federal doc); mark that row as needing a second source. (OPEN)
- Everything federal here is a US Government work → public domain by 17 USC §105; the distribution statement is what tells you it is also publicly releasable. Both TMs pass. UFC series on WBDG likewise carries public-release distribution statements (verified for UFC 3-430-07 below).

## Manuals and rights status

| Doc | Title / date | Rights statement found on the document | Text access | Status |
|---|---|---|---|---|
| TM 5-642 | Operation and Maintenance: Small Heating Systems, HQ Dept of the Army, 30 Aug 1990 | "This manual has been prepared by or for the Government and is public property and not subject to copyright." (Reproduction Authorization page) | Full text extracts cleanly (6,602 lines) | CONFIRMED PD |
| TM 5-650 | Central Boiler Plants, HQ Dept of the Army, Oct 1989 | "Approved for public release; distribution is unlimited." (cover + title page) | Scanned PDF; only front matter OCRs; body needs OCR per-page | CONFIRMED public release; text OPEN |
| UFC 3-430-07 | O&M: Inspection and Certification of Boilers and Unfired Pressure Vessels, 24 Jul 2003 w/Ch.5 (2019); supersedes MIL-HDBK-1152 (ex-NAVFAC lineage) | UFCs on WBDG carry public-release distribution statements; this one's title page not individually opened | wbdg.org PDF | LIKELY public release; title page OPEN |
| NAVFAC MO-205 / MO-209 / MO-324 | legacy Navy O&M manuals (central heating; steam/HW distribution; boiler inspection) | — | Not found in a quick sweep; MO-series was superseded by MIL-HDBK-11xx then UFC 3-4xx (MO-324 → MIL-HDBK-1152 → UFC 3-430-07 confirmed for the boiler-inspection lineage) | OPEN (probably obsolete; use the UFC successors) |
| DOE "Improving Steam System Performance: A Sourcebook for Industry", 2nd ed. 2012 | DOE/GO-102012-3423, NREL/BK-6A42-51710, DOE AMO | US Gov't work (17 USC §105); caveat: cover photo credited iStock — treat text as PD, not the stock images | https://www.energy.gov/sites/prod/files/2014/05/f15/steamsourcebook.pdf | PD text (image caveat); content extraction OPEN |
| EPA-600/2-75-069-a | "Guidelines for Residential Oil-Burner Adjustments", Locklin & Barrett (Battelle for EPA), 1975, ~27 pp | Federal report; HathiTrust lists FULL VIEW (PD evidence) | https://catalog.hathitrust.org/Record/101642684 ; EPA NEPIS copy exists | PD; the smoke-spot/CO2 numbers live here — pull next |
| UFC 3-130-01 (2024) | Arctic and Subarctic Engineering, 3 Dec 2024 | "APPROVED FOR PUBLIC RELEASE; DISTRIBUTION UNLIMITED" (per WBDG record) | https://www.wbdg.org/FFC/DOD/UFC/ufc_3_130_01_2024.pdf | CONFIRMED public release |
| UFC 3-130 series utilities volume | Arctic/Subarctic utility systems (~118 pp, Active): water, wastewater, fire protection, utility distribution, cold-regions thermal calcs | same series | wbdg.org (current 5-volume series replacing TM 5-852-x) | public release expected; heating-fuel content OPEN |

Sources for the table: WBDG hosts TM 5-642 (https://www.wbdg.org/FFC/ARMYCOE/COETM/tm_5_642.pdf) and TM 5-650 (https://www.wbdg.org/FFC/ARMYCOE/COETM/tm_5_650.pdf); EverySpec mirrors both (https://everyspec.com/ARMY/TM-Tech-Manual/tm5_642_5013/ , https://everyspec.com/ARMY/TM-Tech-Manual/tm5_650_5105/); UFC 3-430-07 at https://www.wbdg.org/FFC/DOD/UFC/ufc_3_430_07_2003_c5.pdf .

## Extracted troubleshooting content (TM 5-642 unless noted)

### (a) Pressure-gun oil burners — TM 5-642 ch.3 §III (¶3-11 to 3-14)

**Setup / combustion-test targets (¶3-11, 3-13f):**
- Oil pressure must atomize the fuel; "Heavy oils require 100 psi pressures." Nozzles are stamped with capacity at rated pressure; running above rated pressure raises flow (table 3-1 gives No. 2 oil flow vs pressure) — if flow is too heavy, fit a smaller nozzle, don't throttle.
- Burner start: set draft 0.02–0.04 in. w.g.; starting conditions require firebox draft of about 0.03–0.06 in. w.g. (¶3-13f). If adequate combustion air can't be had at that draft, raise the draft.
- Smoke adjustment method: with the burner warm, view through the barometric draft regulator with a droplight; close burner air until smoke is visible in the light ray in the smokepipe, then open air until smoke just disappears (¶3-11b(10)).
- After ~30 min running, reduce stack draft to just enough to prevent firebox pressure under unfavorable conditions. Too little draft → firebox pressure, odors, smoke/smothering; excessive draft → lowers %CO2 and efficiency, accentuates air leaks (¶3-11b(11)).
- Target: flue-gas CO2 ≈ 10% after adjustment; if not, recheck air adjustment and hunt air leaks. Air to the burner = minimum for clean combustion (¶3-11b(11)).
- Burner-replacement criterion (¶3-23e): an oil burner that cannot reach O2 readings down to 5% excess without smoking (or high CO on gas) is a retrofit/replacement candidate.
- Stack gas analysis (¶3-23b): take %CO2 or %O2 AND stack temperature at the same point, just downstream of the last heat-recovery surface, to avoid cooling/infiltration error; %O2 is the single most useful criterion across fuels. Full-load instantaneous efficiencies run 80–90%; tune for the dominant part-load point (fig 3-19 example: 50–60% load most hours).
- Nozzle hygiene (¶3-13b,c): replace in the field, clean only on a shop bench; never a metal needle in the orifice (sharpened match / brush bristle); replacement must match capacity, spray angle, and pattern.
- Electrode/nozzle geometry (¶3-13d(1)): nozzle tip set back from end of blast tube; ignition points ~fractions of an inch apart, ahead of and above the nozzle centerline per fig. 3-8 (exact fractions garbled in OCR — read fig. 3-8 in the PDF before quoting).

**Symptom → cause (¶3-13d), paraphrased:**
- *Furnace pulsates on start/stop/run:* nozzle-electrode-blast tube alignment off; draft wrong or downdraft (check chimney leaks, draft regulator setting); defective nozzle; air trapped in line between fuel unit and nozzle (compresses on stop, squirts oil at shutdown — may self-clear after a few days).
- *Flame raw and stringy:* air shutter too far open (excess air makes a poor fire, raw oil soaks the brick); partially plugged nozzle → replace; air in pump → vent at gauge petcock.
- *Ignition points collect carbon:* electrodes sitting in the spray (raise them); nozzle loose in holder (leak carbonizes on electrodes); pressure-regulating valve not cutting off oil cleanly at shutdown.
- *Noisy oil pump:* air in oil lines, plugged strainer, or water condensed in the tank causing excess suction; purge at the gauge vent plug; check suction-line leaks (any overhead piping above tank liquid level admits air); clean pump strainer, change line filter; with very light oils an overhead pipe lets dissolved air collect — two-pipe systems minimize it.
- *Frequent burner cycling:* thermostat heat anticipator/element loose, wiring reversed or mis-spliced (also at primary control); thermostat adjustment; primary-control drive arm; limit control set too low; plugged filters above blower starving airflow → trips limit; nozzle oversized for the unit (heat builds too fast).
- *Primary control or stack switch throws safety shutdown:* low voltage (check with recording voltmeter ≥24 h); reversed polarity / hot-ground swap leaking through the control; internal control adjustments off (manufacturer's sheet).
- *No oil at the nozzle:* tank low; nozzle plugged; suction-line leak; vacuum-gauge-port leak; pump shaft not turning; strainer-gasket leak; pump shaft-seal leak; if all pass, loosen fuel-unit vent plug and run — fuel reaching the unit isolates the fault inside the fuel unit → exchange it.
- *Restart discipline:* after a flame-out, let the stack-control safety element cool before resetting; never hold the relay in. After any misfire, ventilate the chamber, open the relief door, stand aside on relight (oil-soaked brick rumbles/puffs until burned off) (¶3-11b(7),(9)).

**Fuel-oil piping safeties (¶3-14):** thermal shut-off valve in the supply line directly above the burner — fusible link releases ≈165°F and a spring-loaded lever gate stops oil to the burner. Pressure-atomizing burners also carry an oil delay valve between pump and nozzle: opens ≥4 s after the motor energizes, closes instantly on de-energize.

### (b) Boiler controls and safeties — TM 5-642 ch.7

- **Combustion safeguards (¶7-13a):** shut off firing if flame is lost. Types: (1) *stack switch* — helical bimetal in the smokepipe; closes on hot flue gas, opens on any appreciable gas-temperature drop; simplest, suited to small boilers, slow on large ones; (2) *protectostat* — black-coated diaphragm on the boiler front "looking" at the fire, fast-acting, for fixed-size intermittent flames; (3) *photoelectric eye* — instantaneous on flame failure, usable with a primary control. (Note: no CAD-cell resistance figures in this TM — OPEN, needs a second source.)
- **Low-water cutoffs (¶7-13b):** float-actuated switch stopping the firing equipment at a predetermined low level. "Steam boilers require two independent cut-offs, with separate connections for blowdown valving and piping. Hot water boilers require only low water cutoff [one]."
- **Feedwater regulators (¶7-13c):** float switch cycling the feed pump between manufacturer's level limits.
- **Draft controllers (¶7-13d):** barometric damper on smokepipe/breeching, weight-adjusted to hold constant furnace draft; acts as a balanced air valve.
- **Smoke alarms (¶7-13e):** photocell across the breeching sighting a lamp; smoke cuts light intensity → alarm.
- **Low water level is "the most serious situation that may occur in a boiler plant"** (¶4-78): never rely on automatic feeders alone. After cooling, causes to check: gauge glass valved off or drained; broken sections / steel-boiler leak; return pump failure or broken return main; broken/plugged pump discharge or closed return valve; oil/grease/foreign matter causing priming.
- **Water-level behavior (¶4-77):** fast bounce = excessive firing rate entraining moisture / gauge connections at active circulation points (false reading) / level too high causing carryover; slow rise-fall = vacuum or condensate pump returning too much per cycle (cut-in/cut-out span too wide), gravity-return equalization failure on long mains, or uneven firing across multiple boilers.
- **Pressure-reducing valve failure (¶ in §XV, ch.4):** PRV branch connects to main ≥10 ft from (per layout fig. 4-31); failure to control traces to control tension, valve stem, pilot line siphoning.

### (c) Hot-water distribution — TM 5-642 ch.5

- **Expansion tanks (¶5-2d, 5-4, 5-7b):** every heating system needs one; open type freely vented, closed type sealed with an air cushion. Gravity systems: keep the tank about half full cold (startup fills "until the expansion tank is approximately half filled"); watching tank level is "probably the most important consideration" in operating a hot-water system. Closed tanks: minimum volume sized so expansion is cushioned against compressed air; tank below radiators must be larger than one above; taller building → more air capacity; connect an overhead tank directly to the flow main so air can migrate to it; provide air-inlet valve, gauge glass, relief valve, and ideally a compressed-air source to renew the cushion (large/high-pressure systems).
- **Air management:** vent radiators starting at the lowest; re-vent after ~10 days of firing; periodic venting is the main gravity-system maintenance (¶5-3, 5-5).
- **Circulators (¶5-7a):** check rotation direction; small/residential → pump in the return; larger systems → pump on the supply side with the expansion tank connected to the pump inlet (the no-pumping-away-from-the-tank rule in period form).
- **Relief (¶5-7c):** all hot-water systems require pressure relief; excessive-pressure events come from (text continues — fill valve/PRV interaction) — pull full paragraph before quoting. Rapid pressure fluctuation/pulsation in gravity systems → check leaks, stoppages, relief-valve operation (¶5-5).
- **Thermal shock:** excessive cold feed to a hot boiler can break sections (¶4-86f); drain and refill with clean water at season end (¶5-5); cold-air backflow can freeze a standby boiler (¶ around line 3813: idle boiler left connected can freeze from back-flowing cold air).
- Glycol strength / freeze-protection tables: NOT in TM 5-642. OPEN — need a second source (CRREL/UFC or manufacturer data).

### (d) Steam distribution — TM 5-642 ch.4

- **Water hammer / pounding (¶4-80):** distinguish from expansion snapping on warm-up. True hammer = water slugs carried at steam velocity, force enough to break piping. Causes: (a) carryover through the boiler nozzle from excessive steaming rate, oil/grease priming, or high water level; (b) condensate trapped by sagging mains, pockets, plugged/faulty drip connections; (c) air-bound mains from defective vents trapping condensate behind the air pocket.
- **Heating unit fails to heat (¶4-81):** inadequate steam pressure; defective/plugged supply valve (disc fallen onto seat); air-bound radiator (defective vent or trap); waterlogged radiator (defective trap); pocketed or rising discharge connection flooding the unit; undersized traps; long/high coils air-bind — add vents and/or vacuum breakers; inadequate pitch → poor drainage, marked in fin-tube.
- **Loss of pressure (¶4-79):** inadequate firing/poor combustion, insufficient draft, sooted passages, starved boiler-room air; dirty boiler (scale waterside, soot fireside); broken main; load beyond capacity; oil/grease in boiler water; defective steam gauge (open test cocks to confirm). Don't confuse with legitimate sub-atmospheric operation of vapor/vacuum systems at low fire.
- **Traps (¶ around 4-100/4-101, 2953–3069 in the extract):** radiator fails to heat on air binding when the thermostatic element fails; trap leak detection by listening/test-valve set-up (fig. 4-33); block-valve isolation for inspection; don't insulate steam traps; strainers ahead of traps keep dirt/scale out; trap failure to pass condensate can freeze extended-surface coils ("non-freeze" coil piping: steam supply, condensate, venting per ¶4-59 — least freeze-prone when properly installed and pitched).
- **Condensate/vacuum pumps (¶4-83, 4-84, Appendix C):** steam venting from the pump = leaking traps, open trap bypasses, or boiler water backing through leaking discharge check valves → vapor binding; a vacuum pump fed hot condensate can't pull vacuum — put it on float control or it runs continuously doing nothing. Water venting from pump check: inadequate pump capacity/discharge pressure (gauge it at the outlet vs the curve), wrong rotation (rubber-tipped pencil test), float control miscut-in, worn impeller/clearances, clogged outlet, makeup valve leaking/set high (fix: auxiliary receiver or switch to receiver-level control).
- **Appendix C (steam pressure-powered condensate pumps), full symptom table:** unit fails to fill (fill-line obstruction/closed valve/backwards check; leaking 3-way valve; receiver pressure above discharge pressure — traps blowing through); fills too slowly (restricted fill or vent line, 3-way valve maladjusted); fills too fast + flooding (defective discharge check back-flowing); hammer at fill check = cold condensate → throttle flow-control valve; discharge too rapid + hammer = motive pressure too high → throttle; discharge cycle > ~30 s with flooding → adjust flow control toward ≈24 s discharge, check back-pressure rise, extend short electrode if oversized for current load; no steam flow = supply failure/strainer; noisy 3-way valve = condensate in steam supply.
- **Appendix B:** underfeed-stoker troubleshooting table (coal) — present, likely irrelevant for McMurdo's oil plants; skip.

### (e) Arctic / cold-region heating

- TM 5-642 touches freeze risks (coil freeze-up from failed traps ¶4-59/4-76-area; boiler freeze from cold-air backflow; "non-freeze" steam coil design) but has no fuel-gelling or glycol content.
- Dedicated cold-regions docs (Army TM 5-852-x Arctic and Subarctic Construction series; UFC 3-130-01..07 which superseded them; CRREL reports on utilities in cold regions) — see Sources; rights statements OPEN (not individually verified in this pass).

## Numeric targets (each with citation)

| Value | Figure | Citation |
|---|---|---|
| Oil pump pressure, heavy oil | 100 psi | TM 5-642 ¶3-11a |
| Gauge set for service | 150 psi gauge standard; up to 600 psi for high-pressure gun burners | TM 5-642 ¶3-13a(1) |
| Draft at burner start (breeching) | 0.02–0.04 in. w.g. | TM 5-642 ¶3-11b(1) |
| Firebox draft required for starting | ~0.03–0.06 in. w.g. | TM 5-642 ¶3-13f |
| Flue-gas CO2 after adjustment | ≈10% | TM 5-642 ¶3-11b(11) |
| Burner-health O2 criterion | down to 5% excess O2 without smoke, else retrofit candidate | TM 5-642 ¶3-23e |
| Full-load instantaneous efficiency band | 80–90% | TM 5-642 ¶3-23c(1) |
| Fire-safety fusible link release | ≈165°F | TM 5-642 ¶3-14a |
| Oil delay valve timing | opens ≥4 s after motor start; instant close | TM 5-642 ¶3-14b |
| Steam LWCO count | 2 independent (steam), 1 (hot water) | TM 5-642 ¶7-13b |
| Pressure-powered condensate pump discharge cycle | adjust to ≈24 s; >30 s = symptom | TM 5-642 App. C |
| Voltage check on nuisance lockouts | recording voltmeter ≥24 h | TM 5-642 ¶3-13d(6)(a) |
| Smoke spot number target | NOT in TM 5-642 | OPEN — need DOE/EPA or Bacharach-style source |
| CAD cell resistance limits | NOT in TM 5-642 | OPEN |
| Glycol strength vs freeze point | NOT in TM 5-642 | OPEN |

## Sources

- TM 5-642, Operation and Maintenance: Small Heating Systems (Aug 1990): https://www.wbdg.org/FFC/ARMYCOE/COETM/tm_5_642.pdf — local copy `/home/joseph/hvac-field/research/.dl/tm_5_642.pdf` (+ `.txt` extraction). Rights: "public property and not subject to copyright" (front matter).
- TM 5-650, Central Boiler Plants (Oct 1989): https://www.wbdg.org/FFC/ARMYCOE/COETM/tm_5_650.pdf — local copy `/home/joseph/hvac-field/research/.dl/tm_5_650.pdf`. Rights: "Approved for public release; distribution is unlimited" (cover and title page, verified in extraction).
- EverySpec mirrors: https://everyspec.com/ARMY/TM-Tech-Manual/tm5_642_5013/ and https://everyspec.com/ARMY/TM-Tech-Manual/tm5_650_5105/
- UFC 3-430-07 O&M: Inspection and Certification of Boilers and Unfired Pressure Vessels, w/Change 5 (2019): https://www.wbdg.org/FFC/DOD/UFC/ufc_3_430_07_2003_c5.pdf (supersedes MIL-HDBK-1152, the ex-NAVFAC boiler-inspection lineage).

- EPA-600/2-75-069-a (1975) catalog records: HathiTrust full view https://catalog.hathitrust.org/Record/101642684 ; ECU catalog (links to EPA NEPIS) https://lib.ecu.edu/catalog-preview/catalog/3433921
- DOE Improving Steam System Performance, 2nd ed. (2012): https://www.energy.gov/sites/prod/files/2014/05/f15/steamsourcebook.pdf ; OSTI record https://www.osti.gov/biblio/1094887 ; 2002 NREL edition https://www.nrel.gov/docs/fy02osti/31797.pdf
- UFC 3-130-01 (2024), Arctic and Subarctic Engineering: https://www.wbdg.org/FFC/DOD/UFC/ufc_3_130_01_2024.pdf (supersedes 2004 edition, which superseded TM 5-852-1); inactive 2004 copy https://www.wbdg.org/FFC/DOD/UFC/INACTIVE/ufc_3_130_01_2004.pdf
- SCAQMD Rule 2012 Attachment D (regulatory smoke-spot/CO method; non-federal, for cross-check only, not PD-assumed): https://www.aqmd.gov/docs/default-source/rule-book/reg-xx/rule-2012-appendix-a/attachment-d.pdf?sfvrsn=4 — lists smoke-spot No. 1 for #1/#2 oils, No. 4 for heavier oils, 400 ppm CO threshold, as the floor for setting minimum excess O2 plus margin.

## Open questions

- (OPEN) TM 5-650 body text — scanned; OCR targeted pages (flue-gas analysis ch.1 §II "Flue Gas Analysis and Temperature" p.1-15; safety valves ch.2 p.2-24; water treatment) when a specific cross-check needs it. Title-page rights already confirmed.
- (OPEN) EPA-600/2-75-069-a — pull the ~27-page PDF from EPA NEPIS or HathiTrust full view; this is the authoritative PD source for smoke-spot ≤ trace–No.1 adjustment procedure and CO2 targets for residential gun burners. (Field practice it codifies: adjust air to a trace of smoke, measure CO2, then open air until smoke reads zero.)
- (OPEN) DOE steam sourcebook + DOE steam tip sheets — extract the steam-trap testing and distribution content; text is a US Gov't work, PD (ignore stock cover photos).
- (OPEN) Cold-regions fuel specifics (arctic diesel/AN8 cloud/pour point, fuel gelling, glycol strength tables) — current UFC 3-130 series (2024, public release) + CRREL reports via erdc-library.erdc.dren.mil; the utilities volume (~118 pp) covers utility distribution and cold-regions thermal calcs; not yet opened.
- (OPEN) CAD-cell resistance limits — no federal PD source found this pass (TM 5-642 predates CAD-cell detail; its safeguards are stack switch/protectostat/photo eye). KB row should cite manufacturer literature (Honeywell R8184 class: typically <1600 Ω flame / >20 kΩ dark) and mark it non-PD-sourced until a federal doc is found.
- (OPEN) UFC 3-430-07 title-page distribution statement — fetch and confirm (expected "Distribution Statement A").
- (OPEN) NAVFAC MO-205/MO-209 — one more targeted sweep of everyspec + navfac archives could still surface scans; low priority since the UFC successors are in hand.
