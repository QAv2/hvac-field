# NIST (US-government) FDD fault-signature tables — transcription for the Bayesian engine

Status: COMPLETE (research worker, 2026-10-22). All tables transcribed from NIST-hosted, public-domain PDFs (downloaded + text-extracted this session).

## What this means for the build

- **We have a citable, public-domain TXV cooling chart** (SP 1087 Table 5.2) and a **fixed-orifice chart** (SP 1087 Table 5.1(a), Breuker & Braun data as republished by NIST). The engine's refrigeration-circuit signatures should branch on metering device: with a TXV, many cells go **neutral** (the valve masks faults) and the signature depends on whether superheat is in control (zone A, Tsh < 9 °C) or the TXV is saturated (zone B) — that zone split is itself diagnostic and belongs in the engine.
- **NIST's method is already Bayesian-shaped:** per-feature residual vs a no-fault model, Gaussian P(↑/–/↓), product across features, fault wins when it beats P(no-fault). We can adopt the structure and the 99 % thresholds (Table 5.8: roughly 0.25–1.0 °C per feature) as priors for sensor-noise floors.
- **Heating mode:** no NIST-hosted arrow chart exists; TN 1648 gives signed slopes instead. Our §2a table is a derived direction chart (marked inference, every cell traceable to a printed slope). Headline heating facts: liquid-line restriction is nearly invisible; subcooling collapse (−90 %) is the undercharge tell; discharge temp + condensing temp + subcooling all ↑ is the overcharge tell.
- **AHU side:** APAR's 28 mode-gated rules (NISTIR 6964 Table 3.1) with default thresholds (εt = 1.7 °C, fan rise 1.1 °C, etc.) are a complete, public-domain rule layer for air handlers; VPACC's three CUSUM errors cover VAV boxes. These are detection rules, not a fault × symptom matrix — map each rule to its fault group (§3b) for the Bayesian layer.
- **Rights are clean** for everything transcribed here: NIST federal-staff publications are US Government works (17 USC 105). Avoid the ASHRAE Transactions / HVAC&R Research / Applied Thermal Engineering versions of the same work (publisher copyright) and treat PNNL/LBNL/ORNL reports as potentially copyrighted (contractor labs).

## 1. NIST cooling-mode residential heat pump FDD — NIST SP 1087 (2008)

**Citation:** Minsung Kim, Seok Ho Yoon, W. Vance Payne, Piotr A. Domanski, *Cooling Mode Fault Detection and Diagnosis Method for a Residential Heat Pump*, NIST Special Publication 1087, October 2008. PDF: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication1087.pdf · landing: https://www.nist.gov/publications/cooling-mode-fault-detection-and-diagnosis-method-residential-heat-pump
**Rights:** NIST federal-staff publication → US Government work, 17 USC 105, not copyrightable in the US. (A companion journal paper, Payne/Domanski/Kim/Hermes in HVAC&R Research vol. 29, carries publisher copyright — cite the NIST SP, not the journal version.)
**Verified:** PDF downloaded and text-extracted 2026-10-22; all tables below transcribed from the extracted text.

**Test unit / conditions:** R410A unitary split residential heat pump, 8.8 kW (2.5 ton) nominal cooling, SEER 13, **TXV** on the indoor coil (cooling mode). Tested in NIST environmental chambers; features sampled at 14 s intervals, 10-sample (140 s) moving window; steady-state detector gates the FDD (window std-dev < 3× no-fault steady-state std-dev for every feature).

**Features (all temperatures):**
| Symbol | Meaning |
|---|---|
| TE | evaporator saturation temperature (from pressure) |
| Tsh | refrigerant superheat at evaporator exit / suction |
| TD | compressor discharge refrigerant temperature |
| TC | condenser saturation temperature (from pressure) |
| Tsc | liquid-line subcooling at condenser exit |
| ΔTCA | air temperature rise across the condenser (outdoor coil) |
| ΔTEA | air temperature drop across the evaporator (indoor coil) |

