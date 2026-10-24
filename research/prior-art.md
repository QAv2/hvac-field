# Prior-art sweep: offline HVAC/R symptom-to-cause diagnostic tool (McMurdo deployment)

Date: 2026-10-22. Time-boxed sweep, roughly 20 minutes. Several sources were blocked or 404'd during fetch; those gaps are marked OPEN.

## What this means for the build

- **Refrigerant math: use CoolProp.** It is MIT-licensed (confirmed on its GitHub page) and has a WebAssembly/JS build, so PT charts and superheat/subcool math can run fully offline in a static page. Verify the exact refrigerant list (especially R-454B, R-448A, R-449A) against the fluid docs before promising coverage.
- **Diagnostic knowledge: write our own database.** No open-source, permissively licensed symptom-to-cause HVAC/R app turned up. The commercial tools (measureQuick, Danfoss Troubleshooter, Hussmann app) are proprietary and should be treated as reference for shape only, not for content. Build the fault matrix from public physics and general practice, citing textbooks and manufacturer-neutral sources.
- **Military manuals: the public-domain status is unconfirmed.** The TM 5-series refrigeration/AC repair manuals found (TM 5-670, TM 5-9477) carry copyright or "contains copyrighted material" notes or unverified rights. Do not treat them as public domain until HathiTrust or the Army Publishing Directorate confirms it on the title page.
- **Scope from McMurdo postings:** utility mechanics at McMurdo handle fuel-fired boilers and hydronic/steam heat, glycol lines, refrigeration, HVAC (ventilating and cooling), pumps, and galley equipment. Scope the database around hydronic heat, refrigeration, and air handling first.
- **Heuristic matrix:** the superheat/subcool 9-state matrix is consistent across sources, but the high-SH/high-SC row conflicts between sources. Design the tool to show the conflict and rank causes, not to output one answer.

## 1. Existing open-source / free offline HVAC troubleshooting tools and datasets

- **No permissive open-source symptom-to-cause app found.** One search pass did not find a GitHub repo with a technician-facing fault tree. Search GitHub directly for "refrigeration diagnostics", "superheat subcooling", and "HVAC fault tree" before concluding none exists (OPEN).
- **NREL OpenStudio fault models** (github.com/NREL/OpenStudio-fault-models): scripts that model typical HVAC faults in commercial buildings. It is a simulation tool, not a technician app. License not confirmed in search results; check the repo's LICENSE file (OPEN). Source: https://www.nrel.gov/research/software/openstudio---fault-modeling
- **SourceForge "hvacr" project** (https://www.sourceforge.net/projects/hvacr/): listed as an open-source HVAC/R tools project under GPLv2. No symptom or fault-tree content described. GPLv2 means code reuse would bind us to GPL; reading is fine, copying content should be avoided unless we are happy to be GPL.
- **Commercial, not reusable:** Danfoss Troubleshooter (https://danfoss.com/en-us/service-and-support/downloads/dcs/troubleshooter) is a symptom-search tool, now part of the Ref Tools app, with a proprietary disclaimer. Hussmann HVACR troubleshooting app (https://www.hussmann.com/en/news/hussmann-launches-new-hvacr-troubleshooting-app-service-technicians). Sunset Technology iPhone app (https://apps.apple.com/tr/app/sunset-technology/id6738960643). measureQuick KB articles (https://support.measurequick.com/portal/en/kb/articles/superheat-subcooling-faults) are useful as a reading of the public approach but are copyrighted; do not copy.

## 2. Open refrigerant-property libraries (offline)

- **CoolProp.** License: MIT, confirmed on the project's GitHub page (https://github.com/CoolProp/CoolProp). The site also says "Commercial - ok! Academic? - ok!" (https://coolprop.org/).
- **JS/WASM build.** The C++ core compiles to WebAssembly with a JS wrapper. Package seen: coolprop_js_npm (https://www.npmjs.com/package/coolprop_js_npm), which reports CoolProp 6.5.0. Also coolprop-node (https://app.unpkg.com/coolprop-node@1.1.0/files/README.md), bundling CoolProp 8.0. Pin a version and verify its own license file, since third-party wrappers may differ. The official WASM file was seen on OSDN (https://zh.osdn.net/projects/sfnet_coolprop/downloads/CoolProp/6.4.1/Javascript/coolprop.wasm/), 6.4.1, so that is older.
- **Refrigerant coverage vs. the target list: OPEN.** The CoolProp fluids page 404'd in both URL forms tried. From general knowledge (inference, not verified in this sweep): CoolProp covers R-410A, R-22, R-32, R-404A, R-134a, R-407C, R-507A, R-290, and R-744 as pure fluids or predefined mixtures. R-448A, R-449A, and R-454B are likely present in recent versions but this is unconfirmed. Verify against the fluid list in the version we pin.
- **REFPROP** (NIST) is the reference alternative but is a paid/restricted license, not usable as a free bundle. Treat as not an option for distribution (inference; confirm license at https://www.nist.gov/srd/refprop before relying on it).

## 3. Public / government troubleshooting sources

- **TM 5-670, "Repairs and utilities: Refrigeration, air conditioning, mechanical ventilation, and evaporative cooling" (Feb 1962; supersedes M 5-670, 1947).** UNT Monthly Catalog record: https://mocat.library.unt.edu/catalog/809-11016 (the search landed on this record; check the exact catalog number before citing). The record notes "Contains copyrighted material." Public-domain status NOT confirmed. Check HathiTrust (https://babel.hathitrust.org/) for a rights statement on any digitized volume.
- **TM 5-9477 (1955)**, skid-mounted water-cooled AC unit (Typhoon SA-500). Catalogued at UNT; HathiTrust digital copy noted with a "pda" (public domain access) tag per one search result. Verify the rights on HathiTrust before use (OPEN).
- **TM 5-810-1 (June 1991), HVAC mechanical design.** A design manual, not troubleshooting. Hosted on EverySpec (https://everyspec.com/ARMY/TM-Tech-Manual/TM_5-810-1_47186/). Free to download but EverySpec hosting does not establish public domain. Low relevance for a technician tool.
- **Army Publishing Directorate (armypubs.army.mil)**: no result returned in search. Direct search for specific TM numbers and a check of each title page's distribution statement is the next step (OPEN).
- **Spam warning:** a search returned "TM 5 4120 243 14" PDF hits on a university-hosted spam site. Do not use.
- **EPA Section 608.** The EPA certification program page (https://www.epa.gov/section608/section-608-technician-certification-program) returned 404 on fetch. Use the EPA's official site directly (OPEN). Commercial study books (ESCO Institute Section 608 Preparatory Manual) exist. Aggregator "free PDF" sites should be avoided.
- **Not yet searched (next pass):** NIST and DOE public refrigeration/heat-pump material; ASHRAE handbook excerpts; manufacturer-published charging charts (Carrier, Trane, Hussmann, Danfoss) that are freely downloadable as technical literature.

## 4. McMurdo equipment scope (from public postings)

- **Utility Mechanic (Amentum, Antarctic Support Contract)**, diagnosis, repair, and preventive maintenance across station buildings. Covers heating, ventilating, cooling, refrigeration, hydronic systems, pumps, and galley equipment. Source: https://jobs.hiringourheroes.org/jobs/267262763/apply and https://amentum.dejobs.org/virtual-ata/utility-mechanic/61F3B7C049BA4B7381287BB0A24A3FFC/job
- **Boiler Mechanic (Winter 2027, Amentum/ASC).** Hydronic, hot-water, and steam heating; boiler maintenance under ASME BPVC; troubleshooting station boilers and heat exchangers; inspecting glycol and steam lines; emergency calls. Source: https://www.hays.net.nz/job-detail/utility-mechanics-needed-in-antarctica!-christchurch_2996166 (recruitment listing, cited as a posting summary; confirm on the Amentum site).
- **Refrigeration mechanic listing** asks for 4+ years experience (source: same recruitment search; confirm).
- **Summer utility mechanic, Oct 2026 to Feb 2027** (third-party listing, jobspace.co.nz/jobs/86335). Confirm terms with the employer.
- Postings are third-party aggregators and may have changed; the Amentum careers site is canonical.

## 5. Diagnostic heuristics (public physics and practice)

- **Superheat/subcool core matrix** (consistent across sources):
  - High SH, low SC: undercharge. Find and fix the leak before adding refrigerant.
  - Low SH, high SC: overcharge. Recover refrigerant.
  - Low SH, low SC: metering device passing too much (TXV stuck open or oversized piston).
  - High SH, high SC: CONFLICT between sources. Candidates named: liquid-line or filter-drier restriction, TXV stuck closed, undersized piston, TXV bulb charge lost, plugged drier. Adding refrigerant does not fix it. Show the conflict in the tool.
  - Sources: OXmaint (https://oxmaint.com/industries/hvac/how-to-read-refrigerant-pressure-chart-a2l-hfc-hfo-subcool-superheat), SupplyHouse blog (https://blog.supplyhouse.com/?p=227430), measureQuick (https://support.measurequick.com/portal/en/kb/articles/overcharge-undercharge-recognition), ContractingBusiness (https://www.contractingbusiness.com/service/article/21247583/introduction-to-superheat-and-subcooling-diagnostics). All are secondary; a textbook (e.g., ASHRAE or Refrigeration & Air Conditioning Technology) would be better (OPEN).
- **Restriction check:** a filter-drier temperature drop above about 2-3 °F suggests restriction (vendor blog; verify).
- **Airflow first:** verify airflow (about 350-450 CFM per ton cited) before judging charge. Sources: same secondary group.
- **Non-condensables:** high subcooling with high discharge pressure can mean non-condensables; isolate and re-evacuate before recharging. Thinly covered.
- **Compressor valves:** low suction and low discharge can indicate valve failure or severe undercharge; recommend a pump-down or efficiency test. Single vendor source, uncorroborated. Verify.
- **Fixed-orifice target superheat:** no closed-form formula found. Target SH is read from a chart using indoor wet-bulb and outdoor dry-bulb (target rises with indoor wet bulb, falls slowly with outdoor dry bulb). Sample approximate values (about 24 °F at 95 °F OD / 67 °F IWB; about 28 °F at 75 °F OD / 60 °F IWB) come from a non-manufacturer site (https://www.acservicetech.com/target-superheat or similar). Use manufacturer charging charts instead (Carrier and Trane publish them; not retrieved in this pass). Chart source: https://hvacrschool.com/how-to-find-target-superheat (OPEN for the manufacturer chart).
- **Subcool targets** vary: 10-15 °F cited for modern TXV systems in one source, 15-20 °F in another. Manufacturer data governs.
- **Delta-T rules:** not researched in this pass (OPEN).

## Open questions

1. CoolProp refrigerant list for the pinned version (confirm R-454B, R-448A, R-449A).
2. HathiTrust rights for TM 5-670 and TM 5-9477.
3. Armypubs.army.mil and DTIC for any refrigeration/heating TM with an explicit "distribution unlimited" statement.
4. GitHub search for open-source HVAC fault-tree projects with a permissive license.
5. Manufacturer charging charts (Carrier, Trane) and an ASHRAE or textbook source for the 9-state matrix and delta-T rules.
6. Official EPA Section 608 page (the cached fetch returned 404).