**Faults studied (Table 5.9, transcribed):**
| Fault | Abbr. | Fault level measured as |
|---|---|---|
| Compressor leakage (4-way valve leakage) | CMF | % of refrigerant flow rate |
| Improper outdoor air flow rate (condenser) | CF | % of coil area blocked |
| Improper indoor air flow rate (evaporator) | EF | % of correct air flow rate |
| Liquid-line restriction | LL | % of normal pressure drop through TXV |
| Refrigerant overcharge | OC | % overcharge from correct charge |
| Refrigerant undercharge | UC | % undercharge from correct charge |

Non-condensable gas was implemented as a seventh artificial fault in the lab but is **not** in the online rule chart — NIST says it is diagnosed off-cycle by checking partial pressure while the system is off (citing Stylianou & Nikanpour 1996; Li 2004).

### 1a. THE MAIN TXV COOLING-MODE CHART — SP 1087 Table 5.2, "Rule-based fault pattern chart of seven features" (transcribed exactly; ↑ = positive residual, ↓ = negative residual, – = no change/neutral)

Zone A: Tsh < 9 °C (TXV in control). Zone B: Tsh > 9 °C (TXV saturated / acting like fixed orifice).

| Fault Type | zone¹ | TE | Tsh | TD | TC | Tsc | ΔTCA | ΔTEA |
|---|---|---|---|---|---|---|---|---|
| Compressor valve leakage² | A | ↑ | – | ↑ | ↓ | ↓ | ↓ | ↓ |
| Improper outdoor air flow | A | ↑ | – | ↑ | ↑ | ↓ | – | ↓ |
| Improper outdoor air flow | B | ↓ | ↑ | ↑ | ↑ | ↓ | ↓ | ↓ |
| Improper indoor air flow² | A | ↓ | – | – | ↓ | – | ↓ | ↑ |
| Liquid-line restriction³ | A | – | – | – | – | – | – | – |
| Liquid-line restriction | B | ↓ | ↑ | ↑ | ↓ | ↑ | ↓ | ↓ |
| Refrigerant undercharge | A | – | – | – | ↓ | ↓ | ↓ | ↓ |
| Refrigerant undercharge | B | ↓ | ↑ | ↑ | ↓ | ↓ | ↓ | ↓ |
| Refrigerant overcharge² | A | – | – | ↑ | ↑ | ↑ | – | – |
| No-fault | – | – | – | – | – | – | – | – |

Footnotes as printed: ¹ Zone A: Tsh < 9 °C, Zone B: Tsh > 9 °C. ² The case of Tsh > 9 °C was not observed within the fault levels of this study. ³ The rules when Tsh < 9 °C were identical with no-fault cases (i.e., a mild liquid-line restriction is invisible while the TXV compensates).

### 1b. FIXED-ORIFICE chart — SP 1087 Table 5.1(a), reproduced by NIST from Breuker & Braun (1998b): rooftop air conditioner, short-tube orifice, constant-speed compressor, no controller

(Provenance caution: the underlying experiments are Purdue/Braun academic work; the direction-of-change entries are factual data and this transcription is from the public-domain NIST SP. Cite as "Breuker & Braun 1998b, as tabulated in NIST SP 1087 Table 5.1(a).")

| Fault Type | TE | Tsh | TD | TC | Tsc | ΔTCA | ΔTEA |
|---|---|---|---|---|---|---|---|
| Compressor valve leakage | ↑ | ↓ | ↑ | ↓ | ↓ | ↓ | ↓ |
| Refrigerant leakage (undercharge) | ↓ | ↑ | ↑ | ↓ | ↓ | ↓ | ↓ |
| Liquid-line restriction | ↓ | ↑ | ↑ | ↓ | ↑ | ↓ | ↓ |
| Condenser fault (fouling/low airflow) | ↑ | ↓ | ↑ | ↑ | ↓ | ↑ | ↓ |
| Evaporator fault (fouling/low airflow) | ↓ | ↓ | ↓ | ↓ | ↓ | ↓ | ↑ |

No neutral entries: with no controller, every fault moves every feature. Note TE and Tsh for condenser fault here (↑/↓) vs the TXV unit's zone-B (↓/↑) — NIST attributes the ΔTEA/blocking differences partly to *where* the coil was blocked (NIST blocked the outdoor coil from the bottom; Breuker & Braun blocked randomly). **Conflict flag:** Table 5.1(a) as printed in SP 1087 shows condenser fault TE ↑, Tsh ↓ for the fixed-orifice rooftop unit, while the NIST TXV unit zone B shows TE ↓, Tsh ↑ — genuinely different hardware behavior, not a typo; keep them as separate priors keyed on metering device.

SP 1087 Table 5.1(b) and 5.1(c) (water-to-water heat pumps with EEV, constant- and variable-speed compressor, from Kim & Kim 2005) are also printed in the SP; main lesson transcribed: as controller count rises (orifice → EEV → EEV+variable speed), more cells go neutral — controllers hide faults. Features there are ΔTCW/ΔTEB (water-side deltas) + compressor speed N, less relevant to our residential lane; not transcribed cell-by-cell here (OPEN if we ever need them — they're on pp. 39–40 of the PDF).

### 1c. Thresholds / no-fault reference model (for our engine's noise floor)

- No-fault reference: 3rd-order multivariate polynomial regression (MPR) of each feature vs operating condition (indoor/outdoor temps); residual r = μ(window) − μ(no-fault model).
- Neutral band ε per feature combines three variances (steady-state noise, model error, day-to-day repeatability): ε_i = sqrt[(k1·σ_SS/√n)² + (k2·σ_Model)² + (k3·σ_Repeat)²], k's from Student-t / Gaussian at the chosen confidence (99 %: k1 = 3.25 for a 10-sample window).
- **Table 5.8(b), 10-sample moving window, thresholds in °C (transcribed):**

| Credibility | Tsh | Tsc | TE | TD | TC | ΔTCA | ΔTEA |
|---|---|---|---|---|---|---|---|
| 50 % (ε_0.50) | 0.130 | 0.134 | 0.092 | 0.243 | 0.082 | 0.064 | 0.086 |
| 95 % (ε_0.95) | 0.496 | 0.411 | 0.323 | 0.755 | 0.237 | 0.187 | 0.271 |
| 99 % (ε_0.99) | 0.735 | 0.574 | 0.424 | 0.983 | 0.313 | 0.248 | 0.373 |

(Table 5.8(a), 5-sample window, is nearly identical: 99 % row = 0.758 / 0.579 / 0.426 / 0.987 / 0.317 / 0.265 / 0.383.)

- Diagnosis is Bayesian-flavored already: each residual gets P(C↑|X), P(C−|X), P(C↓|X) from the Gaussian around the no-fault prediction; a fault row's probability is the product across the seven features (independence assumed, after Rossi & Braun 1997); the fault wins when its product beats the no-fault product. This is directly the likelihood structure our engine wants.

**Follow-on NIST implementations (same chart):** NIST TN 1774 (Heo/Payne/Domanski 2012, commissioning tool with temperature thresholds/offsets, https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1774.pdf) and NIST TN 2130 (Payne 2020, LabVIEW user's guide). Both US Government works. Not transcribed (OPEN) — same rule chart lineage.

## 2. NIST heating-mode single-fault work — NIST TN 1648 (2009)

**Citation:** W. Vance Payne, Piotr A. Domanski, Seok Ho Yoon (order per cover), *Heating Mode Performance Measurements for a Residential Heat Pump with Single-Faults Imposed*, NIST Technical Note 1648, September 2009. PDF: https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1648_2009.pdf
**Rights:** NIST federal-staff publication → US Government work, 17 USC 105, public domain. (The follow-on paper "Residential Heat Pump Heating Performance with Single Faults Imposed," Purdue IRACC 2010 / Applied Thermal Engineering 2011, is publisher-copyrighted — cite TN 1648 instead.)
**Verified:** PDF downloaded and text-extracted 2026-10-22.

**Test unit:** same R410A split heat pump as SP 1087 (8.8 kW / 2.5 ton cooling, SEER 13, HSPF 7.8, TXV), heating mode. In heating mode the **indoor coil is the condenser** and the outdoor coil is the evaporator; "condenser air flow fault" below = reduced *indoor* airflow, "evaporator air flow fault" = blocked *outdoor* coil. Faults as in cooling (Table 3.2): compressor/4-way-valve leakage, improper indoor airflow, improper outdoor airflow, liquid-line restriction, overcharge, undercharge.

**Format caveat:** TN 1648 publishes **linear-fit residual slopes per feature per fault** (Tables 5.1.1–5.6.2), not a single ↑/↓ rule chart. The heating-mode rule chart itself was published in the IRACC/ATE paper (copyrighted). The direction table below is **our inference** from the signs in TN 1648's own slope tables — each cell backed by the printed slope and "% change @ max fault level."

### 2a. Direction-of-change summary derived from TN 1648 Tables 5.1.1, 5.2.1, 5.3.1, 5.4.1, 5.5.1, 5.6.1 (indoor 21.1 °C, outdoor −8.3 °C dry; sign from printed slope / % change @ max fault; ~ = change below ~1 °C or within measurement noise at max fault)

| Fault (heating mode) | TER (evap sat, OD coil) | ΔTshE (evap exit SH) | TD (discharge) | TCR (cond sat, ID coil) | ΔTscV (liq subcooling) | ΔTCA (ID coil air rise) | ΔTEA (OD coil air drop) | Capacity | COP |
|---|---|---|---|---|---|---|---|---|---|
| Condenser (indoor) air flow fault — Table 5.1.1, max 32 % area | ~↑ (slope +0.005) | ~ (+0.001) | ↑ (+0.102/%, +3.7 %) | ↑ (+0.086/%) | ~↑ (+0.008) | ↑ (+0.101/%, +32 %) | ~↓ (−0.003) | ↓ −4.4 % | ↓ −3.7 % |
| Evaporator (outdoor) air flow fault — Table 5.2.1 | ↓ (−0.261/%, large) | ↑ (+0.250/%) | ↑ (+0.138/%) | ↓ (−0.097/%) | ↑ (+0.023) | ↓ (−0.073/%) | ↓ (−0.042/%) | ↓ −23.7 % | ↓ −23.5 % |
| Compressor / 4-way valve leakage — Table 5.3.1, max 17.5 % flow loss | ↑ (+0.039/%) | ↓ (−0.019/%) | ~↓ (−0.017, −0.2 %) | ↓ (−0.112/%) | ~↑ (+0.007) | ↓ (−0.074/%) | ↓ (−0.032/%) | ↓ −14.2 % | ↓ −13.8 % |
| Liquid-line restriction — Table 5.4.1 | ~↓ (−0.007) | ~ (+0.001) | ~↑ (+0.011) | ~ (−0.002) | ↓ (−0.014/%, −11 %) | ~ (−0.001) | ~ (−0.001) | ~ −1.1 % | ~ +0.1 % |
| Refrigerant overcharge — Table 5.5.1 | ~↑ (+0.008) | ~ (+0.004) | ↑ (+0.264/%, +11 %) | ↑ (+0.164/%, +10 %) | ↑ (+0.133/%, +64 %) | ~↑ (+0.003) | ~↓ (−0.004) | ~ +1.5 % | ↓ −7.9 % |
| Refrigerant undercharge — Table 5.6.1 (signs from % change @ max fault) | ↓ (−11.5 %) | ↑ (+8.8 %) | ↓ (−0.9 %) | ↓ (−2.8 %) | ↓↓ (−89.7 %) | ↓ (−5.7 %) | ↓ (−8.3 %) | ↓ −4.9 % | ↓ −2.8 % |

Notes transcribed from TN 1648's own text (§5.7 summary, exact findings):
- Liquid-line restriction "had very little effect upon the functioning of the system in the heating mode; the obtained results are within the uncertainty of our measurements" → in heating, LL restriction is essentially **undetectable** at the imposed levels (strongest tell: liquid-line subcooling ↓ ~11 %).
- 30 % indoor-coil airflow reduction → ~10 % COP loss at 8.3 °C/72.5 % RH outdoor; 30 % outdoor coil blockage at −8.3 °C → capacity −26 %, COP −24 %.
- Overcharge: negligible capacity effect but COP −14 % at +30 % charge (higher outdoor temp); undercharge 30 % → capacity −14 %, COP −9 %. Compressor/valve leakage: capacity −14 % at 12 % flow loss (8.3 °C outdoor).
- Table 5.6.1 flags its mR and QCR rows "(INVALID)" (flowmeter unreliable at low charge) — don't lean on refrigerant-side features for deep undercharge.
- Feature definitions (TN 1648 nomenclature): TER = evaporator exit saturation temp; ΔTshE = evaporator exit superheat; TD = compressor discharge *wall* temp; TCR = condenser inlet saturation temp; ΔTscV = liquid-line subcooling at outdoor service valve; ΔTCA = condenser (indoor) air temp rise; ΔTEA = evaporator (outdoor) air temp drop.

**OPEN:** whether NIST hosts a formal heating-mode ↑/↓ *rule chart* table (TN 1648 companion at nist.gov lists the IRACC/ATE paper only). The 2010 Purdue IRACC conference version is free to read at docs.lib.purdue.edu but is conference-copyrighted; its direction chart should match the inference table above — a cross-check pass could confirm cell-by-cell.

## 3. NIST APAR air-handling unit rules — via NISTIR 6964 (2003)

**Citation (NIST-hosted, used here):** N. S. Castro, J. Schein, C. Park, M. A. Galler, S. T. Bushby, J. M. House, *Results from Simulation and Laboratory Testing of Air Handling Unit and Variable Air Volume Box Diagnostic Tools*, NISTIR 6964, 2003, §3.2 + Attachment A. PDF: https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6964.pdf
**Original rule-set paper:** House, Vaezi-Nejad, Whitcomb, "An Expert Rule Set for Fault Detection in Air-Handling Units," ASHRAE Transactions 107(1), 2001 — **ASHRAE copyright**; do not transcribe from it. NISTIR 6964 (US Government work, 17 USC 105, public domain) reprints the full 28-rule set, which is what's transcribed below.
**Verified:** PDF downloaded and text-extracted 2026-10-22. Related NIST-hosted follow-ons: NISTIR 6994 (field testing, Schein/Bushby/Milesi-Ferretti/House) and NISTIR 7960 (Galler, APAR DLL programmer's guide) — both US Gov works, not transcribed (OPEN).

**Scheme:** single-duct VAV AHU. Control signals classify the operating mode; only that mode's rules run. A rule evaluating **true indicates a fault**. Modes: 1 heating · 2 cooling with outdoor air (economizer) · 3 mechanical cooling with 100 % outdoor air · 4 mechanical cooling with minimum outdoor air · 5 unknown (occupied but no mode signature matches — itself suggests mode-transition or simultaneous heat/cool faults).

### 3a. APAR Rule Set — NISTIR 6964 Table 3.1 (transcribed exactly)

| Mode | Rule # | Rule expression (true ⇒ fault) |
|---|---|---|
| Heating (1) | 1 | Tsa < Tma + ∆Tsf − εt |
| Heating (1) | 2 | For \|Tra − Toa\| ≥ ∆Tmin: \|Qoa/Qsa − (Qoa/Qsa)min\| > εf |
| Heating (1) | 3 | \|uhc − 1\| ≤ εhc and Tsa,s − Tsa ≥ εt |
| Heating (1) | 4 | \|uhc − 1\| ≤ εhc |
| Cooling w/ outdoor air (2) | 5 | Toa > Tsa,s − ∆Tsf + εt |
| Cooling w/ outdoor air (2) | 6 | Tsa > Tra − ∆Trf + εt |
| Cooling w/ outdoor air (2) | 7 | \|Tsa − ∆Tsf − Tma\| > εt |
| Cooling w/ outdoor air (2) | 8 | Toa < Tsa,s − ∆Tsf − εt |
| Mech cooling, 100 % OA (3) | 9 | Toa > Tco + εt |
| Mech cooling, 100 % OA (3) | 10 | \|Toa − Tma\| > εt |
| Mech cooling, 100 % OA (3) | 11 | Tsa > Tma + ∆Tsf + εt |
| Mech cooling, 100 % OA (3) | 12 | Tsa > Tra − ∆Trf + εt |
| Mech cooling, 100 % OA (3) | 13 | \|ucc − 1\| ≤ εcc and Tsa − Tsa,s ≥ εt |
| Mech cooling, 100 % OA (3) | 14 | \|ucc − 1\| ≤ εcc |
| Mech cooling, min OA (4) | 15 | Toa < Tco − εt |
| Mech cooling, min OA (4) | 16 | Tsa > Tma + ∆Tsf + εt |
| Mech cooling, min OA (4) | 17 | Tsa > Tra − ∆Trf + εt |
| Mech cooling, min OA (4) | 18 | \|Tra − Toa\| ≥ ∆Tmin *(as printed in 6964; flag below)* |
| Mech cooling, min OA (4) | 19 | \|ucc − 1\| ≤ εcc and Tsa − Tsa,s ≥ εt |
| Mech cooling, min OA (4) | 20 | \|ucc − 1\| ≤ εcc |
| Unknown occupied (5) | 21 | ucc > εcc and uhc > εhc and εd < ud < 1 − εd |
| Unknown occupied (5) | 22 | uhc > εhc and ucc > εcc |
| Unknown occupied (5) | 23 | uhc > εhc and ud > εd |
| Unknown occupied (5) | 24 | εd < ud < 1 − εd and ucc > εcc |
| All occupied modes | 25 | \|Tsa − Tsa,s\| > εt |
| All occupied modes | 26 | Tma < min(Tra, Toa) − εt |
| All occupied modes | 27 | Tma > max(Tra, Toa) + εt |
| All occupied modes | 28 | Number of mode transitions per hour > MTmax |

**Conflict flag (Rule 18):** NISTIR 6964's text extraction shows Rule 18 as just the condition `|Tra − Toa| ≥ ∆Tmin`. In the original House et al. formulation, Rule 18 is the mode-4 analogue of Rule 2 (outdoor-air-fraction check gated on that condition). NISTIR 6964's own field narrative says Rule 18 firing "indicates that insufficient outdoor air was entering the AHU," consistent with the fraction check. OPEN: confirm against the PDF image (p. 25) or NISTIR 7960's DLL source — likely a layout/extraction truncation, not NIST's intent.

### 3b. Rule grouping / what each group diagnoses — NISTIR 6964 Table 3.2 (condensed transcription)

| Group | Rules (mode) | Reading |
|---|---|---|
| Coil subsystem | 1(1), 7(2), 11(3), 16(4) | Supply-air vs mixed-air + fan rise; relational sign flips by mode. |
| Mixing box subsystem | 2(1), 18(4), 26(all), 27(all) | Outdoor-air-fraction based; 26/27 true ⇒ OA fraction < 0 or > 1 (mixed-air or damper fault). |
| Comfort requirements | 25(all), 3(1), 13(3), 19(4); 4(1), 14(3), 20(4) | 3/13/19 ⇒ comfort sacrificed, valve saturated (system out of control); 4/14/20 ⇒ valve saturated, comfort soon at risk. |
| Economizer changeover | 5(2), 8(3) and 9(3), 15(4) | Mode vs outdoor temperature consistency; sign flips by mode. |
| Zone subsystem | 6(2), 12(3), 17(4) | Identical rule: supply air warmer than return minus return-fan rise while cooling. |
| Controller logic/tuning | 21–24 (unknown), 28 (all) | Simultaneous heating/cooling, heating with economizer, excessive mode cycling. |

**Sensor dependence (transcribed note):** without a mixed-air temperature sensor, Rules 1, 2, 7, 10, 11, 16, 18, 26, 27 drop out.

### 3c. Nomenclature (Attachment A, condensed) and default thresholds (§3.2.3, exact values)

Tsa/Tma/Tra/Toa = supply/mixed/return/outdoor air temps; Tsa,s = supply setpoint; Tco = changeover temp between modes 3/4; ∆Tsf, ∆Trf = supply/return fan temperature rise; Qoa/Qsa = outdoor air fraction = (Tma − Tra)/(Toa − Tra); uhc, ucc, ud = normalized heating-valve, cooling-valve, mixing-damper control signals [0,1]; ε* = per-signal thresholds; MTmax = max mode transitions per hour.

Default thresholds as printed: **εt = 1.7 °C** (all temperature comparisons; heuristic; rigorous version εt = εToa + εTma), **εf = 0.3**, **εcc = εd = εhc = 0.02**, **∆Tsf = ∆Trf = 1.1 °C** (default fan rise), **∆Tmin = 5.6 °C**, **MTmax = 6**.

### 3d. Fault coverage (NISTIR 6964 §3.2.2, transcribed list)

APAR detects rather than isolates; faults it can flag: stuck or leaking mixing-box dampers / heating-coil valves / cooling-coil valves; temperature sensor faults; design faults (undersized coils); sequencing logic errors; central-plant faults affecting hot/chilled water supply at the coils; inappropriate operator intervention. Field examples in the report: stuck-open outdoor-air damper and manual damper override (caught by APAR in field tests); Rule 25 catching supply-setpoint tracking failure; Rule 18 catching insufficient outdoor air.

## 4. Other US-government fault × symptom material

### 4a. VPACC — VAV-box Performance Assessment Control Charts (NISTIR 6964 §4, same PDF/rights as §3)

Statistical (CUSUM) rather than a signature matrix, but directly reusable. Three generic errors, each tracked by a two-sided CUSUM (S_i = max[0, z_i − k + S_{i−1}]; T_i = max[0, −z_i − k + T_{i−1}]; alarm when S or T > h; example k = 0.5, h = 5 on z normalized to unit variance):

- **Airflow error** Qerror = Qactual − Qsetpoint → detects stuck damper, differential-pressure (flow) sensor faults, unstable airflow.
- **Zone temperature error** Temperror = Temproom − CSP if above cooling setpoint; HSP − Temproom if below heating setpoint; else 0 → detects damper faults, valve faults, temperature sensor faults.
- **Reheat-coil ΔT error** ∆Terror = DAT − EAT when the reheat valve is commanded closed (uhc = 0), else 0 → nonzero when closed ⇒ leaking reheat valve (and related coil faults).

### 4b. Candidates checked or left OPEN

- NIST TN 1774 (Heo/Payne/Domanski 2012) and TN 2130 (Payne 2020): implementations of the SP 1087 rule chart (thresholds/offsets, LabVIEW tool). US Gov works. Not transcribed — OPEN, likely redundant with §1.
- NISTIR 6994 (Schein et al., field testing of APAR/VPACC) and NISTIR 7960 (Galler, APAR DLL programmer's guide — a code-level statement of the 28 rules, good for resolving the Rule 18 ambiguity). US Gov works. OPEN.
- NIST TN 1648's cooling-mode sibling dataset is in SP 1087 itself (Kim et al. 2006 lab data, operating conditions in SP 1087 Table 5.10).
- Military TMs (Army TM 5-671, TM 5-642, Navy NAVFAC MO-series) contain boiler/chiller troubleshooting cause-tables and are US Gov works, but none was located with a vapor-compression fault × feature *direction matrix* at this quality — OPEN, low priority.
- PNNL/LBNL/ORNL FDD reports (e.g., PNNL rooftop-unit FDD, LBNL FDD evaluator): **contractor-operated labs — NOT automatically public domain**; many carry "Battelle Memorial Institute" or "The Regents of the University of California" notices. Use for cross-checks only, cite, don't transcribe wholesale.

## Sources & rights status

| Source | Rights | Status |
|---|---|---|
| NIST SP 1087 (Kim, Yoon, Payne, Domanski, 2008) — https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication1087.pdf | US Gov work (17 USC 105), public domain | VERIFIED — downloaded, tables transcribed |
| NIST TN 1648 (Payne, Domanski, Yoon, 2009) — https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1648_2009.pdf | US Gov work, public domain | VERIFIED — downloaded, slope tables transcribed |
| NISTIR 6964 (Castro, Schein, Park, Galler, Bushby, House, 2003) — https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6964.pdf | US Gov work, public domain | VERIFIED — downloaded, APAR + VPACC transcribed |
| House, Vaezi-Nejad, Whitcomb, ASHRAE Transactions 107(1), 2001 (original APAR paper) | ASHRAE copyright | NOT used for transcription; cited for provenance only |
| Payne/Domanski/Kim/Hermes, HVAC&R Research (cooling companion); Yoon/Payne/Domanski, Purdue IRACC 2010 / Applied Thermal Engineering 2011 (heating companion) | Publisher copyright | NOT transcribed; IRACC PDF free at docs.lib.purdue.edu for cross-check (OPEN) |
| Breuker & Braun 1998b; Kim & Kim 2005 (data inside SP 1087 Table 5.1) | Underlying experiments academic; direction data = facts, transcribed from the public-domain NIST SP | Transcribed with provenance note |
| NIST TN 1774, TN 2130, NISTIR 6994, NISTIR 7960 | US Gov works, public domain | OPEN — located, not opened |
| NIST landing pages: https://www.nist.gov/publications/cooling-mode-fault-detection-and-diagnosis-method-residential-heat-pump | — | Used for bibliographic confirmation |

Local copies of the three verified PDFs were staged in the session scratchpad (tmpfs — will not survive); re-download from the nvlpubs URLs above if needed.

## Open questions

1. **Rule 18 exact form** — resolve the APAR Rule 18 truncation (condition only vs full OA-fraction check) against the PDF page image or NISTIR 7960's DLL code. (High value, 10 min.)
2. **Heating-mode published arrow chart** — cross-check our §2a derived table cell-by-cell against the free Purdue IRACC 2010 paper (Yoon/Payne/Domanski). Directions should match; any mismatch means I mis-signed a slope.
3. SP 1087 Tables 5.1(b)/(c) (EEV water-to-water charts, Kim & Kim 2005) left untranscribed — only needed if the engine ever covers EEV/variable-speed equipment.
4. TN 1774's threshold/offset tables (commissioning tool) might give field-friendly fixed thresholds (vs SP 1087's statistical ε) — worth a pass when tuning the engine's defaults.
5. Non-condensable gas: NIST deliberately excludes it from the online chart (off-cycle partial-pressure check). Our engine should carry it as an off-cycle test recommendation, not a running signature; no NIST direction row exists for it in these documents.
6. Military TM / NAVFAC boiler + hydronic cause tables: not swept this session (bounded out).
