# Wireless HVAC/R probe brands: prior art and compatibility

Date: 2026-10-24. Scope: the seven questions in the brief (brands, radio, SDKs, open decoders, encryption, Web Bluetooth limits, priority, legal frame), plus the deliverables. Companion files, not repeated here: `uei-bluetooth.md` and `prior-art.md`. The run went about 15 minutes past the bound because the open-source search turned up the Fluke material.

Confidence tags:
- **VERIFIED**: I read the primary text myself (repo file, registry file, GitHub metadata, statute text, or issue labels).
- **SECONDHAND**: taken from a search-result summary, retailer or trade copy, or an aggregator. Not opened as a primary source.
- **UNVERIFIED**: claimed, but not confirmed, or unreachable with my tools.
- **INFERENCE**: my reasoning from the sources.

---

## 1. Answer

1. **Fluke Connect is the only brand in this set with a permissively licensed, public decoder that I could find.** Two open implementations exist. `jwanga/fluke-connect-client` (Rust, Apache-2.0, last push 2026-09-06) has a byte-level protocol note (VERIFIED). `zach-edf/fluke-app` (Python SDK, MIT, last push 2026-07-09) targets the 376 FC. The Rust note records that the ir3000 FC needs no pairing or bonding (VERIFIED from the repo, verified on one device by its author). That makes Fluke the first brand we can write against without the owner's hardware. The 902 FC and 3000 FC still need captures before we ship them.
2. **I found no published SDK, API or GATT document for any other brand here.** The one vendor document I found is Fluke's 2013 radio-module developer guide, which the Rust note cites as filed with the FCC under grant T68-FBLE. I did not open it. The only integration route that reaches many brands is measureQuick, a proprietary aggregator with a paid tier. It is not a route for us.
3. **UEi radio is still unproven.** Nothing I could reach names BLE or classic Bluetooth for the HUB probes. My fetch tool could not read the UEi HUB manual or the Fieldpiece JL3PR manual (both came back as binary PDFs). The DL599 clamp meter is the first thing to resolve. If it is classic Bluetooth, neither Web Bluetooth nor bleak can reach it.
4. **The Web Bluetooth blocklist is short, and none of the vendor UUIDs I found hit it.** This is VERIFIED against the WebBluetoothCG registry file. The real limits are platform limits. Safari has no Web Bluetooth. WebKit's standards tracker labels the Web Bluetooth proposal "position: oppose" (VERIFIED, issue closed 2025-12-02). For the owner's iPhone 14, the browser route is Bluefy or a native app.
5. **Legal, briefly.** 17 U.S.C. §1201(f) is an interoperability exception for a lawful user. It does not license decrypting a link or defeating its authentication. The Copyright Office's repair exemptions name vehicles, consumer devices, food-preparation equipment and medical devices. None names HVAC or general industrial or commercial equipment (SECONDHAND, summary of the CFR text). For an unencrypted notification stream, the practical risk is the vendor's contract terms, not §1201 (section 8).

**Confidence:** high on the Fluke decoder facts and the blocklist. Medium on the brand list, since no usage data exists. Low on radio types for every brand except Fluke (VERIFIED only through the Rust note's citation of the FCC filings, which I did not open).

**Lead's follow-up, same day (Opus 5.5).**
- Re-checked through the GitHub API: `jwanga/fluke-connect-client` (Apache-2.0, pushed 2026-09-06), `zach-edf/fluke-app` (MIT, pushed 2026-07-09) and `bensmith83/adwatch` (MIT) exist as stated. `docs/PROTOCOL.md` does say "No pairing or bonding is required. ATT MTU is 23" and gives the `b698xxxx-7562-11e2-b50d-00163e46f8fe` base.
- Read the two manuals the fetch tool couldn't (`pdftotext`; local copies in `research/.dl/probe-manuals/`, gitignored).
  - **Fieldpiece JL3PR quick start:** "BLE 4.0 devices running iOS 7.0 or Android 5.0", 2 × AAA, 150 h typical, wireless range 1000 ft (305 m) line of sight. Fieldpiece's JL3 probes are BLE (VERIFIED, primary).
  - **UEi HUB2/HUB4/HUB6 manual:** it never names the radio or the range. It cites FCC Part 15 and IC RSS-247, the 2.4 GHz digital-transmission standard that covers Bluetooth and BLE (VERIFIED, primary). The probes work with the UEi Hub iPhone app, and an iPhone app reaches a non-MFi accessory only through Core Bluetooth (GATT, in practice BLE); classic serial links need Apple's MFi program. So the HUB probes are very likely BLE GATT (INFERENCE; `tools/ble_scan.py` settles it). The same test applies to the DL599: if its app runs on an iPhone, it is GATT unless it is MFi-certified.

---

## 2. Compatibility matrix

Columns follow the brief. "Priority" key: P1 build first, P2 next, P3 later, P4 only if asked, none = no product found.

| Brand | Product line (examples) | Radio (as stated) | Companion app | Public SDK / protocol | Open-source decoder (licence) | Encrypted or bonded? | Web Bluetooth OK? | Priority |
|---|---|---|---|---|---|---|---|---|
| **UEi** (Kane Asia) | HUB kits: WPP1 pressure; WPC1 and WPC2 pipe clamps; WHP1 temp/RH; WOT2 outdoor temp; WVG2 vacuum (HUB8). DL599 clamp meter | Not confirmed. Retailer copy quoting UEi: probes "connect directly to your phone via Bluetooth". BLE likely, unproven. DL599: "Bluetooth wireless", BLE vs classic not stated | UEi Hub (App Store; Android not verified). UEi Link (SPM, DPM, DT2 kits) | No (none found) | None found | Unknown | UNVERIFIED. No GATT map yet. iOS only via Bluefy | P1 (owner's kit) |
| **Fluke** (Fluke Connect) | ir3000 FC IR adapter (Fluke 189, 287, 289, 789); 3000 FC multimeter; 376 FC and 902 FC clamps; t3000, v3000, a3000 FC modules | **BLE.** The ir3000 FC FCC filing (T68-IRFBLE) shows an FBLE radio module, CC2540 per the Rust note. VERIFIED as cited; FCC filing not opened | Fluke Connect (iOS, Android) | No Fluke Connect API found. Radio-module developer guide (V1.0, 2013) cited under FCC T68-FBLE (not opened) | `jwanga/fluke-connect-client` (Rust, Apache-2.0). `zach-edf/fluke-app` (Python SDK, MIT, 376 FC). MutekH libble Fluke profile (C, no licence). RatioLabs BLEService (BSD-3, dormant since 2014) | **No pairing or bonding** (ir3000 FC, VERIFIED in the Rust note) | Likely (INFERENCE): vendor service UUID not on blocklist. Not tested in Chrome | **P1** |
| **Testo** | Smart Probes 115i, 549i, 605i, 805i, 510i; 552i vacuum probe. Manifolds 550i, 557s, 570s. Scale 560i | BLE. 115i datasheets: Bluetooth 4.0, 100 m (SECONDHAND, search summary of Italian and Swiss datasheets). Newer manifolds: "Bluetooth 5.0" (SECONDHAND) | testo Smart Probes app (probes, free). testo Smart App (manifolds) | No (none found) | None found (repo search "testo smart probes" returned nothing) | Unknown. A retailer copy says probes "pair automatically" | UNVERIFIED | P2 |
| **Fieldpiece** | Job Link: JL3PC pipe clamp, JL3PR pressure probe, JL2 bridge for older radio manifolds. SMAN4 wireless manifold (feeds HG3). SM380V, SM480V, SM482V | BLE for JL3 probes (SECONDHAND, measureQuick support copy). Manual PDF unreadable to me | Job Link (Fieldpiece). Also measureQuick | No (none found) | None found. GitHub "fieldpiece" hits are a warranty system and a doc repo, both unrelated | Unknown. A measureQuick KB article "Fieldpiece Probe Pairing" exists (title only) | UNVERIFIED | P2 |
| **Yellow Jacket** (Ritchie) | ManTooth wireless P/T gauge kit (automotive, two wired clamps). Titan P51 manifold. TITANMAX manifold | Bluetooth. BLE vs classic UNVERIFIED | ManTooth (Android, iOS). YJACK VIEW (TITANMAX). measureQuick | No (none found) | None found | Unknown. An aggregator's reviews cite connection failures (UNVERIFIED) | UNVERIFIED | P2 |
| **NAVAC** | NEXUS 2 manifolds NX1, NX1G, NX1GV, NX4G, NX4GV (A2L, Bluetooth). NMV1S micron gauge. Temperature clamps | Bluetooth. BLE vs classic not stated. Retailer range: up to 80 m (260 ft) line of sight (SECONDHAND) | myNAVAC. measureQuick (compatibility reported Aug 2025, SECONDHAND) | No (none found) | None found | Unknown | UNVERIFIED | P2 |
| **JB Industries** | DM4-ZW ZEPPELIN and DM4-RW REVOLVER wireless manifolds (3 AA, A2L) | Bluetooth (SECONDHAND) | JB GO V2 (iOS, Android). measureQuick | No (none found) | None found | Unknown | UNVERIFIED | P3 |
| **Sauermann** | Si-TH4 wireless psychrometer (temp, RH, computed dry-bulb and wet-bulb). Si-RT7 clamp. Si-RP4 pressure. Si-RM3 manifold. SIHH3. KPA-320 logger | BLE, up to 100 m. "BLE 4.0 supported only with reduced range" (SECONDHAND, measureQuick page) | Sauermann Pilot (Si-TH4). Si-HVACR Measurement (SIHH3) | No (none found) | None found | Unknown. Pairs with manifold or app | UNVERIFIED | P2 (psychrometrics match our calculators) |
| **Imperial** (Stride Tool) | iManifold: 4 wired and up to 12 wireless probes. Guide copyright 2014 | Phone link: "standard Bluetooth and Bluetooth Low Energy" (SECONDHAND). Probes: Zigbee mesh (SECONDHAND) | iManifold. The manifold is its own UI | No (none found) | None found | Unknown | Phone link UNVERIFIED. Zigbee probes not reachable (INFERENCE) | P3 |
| **CPS Products** | BlackMax manifold (control to 300 ft). MD100W, MD100WVHE 4-valve wireless with clamp probes | Bluetooth (implied, UNVERIFIED) | CPS Link | No (none found) | None found | Unknown | UNVERIFIED | P3 |
| **Accutools** | BluVac+ Micro and BluVac+ Professional wireless vacuum gauges | Bluetooth (SECONDHAND) | Not confirmed. One eBay reviewer names an app "imanifold" (UNVERIFIED) | No | None found | Unknown | UNVERIFIED | P3 |
| **Appion** | PTC900 and PTCGKT1 compound gauges, Bluetooth interface, IP55, AA (listing). G5 not confirmed | Bluetooth (SECONDHAND) | Not identified | No (none found) | None found | Unknown | UNVERIFIED | P4 |
| **Inficon** (Wey-TEK) | WL and WL KIT refrigerant charging scales. FLUE-Mate printer link (not relevant) | Bluetooth, about 30 ft. BLE not stated (SECONDHAND) | Wey-TEK app (name not confirmed) | No | None found | Unknown | UNVERIFIED | P4 (a scale, not a probe) |
| **Bacharach** (MSA) | Legend refrigerant analyzer, model 7-08-1234-31-0. Combustion app for PCA 400 and Fyrite | Bluetooth (purpose of the link not stated) | Combustion app (2019, SECONDHAND) | No | None found | Unknown | UNVERIFIED | P4 (not a probe) |
| **Supco** | No Supco Bluetooth manifold found. TechLink app ties to a Redfish iDVM510 Bluetooth meter | Bluetooth via the meter (SECONDHAND) | Supco TechLink (App Store) | No | None found | Unknown | UNVERIFIED | P4 |
| **Hilmor** | None found | n/a | n/a | n/a | n/a | n/a | n/a | none found |
| **Klein Tools** | None found. One reviewer mentions a CL800, with nothing on Bluetooth | n/a | n/a | n/a | n/a | n/a | n/a | none found |

Extras seen in results (outside the brief, SECONDHAND): Extech EX845 with MeterLink (about 30 ft, Android app). Cole-Parmer Digi-Sense Bluetooth clamp meter with a free app. KPS 600 A clamp with KPS Link. Uniweld USMAN5 kit with SmarTech app (listed as discontinued).

---

## 3. Open-source decoders and public protocol documents (question 3)

All GitHub metadata below came from the GitHub API through the authenticated `gh` CLI (VERIFIED for metadata). Code reads are noted.

| Project | Brand or device | What it decodes (as stated) | Licence | Last activity | Status |
|---|---|---|---|---|---|
| `jwanga/fluke-connect-client` (https://github.com/jwanga/fluke-connect-client). Protocol note: `docs/PROTOCOL.md` | Fluke Connect family. Tested on ir3000 FC with Fluke 289 only. Others listed as "should work" | Advertising, GATT UUIDs, binary reading record (8 or 16 bytes), ASCII display (17 bytes), housekeeping (device info, battery, ID, name, locator LED, clock) | Apache-2.0 per GitHub. Repo ships LICENSE-APACHE and LICENSE-MIT | Created 2026-09-03. Last push 2026-09-06 (release v0.2.2). 0 stars. Appears to have one maintainer (INFERENCE from the commit log) | Best documented. Verified on one device pair. Read in part: header, advertising, UUID table, binary record, and a grep of the rest |
| `zach-edf/fluke-app` (https://github.com/zach-edf/fluke-app) | Fluke 376 FC (profile `fluke_376fc.py`). README: "Unofficial community desktop app, CLI, and Python SDK for BLE-enabled Fluke meters" | Profile-based decoder, BLE scan and stream, SQLite logging. Byte layout not read by me | MIT | Created 2026-03-28. Last push 2026-07-09 | Community SDK. README says it "still needs repeated real-hardware validation" |
| `bensmith83/adwatch` (https://github.com/bensmith83/adwatch), file `src/adwatch/plugins/fluke.py` | Fluke advertisement parser (passive) | Matches the service UUID regex `^b698[0-9a-f]{4}-7562-11e2-b50d-00163e46f8fe$` and a local-name prefix "Fluke". Takes the family code from the XXXX slot. Hashes the MAC | MIT | Created 2026-03-12. Last push 2026-10-24 | Advertisement-only identification. Its name rule would miss "IR 3000 FC" (VERIFIED from code). Its docstring cites an internal report on the Fluke Device app (not opened) |
| MutekH `libble` Fluke profile, C (https://github.com/AntoineMugnier/mutekh/tree/master/libble/profile/fluke). Files `central.c`, `client.c` | Fluke profile | Binary reading layout, recovered independently (per the Rust note) | None reported by GitHub. Treat as all rights reserved | Last push 2024-06-10 | Reference only. I did not read the C |
| `RatioLabs/BLEService` (https://github.com/RatioLabs/BLEService). Files `UUIDUtils.java`, `BTUUID.java` | Android BLE service. Contains the Fluke base UUID | UUID constants (from code search hits; not opened) | BSD-3-Clause | Created 2014-03-07. Last push 2014-03-24 | Dormant. UUID list only |
| `rctngl/geneva-tools` (https://github.com/rctngl/geneva-tools), file `tools/unofficial/3000FC.yaml` | 3000 FC definition, unofficial. The repo is "Tool definitions for the Rectangle Web App" | Not read by me. The Rust note cites a `3000FC.yaml` with the same UUIDs | MIT | Last push 2025-07-26 | Unread |
| `dwise03-bit/wise2-core` (https://github.com/dwise03-bit/wise2-core), file `apps/fieldtech-android/.../Fluke902FcAdapter.kt` | Fluke 902 FC Android adapter | Not read | **No licence** (all rights reserved by default) | Created 2026-07-07. Pushed 2026-10-24 | Do not reuse. Reference at most |
| sigrok and EEVblog thread on APPA and BENNING meters over BLE (https://eevblog.com/forum/testgear/sigrok-support-for-appa-150208506-benning-mm-12-cm-12-sefram-7352b-etc) | Multimeters (not HVAC probes) | Per the 2020 thread: live readings over USB, serial and BLE, in a developer fork named "appa-b" | Not checked | 2020 thread. Mainline status UNVERIFIED | Adjacent only |

**Not found in my GitHub repo-name searches:** repositories for Testo, Fieldpiece Job Link, UEi Hub, Yellow Jacket or ManTooth, NAVAC, Appion, Sauermann, JB, or "measurequick" (the "mantooth" hits are unrelated). Repo-name searches were: "fieldpiece", "joblink bluetooth", "testo smart probes", "fluke connect bluetooth", "mantooth", "navac bluetooth", "uei hub", "kane asia bluetooth", "measurequick", "appion bluetooth manifold", "sauermann bluetooth", "imanifold", "hvac bluetooth manifold", "hvac bluetooth probe", "refrigerant bluetooth gauge", "ir3000 fc", "fluke 3000fc", "fluke connect ble", "geneva-tools", "ratiolabs".

**Code search** (`gh search code`) was run only for the Fluke base UUID and the "7562-11e2-b50d" fragment, and for "3000FC.yaml". I did not code-search UEi, Testo, or Yellow Jacket strings.

**Not searched in this session:** Home Assistant integrations, ESPHome components, Wireshark dissectors, and the libsigrok device list.

---

## 4. Per-brand notes (question 1 and question 2)

### Fluke Connect (P1)

- **Radio.** BLE. The Rust note says the ir3000 FC's FCC filing (T68-IRFBLE) shows an MSP430F5659 host MCU driving an FBLE radio module, which it lists as a CC2540 (https://fccid.io/T68-FBLE/User-Manual/Module-Manual-2101604 is the developer guide the note cites). I did not open either FCC filing. CC2540 is a Texas Instruments BLE chip (general knowledge, INFERENCE).
- **Advertising** (VERIFIED in the Rust note, ir3000 FC). Local name is "IR 3000 FC" with spaces. Siblings are named "376FC", "902FC", "3000FC". The advertised service is `b6981800-7562-11e2-b50d-00163e46f8fe`. Advertising interval is about 10 s on macOS, so scans need tens of seconds. The ir3000 FC advertises only once its host meter answers over IR.
- **GATT** (VERIFIED in the Rust note, ir3000 FC). Base UUID `B698xxxx-7562-11E2-B50D-00163E46F8FE`. Reading service slot 1800. Binary reading characteristic 290F (`b698290f-...`), read and notify, 8 or 16 bytes. ASCII display 2901 (`b6982901-...`), 17 bytes: a format byte plus 16 ASCII bytes. The 2901 characteristic is populated on 376 FC and 902 FC per public captures (documented, not verified by the author on those devices). Housekeeping: ID 2902, name 2903, force-drop 2904, locator LED 2905, clock 290E (writes rejected on ir3000 FC), host firmware-update 2911 and TI OAD service 1804. The crate leaves the firmware-update characteristics alone on purpose.
- **Binary record** (VERIFIED in the Rust note, ir3000 FC). Each 8-byte record is two little-endian 32-bit words. Word 0 carries a 21-bit mantissa (0x1FFFFF means no value), the display state, and the decimal-place count. I did not transcribe the full bit table. Read `docs/PROTOCOL.md` in the repo for it.
- **Pairing.** "No pairing or bonding is required. ATT MTU is 23 (20-byte payloads)" (VERIFIED in the Rust note, ir3000 FC).
- **Coverage caveat.** Only ir3000 FC plus Fluke 289 was tested. The 3000 FC, 902 FC and 376 FC are unconfirmed in the Rust note, and the 376 FC profile in `zach-edf/fluke-app` is a separate implementation. The Rust note's own statement is "the crate should work with" the family.
- **Web Bluetooth caveat.** The Fluke "slot" numbers (1800, 2902, 1804) look like SIG numbers, but they sit under Fluke's vendor base. Chromium's blocklist matches full 128-bit UUIDs, so these do not collide with the blocklisted SIG entries (INFERENCE, section 6).
- **Name matching caveat.** Names vary across the family ("IR 3000 FC" versus "3000FC"). The adwatch plugin's `^Fluke` rule would miss the ir3000 FC. Match on the service UUID regex (VERIFIED from code).
- **No Fluke Connect API.** The only Fluke "partner program" in results is MET/CONNECT, a separate calibration-software API (SECONDHAND, https://my.fluke.com/en-US/article/KA-03873, not opened).

### UEi (P1, owner's kit)

- Lineup, app and radio unknowns: see `uei-bluetooth.md`. Not repeated here.
- **FCC lookup this session.** A search for the WPP1 FCC ID returned product pages and the HUB manual, but no grant. The WPP1 spec table lists CE, FCC and IC approvals (SECONDHAND, https://xrefs3.plumbersstock.com/product/9/3/930279_fOeXAJ.pdf). Those are category listings, not the FCC ID.
- **Manual.** The UEi HUB manual (https://res.cloudinary.com/iwh/image/upload/q_auto,g_center/assets/1/26/UEI_HUB_Manual.pdf) returned binary to my fetch tool. I could not read the radio section. The earlier note's RSS-247 reference is therefore still unchecked.
- **DL599 clamp meter.** Retailer and measureQuick pages say "Bluetooth wireless (free app)" (SECONDHAND, https://measurequick.com/smart-tools/uei/electrical-meters/uei-dl599/). BLE vs classic is not stated. This is the decision point for the transport layer.
- **SDK, API, decoder.** None found. Repo-name searches for "uei hub" and "kane asia bluetooth" returned nothing.

### Testo (P2)

- **Products.** Smart Probes 115i, 549i, 605i, 805i, 510i; 552i vacuum probe (per listing). Manifolds: 550i (two-valve, testo Smart App), 557s (SECONDHAND: "Bluetooth 5.0" to the testo Smart App and measureQuick), 570s (up to six probes at once; the Smart Probes app is free on both stores). Scale 560i (30 m, or 150 m with a Testo manifold; SECONDHAND).
- **Radio.** The 115i Italian datasheet states Bluetooth 4.0 and 100 m (SECONDHAND, https://www.infobuildenergia.it/wp-content/uploads/2021/03/testo-115i-Datasheet-IT.pdf). A US kit listing says up to 350 ft for 115i, 549i and 605i (SECONDHAND, https://www.testequipmentdepot.com/testo-0563-0007-smart-probes-hvacr-complete-kit.html). A TestEquity refrigeration overview credits the newer manifolds with Bluetooth 5.0 (SECONDHAND, https://assets.testequity.com/te1/Documents/pdf/testo/Testo_Refrigeration_Overview_0624.pdf).
- **Note.** The measureQuick page says the 557s has been replaced by the 558s, and existing owners still get support (SECONDHAND).
- **No GATT map, no SDK, no repo.**

### Fieldpiece (P2)

- **Probes.** JL3PC copper pipe clamp, −46 to 125 °C, ±0.6 °C (measureQuick, SECONDHAND, https://measurequick.com/smart-tools/fieldpiece/joblink/jl3pc/). JL3PR pressure probe with auto-calibration and high and low side readings for live superheat and subcooling (SECONDHAND, https://measurequick.com/smart-tools/fieldpiece/joblink/jl3pr/).
- **Radio.** BLE: the JL3PR quick start says "BLE 4.0 devices running iOS 7.0 or Android 5.0" (VERIFIED, primary; see the lead's follow-up in section 1). measureQuick's support copy says the same (SECONDHAND). Range is 350 ft per the JL3PR v24 manual (SECONDHAND, from the earlier file and a search summary), and "1,000 ft" per a 2021 press claim (SECONDHAND, earlier file). The manual's battery count conflicts with a measureQuick page (two AAA in the manual, about 150 h on one AAA per measureQuick). I could not read the manual to settle it.
- **Manifolds.** SMAN4 wireless (wet-bulb and dry-bulb for target superheat; six readings to the HG3 analyzer). SM380V and SM480V (Job Link, 350 ft). SM482V (2025 buying guide). All SECONDHAND from search summaries.
- **App.** Job Link runs firmware and probe setup. measureQuick reads the probes directly (SECONDHAND).
- **No SDK, no open decoder.**

### Yellow Jacket / Ritchie (P2)

- **ManTooth.** Wireless P/T gauge kit for automotive A/C, with two wired clamps and R-134a and R-1234yf hoses. App on Android and iOS (SECONDHAND, Vehicle Service Pros and Yellow Jacket pages).
- **P51 (Titan).** Bluetooth to the ManTooth app (ACHR News, around 2019; SECONDHAND). Quick-start guide, 2018: https://yellowjacket.com/wp-content/uploads/2018/01/P51-ManTooth-Quick-Start-Guide.pdf (search hit, not opened).
- **TITANMAX.** Bluetooth to YJACK VIEW or measureQuick, with on-board logging (ACHR News product listing, SECONDHAND, https://www.achrnews.com/articles/154237-ritchie-engineering-co-yellow-jacket-digital-manifold).
- **Radio.** Unstated in any source I read. An aggregator's app page reports a 3.2 out of 5 rating from 141 reviews, with recurring Bluetooth connection failures (UNVERIFIED, https://marlvel.ai/apps/mantooth).

### NAVAC (P2)

- **Products.** NEXUS 2: NX1, NX1G, NX1GV (2-valve), NX4G, NX4GV (4-valve), A2L, Bluetooth, with the myNAVAC app. NMV1S micron gauge (SECONDHAND, retailer listings such as https://www.keepsupply.com/nx4g-navac-nexustm-2-digital-manifold-gauge-4-valve-bluetooth-a2l-mynavactm-app).
- **Range.** Up to 80 m (260 ft) line of sight for the NX4G (SECONDHAND, same listing). Phones need Android 7.0 or iOS 12.0 or later (SECONDHAND).
- **Refrigerants.** 100 via firmware updates (SECONDHAND).
- **measureQuick.** Compatibility reported August 2025 (SECONDHAND, https://refindustry.com/news/market-news/navac-manifold-gauges-and-probes-now-compatible-with-measurequick-app).
- **No NAVAC primary page, SDK or repo found.**

### JB Industries (P3)

- **Products.** DM4-ZW ZEPPELIN (forged aluminium piston valve) and DM4-RW REVOLVER (forged brass ball valve). Both wireless, Bluetooth, three AA, A2L-compatible, 60+ refrigerants (SECONDHAND, https://measurequick.com/smart-tools/jb/manifolds/dm4-zw/ and a TruTech datasheet, https://trutechtools.com/content/brands/jb/documents/jb-dm4-rw-datasheet.pdf).
- **App.** JB GO V2 (iOS, Android) and measureQuick. Gauges also work standalone.
- **No SDK, no repo.**

### Sauermann (P2)

- **Si-TH4** (SECONDHAND, https://measurequick.com/smart-tools/sauermann/probes/si-th4/). Temperature −20 to 60 °C. RH 0 to 100 %, rated ±2 % RH between 15 and 25 °C over 10 to 90 %. Computed dry-bulb and wet-bulb. BLE link up to 100 m. Pairs with a Si-RM350 or Si-RM450 manifold or the Sauermann Pilot app. Phones need Android 11 or iOS 15. BLE 4.0 works only at reduced range. About 50 h on three AAA alkaline cells.
- **Conflict.** An HVACInsider article cites up to 30 m for Sauermann's smart wireless probes (SECONDHAND). The models may differ.
- **Others.** Si-RT7 wireless clamp, Si-RP4 wireless pressure, Si-RM3 manifold, SIHH3 (15 m to the Si-HVACR Measurement app), KPA-320 Bluetooth logger (SECONDHAND).
- **Fit.** Psychrometric outputs match our calculators.
- **No SDK, no repo.**

### Imperial / Stride Tool (P3)

- **iManifold.** Four wired and up to 12 wireless probes. Probes talk over a Zigbee mesh. Only Imperial's own probes are recognized. The phone link is "standard Bluetooth and Bluetooth Low Energy" (SECONDHAND, https://www.contractingbusiness.com/residential-hvac/article/20867648/imperial-introduces-new-ios-android-compatible-manifold). Six AA cells. Two-year warranty (SECONDHAND, https://trutechtools.com/iManifold).
- **Implication.** A phone talking to the iManifold sees one device, and probe readings arrive through it. Our decoder would be a gateway decoder. Zigbee probes are not reachable directly (INFERENCE).
- **Age.** The quick-start guide copyright notice reads 2014 (SECONDHAND). Current availability is unconfirmed.

### CPS Products (P3)

- **BlackMax.** Manifold with a companion app, CPS Link, controllable from up to 300 ft. Also works as a standard manifold (SECONDHAND, https://tequipment.net/CPS/MD100WVHE/HVAC-Manifolds).
- **MD100W and MD100WVHE.** Four-valve wireless digital manifold with clamp probes, plus a vacuum gauge (SECONDHAND, https://www.tequipment.net/CPS/MD100W/Digital-Manifolds/).
- **Radio** not stated in any source. No SDK, no repo.

### Accutools (P3)

- **BluVac+ Micro and BluVac+ Professional.** Bluetooth wireless vacuum gauges. Both are on measureQuick's compatible-tool list (SECONDHAND, https://www.tequipment.net/accutools/hvac-equipment-and-instruments/ and https://measurequick.com/tools/).
- **App.** One eBay reviewer says the Professional pairs with an app called "imanifold". Not confirmed as Accutools' app (UNVERIFIED).

### Appion (P4)

- **PTC900 and PTCGKT1.** Pressure and temperature compound gauges with a Bluetooth interface, IP55, AA cells (SECONDHAND, https://www.tequipment.net/Appion/hvac-equipment-and-instruments/hvac-manifolds-and-gauges/digital-manifolds/). No app named. No source for the G5 features.

### Inficon / Wey-TEK (P4, a scale, not a probe)

- **WL (719-202-G1) and WL KIT (719-203-G1).** Refrigerant charging scale with a free app. Bluetooth about 30 ft. The WL KIT adds a wireless handpiece (SECONDHAND, https://www.tequipment.net/Inficon/719-202-G1/Charging-Scale). BLE not stated.
- **No Inficon wireless manifold** appeared in any search.

### Bacharach / MSA (P4, not a probe)

- **Legend refrigerant analyzer, model 7-08-1234-31-0.** Bluetooth. The reseller listing does not say what the link is for (SECONDHAND, https://www.globaltestsupply.com/product/bacharach-7-08-1234-31-0-refrigerant-analyzer-legend).
- **Combustion app** for the PCA 400 and Fyrite (trade coverage dated September 2019, SECONDHAND). Not a probe.

### Supco (P4)

- **No Supco Bluetooth manifold found.** The Supco TechLink app (App Store, https://apps.apple.com/us/app/supco-techlink/id1362403522) is tied to a Redfish iDVM510 Bluetooth meter, about 30 m. The listing credits measureQuick as developer (SECONDHAND).

### Hilmor and Klein (none found)

- No Bluetooth digital manifold or wireless clamp for Hilmor or Klein appeared in any search. Read this as "none found", not "none exists".

### measureQuick (aggregator, not a brand)

- **Claims.** "80+ tools across 17+ brands." Premier tier $49 per user per month (SECONDHAND, measureQuick pages, e.g. https://measurequick.com/smart-tools/jb/manifolds/dm4-zw/).
- **Coverage named in sources.** UEi HUB and DL599 (earlier file). Fieldpiece JL3 probes. Testo 557s and 550i. NAVAC NEXUS (since Aug 2025). JB DM4. Sauermann Si-TH4. Yellow Jacket TITANMAX.
- **Its Bluetooth probe reference page returned 404 again** (my fetch: https://support.measurequick.com/portal/en/kb/articles/all-bluetooth-probes-reference).
- **Use.** Its app is proprietary. Do not reverse engineer it (ground rules). Its existence suggests the probes are readable by third-party apps (INFERENCE, not a legal conclusion).

---

## 5. Encryption and pairing (question 4)

- **Verified plain link:** Fluke Connect ir3000 FC. "No pairing or bonding is required." Plain notifications on the vendor characteristics (VERIFIED in the Rust note).
- **Unknown, with signals only:** Testo (a retailer copy says probes "pair automatically"). Fieldpiece (a measureQuick KB article titled "Fieldpiece Probe Pairing"). Sauermann (pairs with a manifold or the app). Yellow Jacket, NAVAC and JB (no security information in any source).
- **Rule for our app (INFERENCE from the ground rules):** If a capture shows an SMP pairing exchange that ends in an encrypted or bonded link on the data characteristics, mark the brand "unsupported: bonded" and stop. Do not try to recover keys or spoof a bond. A "Just Works" pairing that stores a bond still counts as bonded.

---

## 6. Web Bluetooth constraints (question 5)

**Blocklist** (VERIFIED: `WebBluetoothCG/registries` file `gatt_blocklist.txt`, the upstream list that the Chromium source imports; https://github.com/WebBluetoothCG/registries):
- Services: `00001812-0000-1000-8000-00805f9b34fb` (HID, keyboard risk). `00001530-1212-efde-1523-785feabcd123` (Nordic legacy DFU). `f000ffc0-0451-4000-b000-000000000000` (TI OAD). `00060000-0000-1000-8000-00805f9b34fb` (Cypress bootloader). `0000fffd-`, `0000fff9-`, `0000fde2-` (FIDO and Google pairingless FIDO).
- Characteristics: `00002a02` (writes excluded), `00002a03`, `00002a25` (serial number string, blocked for privacy).
- Descriptors: `00002902` (client characteristic configuration, writes excluded), `00002903` (writes excluded).

**What this means for our brands** (INFERENCE from the list):
- Fluke's vendor UUIDs sit under the Fluke base. The Fluke TI OAD service is `b6981804-...`, not `f000ffc0-...`. None of the Fluke UUIDs in the Rust note is on the blocklist.
- Do not depend on the serial-number string (2A25). Chrome blocks page reads of it.
- Subscribing to notifications should still work. The CCCD write is done by the browser, but the blocklist marks direct descriptor writes as excluded. Test it.
- No GATT map is public for UEi, Testo, Fieldpiece and the others. Their blocklist status is unknown until we map them.

**Service declaration.** Web Bluetooth reaches only the services a page lists in `filters` or `optionalServices`. Each decoder must declare its services up front, and the app requests the union when the user picks a device (INFERENCE on exact error behaviour; test).

**Advertisement-only data.** Web Bluetooth gives no general scan stream. `requestDevice` filters on service, name prefix or manufacturer data can pick a device, but the page does not get the advertisement stream. Whether current Chrome supports the `manufacturerData` filter, and whether `watchAdvertisements` is available, is UNVERIFIED. Plan as if neither works.

**Classic Bluetooth (SPP or RFCOMM).** Out of reach for Web Bluetooth. bleak is BLE-only too. The Chrome Bluetooth doc in the earlier file says the API needs BLE 4.0 or later. Any classic-only device needs a different transport: on Linux, BlueZ RFCOMM; on Android, a native app.

**Platform matrix:**
- Chrome for Android: Web Bluetooth announced in Chrome 56 (SECONDHAND, https://developer.chrome.com/blog/new-in-chrome-56?hl=vi). Current flag state UNVERIFIED. Test on the field phone.
- Chrome on Linux: needs an experimental flag (earlier file, UNVERIFIED now).
- Safari (iOS and macOS): no Web Bluetooth. WebKit's standards-positions issue #570, "Web Bluetooth", carries the label "position: oppose" and is closed (VERIFIED from the labels, closed 2025-12-02, https://github.com/WebKit/standards-positions/issues/570).
- Mozilla: its position, as quoted secondhand in an Espruino forum post, treats user consent as inadequate (SECONDHAND, UNVERIFIED).
- iOS via Bluefy: third-party browser, "Bluefy – Web BLE Browser" on the App Store (SECONDHAND, https://apps.apple.com/app/id1492822055). Its German listing reports iOS 12.0 or later. Current requirement UNVERIFIED.

**Fluke advertising interval.** About 10 s between advertisements (VERIFIED in the Rust note, macOS). The browser device picker may take a while to show the device. Test the pick-and-connect time.

---

## 7. Priority and market evidence (question 6)

- **No usage data found.** No survey ranks which brands US commercial or residential techs use. The ACHR News 2019 digital-manifold guide polled customers on features, not market share (SECONDHAND, https://www.achrnews.com/articles/142347-a-guide-to-digital-manifolds-and-smart-devices-for-refrigeration-technicians).
- **Retailer commentary.** A retailer's brand selector says the service-truck market is converging on Fieldpiece, Testo, Fluke and Yellow Jacket, and it names Fieldpiece as the leader in residential and small-commercial work. No survey data sits behind those labels (SECONDHAND, https://www.portlandiaelectric.supply/blogs/news/hvac-service-tools-brand-selector).
- **Contractor.** I found no evidence of which tools the US Antarctic Program's contractor issues. The earlier file `tool-travel.md` in the same project says the same. Ask Amentum or the Antarctic Support Contract directly before packing. Scope for the utility mechanic role covers hydronic heat, refrigeration and HVAC (from `prior-art.md`).

**Priority reasoning:**
- **P1.** UEi (owner's hardware, hands-on session) and Fluke (open protocol and two decoders).
- **P2.** Testo, Fieldpiece, Yellow Jacket, NAVAC (common in the trade press, with Bluetooth products). Sauermann (documented BLE radio, and psychrometric outputs that fit the calculators).
- **P3.** JB, Imperial, CPS, Accutools (lower trade presence, or hub-based designs).
- **P4.** Scales, analysers and non-probe tools: Inficon, Bacharach, Supco, Appion.

---

## 8. Legal frame (question 7)

**Statute text.** 17 U.S.C. §1201(a)(1)(A) (VERIFIED, quoted from Cornell LII, https://www.law.cornell.edu/uscode/text/17/1201): "No person shall circumvent a technological measure that effectively controls access to a work protected under this title."

**Interoperability exception, §1201(f)** (VERIFIED in summary with short exact quotes from the same page):
- (f)(1): a person who has lawfully obtained the right to use a copy of a program may circumvent an access control on the program's elements "for the sole purpose of identifying and analyzing those elements of the program", needed for interoperability with an independently created program. The elements must not have been readily available before, and the analysis must not infringe.
- (f)(2): developing and using the means is allowed "if such means are necessary to achieve such interoperability", provided it does not infringe.
- (f)(3): sharing the information or means is allowed "solely for the purpose of enabling interoperability", and not in ways that infringe or violate other law.
- (f)(4): interoperability means "the ability of computer programs to exchange information", and the programs' mutual use of what was exchanged.

**Copyright Office repair exemptions** (37 CFR 201.40(b), SECONDHAND: summary of the LII page, https://www.law.cornell.edu/cfr/text/37/201.40). Four paragraphs apply to lawfully acquired devices. (b)(13) covers powered land vehicles and watercraft. (b)(15) covers consumer devices. (b)(16) covers food-preparation equipment for retail-level commercial use. (b)(17) covers medical equipment. None names HVAC, general industrial or general commercial equipment. Paragraph numbers have shifted between rulemakings (an FDA letter and 2027-cycle comments use other numbers), so check the current eCFR before relying on any number. The 2024 FDA letter: https://copyright.gov/1201/2024/USCO-letters/2024-DMCA-Copyright-Engagement-Cover-Note-6-21-2024-Final.pdf (search hit).

**Practical reading** (INFERENCE, not legal advice). An unencrypted, unauthenticated notification stream may involve no access control at all, which would take the link outside §1201(a) entirely. If a link is bonded or encrypted, decrypting it is the access-control question, and our ground rules rule that out anyway. The bigger exposure is contract: a vendor app's terms of use can restrict reverse engineering whatever copyright says. I did not read the UEi Hub or Fluke Connect terms (UNVERIFIED). Background from memory, UNVERIFIED in this session: Chamberlain v. Skylink (Fed. Cir. 2004) requires a nexus to infringement for a §1201 claim, and MDY v. Blizzard (9th Cir. 2010) declined to follow that rule. The two circuits differ, which matters if a case is ever filed.

---

## 9. Short list (question-level deliverable)

**A. Likely supportable without owning the hardware** (public document or permissive open decoder exists):
- **Fluke Connect family.** The ir3000 FC profile is documented and verified on one device pair. The 376 FC has an MIT community SDK. The 902 FC and 3000 FC need one capture each (or a community fixture) before we ship them. The Rust crate's byte-fixture tests (Apache-2.0) could seed offline tests, with attribution. Not checked yet.
- No other brand in this set has a public GATT or protocol document that I could find. This list has one entry.

**B. Need a device in hand to capture:** UEi (all probes and the DL599), Testo (all), Fieldpiece Job Link, Yellow Jacket (ManTooth and TITANMAX), NAVAC NEXUS, JB DM4, Sauermann Si-TH4 (radio documented in datasheet, GATT not), CPS, Accutools, Appion, Inficon Wey-TEK.

**C. Not reachable with our transports on current evidence:**
- Classic-only devices (none confirmed; the DL599 is the one to test first).
- Bonded or encrypted devices (none confirmed).
- Zigbee probes behind a manifold (Imperial). Reachable only through the iManifold, if it exposes readings over BLE. UNVERIFIED.

---

## 10. Recommended driver architecture

- **Transports, one interface, two implementations.** `WebBluetoothTransport` (Chrome Android; Bluefy on iOS) and `BleakTransport` (Linux laptop). Both expose: scan or request, connect, service and characteristic lookup, subscribe, read, write (only where a decoder declares it), and disconnect. Both also write the capture format in section 11.
- **Decoders are pure functions.** `decode(characteristicUUID, bytes, state) -> Reading[]`, with no I/O. Keep byte fixtures per decoder, taken from real captures. The Rust crate does the same (its DESIGN.md: "Pure functions over byte slices"), so the pattern is documented prior art.
- **Matching order.** (1) Service UUID, or a UUID regex for a vendor base (`b698xxxx-...` for Fluke). (2) Manufacturer company ID with a payload prefix. (3) Local-name prefix, last resort, because names vary ("IR 3000 FC", "3000FC").
- **Declared services.** Each decoder lists `optionalServices` and its subscriptions. The app requests the union of the services the user's chosen device needs. This is a hard browser constraint.
- **Gateways.** A device may expose several channels (a manifold plus probes). Readings are keyed by device, channel and quantity. Zigbee-only probes never appear as BLE devices.
- **Normalised output only.** Calculators see `{t, deviceId, channel, quantity, value, unit, state, decoderId, decoderVersion}`. Superheat, subcooling, saturation and psychrometrics run on this output only. For saturation, use CoolProp (from `prior-art.md`).
- **Explicit unsupported states.** `bonded`, `classic`, `unknown-brand`, `unsupported-firmware`. Each one routes to a manual-entry path. Never fail silently.
- **Version pinning.** Record device firmware and app versions in the capture header. Each decoder declares the versions it has been verified on.
- **Licence hygiene.** Write our own decoders from public facts and our own captures, and cite the sources. If we port Apache-2.0 or MIT code, keep its notices (general knowledge). Do not decompile vendor apps. The Fluke Connect APK is not needed.
- **Replay tests in CI.** Every fixture runs against its decoder offline. No hardware needed.

**Illustrative decoder manifest** (values from the Rust note, untested on 902 FC or 3000 FC; not yet verified by us):

```json
{
  "id": "fluke-fbl-binary-v1",
  "brand": "Fluke",
  "match": { "serviceUuidRegex": "^b698[0-9a-f]{4}-7562-11e2-b50d-00163e46f8fe$" },
  "optionalServices": ["b6981800-7562-11e2-b50d-00163e46f8fe"],
  "subscribe": ["b698290f-7562-11e2-b50d-00163e46f8fe", "b6982901-7562-11e2-b50d-00163e46f8fe"],
  "status": "documented by third party; verified on ir3000 FC only",
  "source": "github.com/jwanga/fluke-connect-client, docs/PROTOCOL.md"
}
```

---

## 11. Capture and replay format

- **File.** JSON Lines. One header line, then one event per line. Path pattern: `fixtures/<brand>/<model>/<YYYYMMDD>-<seq>.jsonl`.
- **Event types.** `adv` (advertisement), `connect`, `gatt` (service and characteristic with properties), `notify`, `read`, `write` (with the app action that caused it), `disconnect`, and `truth` (a reference reading with its source).
- **Redaction.** MACs and serials are salted hashes. No owner name, location or network identifiers.
- **Timing.** `t` is seconds from session start, from a monotonic clock. Record platform and browser versions in the header.
- **Replay.** Feed `notify` and `read` events to the decoder in order. Compare the output with `truth` events within tolerance (illustrative: pressure ±1 psi or ±0.5 %, temperature ±0.5 °F, RH ±2 %). Fail a decoder that throws on truncated or bit-flipped frames.
- **Sources of captures.** The browser prototype with a logging transport, and an Android HCI snoop log converted into the same format. bleak writes the same format on Linux.

Illustrative lines (not from a real device):

```
{"fmt":"fdx-capture/0.1","device":{"brand":"UEi","model":"WPP1","serial_hash":"<salted>"},"host":{"platform":"Android 14","app":"UEi Hub <version>"},"started":"<ISO time>"}
{"t":0.000,"ev":"adv","name":"<as advertised>","svc":["<uuid>"],"mfr":{"<company_id_hex>":"<payload_hex>"},"rssi":-61}
{"t":2.015,"ev":"notify","chr":"<uuid>","hex":"<bytes>"}
{"t":2.800,"ev":"write","chr":"<uuid>","hex":"<bytes>","origin":"app: set units to kPa"}
{"t":40.0,"ev":"truth","quantity":"pressure","value":100,"unit":"psi","source":"reference gauge <id>"}
```

---

## 12. What the UEi hands-on session should capture

Owner's own devices only. Do not write to firmware-update characteristics. Do not attempt key recovery or bonding of any kind.

1. **Environment.** Phone model and OS. Chrome or Bluefy version. UEi Hub app version. Probe firmware and battery state, if the app shows them. Room temperature.
2. **Advertising, per device** (WPP1, WPC2, WHP1, WOT2, WVG2, DL599, HUB base if present). Advertised name, service UUIDs, manufacturer data with company ID, advertising interval, connectable flag, TX power if present, and RSSI at 1 m and 10 m. Use nRF Connect on Android for the scanner tab.
3. **GATT map after connect.** Every service and characteristic with properties (read, write, notify, indicate). Note SIG versus vendor base. Check each against the blocklist in section 6.
4. **Pairing and security.** Capture the first connection with HCI snoop enabled. Look for SMP pairing, the IO capability, the encryption-enabled event, and any bond stored. If encryption is requested, stop. Record only that it is encrypted.
5. **Single-central test.** With the UEi Hub app connected, try a second central (nRF Connect on a second device). Record whether the probe accepts it. Then reverse the test. Record disconnect behaviour.
6. **Background behaviour.** Does the stream continue when the app is backgrounded? Does the device stop if nothing polls it? Record which characteristics need a host write to start streaming.
7. **Steady-state streams.** For each readable characteristic, subscribe and record about two minutes at steady state, with timestamps.
8. **Deliberate changes, with truth.** Use a calibrated reference on the same port or a tee, and a reference thermometer or hygrometer, and video the reference and the phone screen together so times line up.
   - Pressure (WPP1): zero to atmosphere, then several known pressures across the range the owner can safely produce.
   - Vacuum (WVG2): a deep-vacuum reference and ambient.
   - Temperature (WPC2 clamp, WOT2): ice bath (32 °F), room temperature, warm water.
   - RH (WHP1): a saturated-salt reference if available, or the owner's reference hygrometer.
9. **Units.** Toggle °F and °C, and psi and kPa, in the app. Note whether the probe sends units or the app sets them. Capture any writes the app makes, with the UI action that caused them.
10. **App-computed values.** Record superheat and subcooling for two refrigerants (for example R-410A and R-454B, if the app offers them), so our calculators can be checked against UEi's numbers.
11. **Range.** Distances of about 10, 50 and 150 ft, line of sight and through one wall. Record RSSI and drop rate. This tests the "150 ft" and "350 ft" claims (which conflict).
12. **Both platforms.** Repeat the core steps on the owner's iPhone 14: the UEi Hub app, and Bluefy if a Web Bluetooth prototype is under test.
13. **Storage.** Keep raw captures on disk inside the repo (not in `/tmp`). Redact serials and MACs before anything is committed.

---

## 13. Open questions

1. UEi radio: very likely BLE GATT (lead's follow-up, section 1: RSS-247 plus an iPhone app with no MFi). Confirm with `tools/ble_scan.py` on probe day; an FCC grant lookup by grantee ("UEi Test Instruments", "Kane Asia") is the desk alternative.
2. UEi pairing and encryption status (section 12, step 4).
3. Does the DL599 use BLE or classic Bluetooth? This decides the transport.
4. Does any UEi device accept more than one central?
5. ~~Fieldpiece JL3PR manual: radio section, battery count, and range.~~ Answered by the lead's follow-up (section 1): BLE 4.0, 2 × AAA, 150 h, 1000 ft line of sight. Both manuals are kept in `research/.dl/probe-manuals/` (gitignored) with their text extracts.
6. Testo "Bluetooth 5.0" for the 557s and 570s: check Testo's own spec sheets.
7. Fluke 902 FC and 3000 FC: does the ir3000 FC profile hold? Needs captures or community fixtures.
8. Fluke's 2013 radio-module developer guide (FCC T68-FBLE): open it, read its licence terms, and check whether it documents the GATT profile.
9. Yellow Jacket and NAVAC radio type, and whether either uses a proprietary profile.
10. Chrome Android current Web Bluetooth status, and the Chrome Linux flag state. Test on the owner's phone.
11. Does `manufacturerData` filtering or `watchAdvertisements` work in current Chrome?
12. Mozilla's Web Bluetooth position (primary source needed).
13. Contractor tool issue: ask Amentum or the Antarctic Support Contract.
14. Legal: confirm §1201 paragraph numbers on the current eCFR. Read the UEi Hub and Fluke Connect terms. This is not legal advice.
15. Not searched: Home Assistant, ESPHome, Wireshark dissectors, and the libsigrok device list. Not read in full: `zach-edf/fluke-app`'s profile file and docs.

---

## 14. Sources

Read or checked at primary level:
- `jwanga/fluke-connect-client`, `docs/PROTOCOL.md` and `README` (via GitHub API, VERIFIED): https://github.com/jwanga/fluke-connect-client
- `zach-edf/fluke-app` README and profile list (via GitHub API, VERIFIED): https://github.com/zach-edf/fluke-app
- `bensmith83/adwatch`, `src/adwatch/plugins/fluke.py` (via GitHub API, VERIFIED): https://github.com/bensmith83/adwatch
- WebBluetoothCG registries, `gatt_blocklist.txt` (via GitHub API, VERIFIED): https://github.com/WebBluetoothCG/registries
- WebKit standards-positions issue #570 (labels and dates, VERIFIED): https://github.com/WebKit/standards-positions/issues/570
- 17 U.S.C. §1201 (Cornell LII, partially read, VERIFIED in part): https://www.law.cornell.edu/uscode/text/17/1201
- 37 CFR 201.40 (Cornell LII, summary, SECONDHAND): https://www.law.cornell.edu/cfr/text/37/201.40
- GitHub metadata for RatioLabs/BLEService, rctngl/geneva-tools, dwise03-bit/wise2-core, AntoineMugnier/mutekh (VERIFIED metadata only)

Cited or read as search or retailer copy (SECONDHAND):
- measureQuick: Fieldpiece JL3PC https://measurequick.com/smart-tools/fieldpiece/joblink/jl3pc/ ; JL3PR https://measurequick.com/smart-tools/fieldpiece/joblink/jl3pr/ ; JB DM4-ZW https://measurequick.com/smart-tools/jb/manifolds/dm4-zw/ ; Sauermann Si-TH4 https://measurequick.com/smart-tools/sauermann/probes/si-th4/ ; UEi DL599 https://measurequick.com/smart-tools/uei/electrical-meters/uei-dl599/ ; Bluetooth reference (404) https://support.measurequick.com/portal/en/kb/articles/all-bluetooth-probes-reference ; tools page https://measurequick.com/tools/
- Testo: 115i Italian datasheet https://www.infobuildenergia.it/wp-content/uploads/2021/03/testo-115i-Datasheet-IT.pdf ; kit listing https://www.testequipmentdepot.com/testo-0563-0007-smart-probes-hvacr-complete-kit.html ; refrigeration overview https://assets.testequity.com/te1/Documents/pdf/testo/Testo_Refrigeration_Overview_0624.pdf
- Yellow Jacket: ACHR News TITANMAX listing https://www.achrnews.com/articles/154237-ritchie-engineering-co-yellow-jacket-digital-manifold ; P51 quick start 2018 https://yellowjacket.com/wp-content/uploads/2018/01/P51-ManTooth-Quick-Start-Guide.pdf ; ManTooth aggregator (UNVERIFIED) https://marlvel.ai/apps/mantooth
- NAVAC: KeepSupply NX4G https://www.keepsupply.com/nx4g-navac-nexustm-2-digital-manifold-gauge-4-valve-bluetooth-a2l-mynavactm-app ; refindustry news https://refindustry.com/news/market-news/navac-manifold-gauges-and-probes-now-compatible-with-measurequick-app
- Imperial: Contracting Business https://www.contractingbusiness.com/residential-hvac/article/20867648/imperial-introduces-new-ios-android-compatible-manifold ; TruTech iManifold https://trutechtools.com/iManifold
- CPS: Tequipment https://tequipment.net/CPS/MD100WVHE/HVAC-Manifolds ; https://www.tequipment.net/CPS/MD100W/Digital-Manifolds/
- Appion: https://www.tequipment.net/Appion/hvac-equipment-and-instruments/hvac-manifolds-and-gauges/digital-manifolds/
- Inficon Wey-TEK: https://www.tequipment.net/Inficon/719-202-G1/Charging-Scale
- Bacharach: https://www.globaltestsupply.com/product/bacharach-7-08-1234-31-0-refrigerant-analyzer-legend
- Accutools: https://www.tequipment.net/accutools/hvac-equipment-and-instruments/
- Supco TechLink: https://apps.apple.com/us/app/supco-techlink/id1362403522
- UEi Hub App Store (earlier file): https://apps.apple.com/app/id1358221837
- UEi HUB manual (binary, unread): https://res.cloudinary.com/iwh/image/upload/q_auto,g_center/assets/1/26/UEI_HUB_Manual.pdf
- WPP1 regulatory listing (category, not FCC ID): https://xrefs3.plumbersstock.com/product/9/3/930279_fOeXAJ.pdf
- Fluke MET/CONNECT (separate product): https://my.fluke.com/en-US/article/KA-03873
- Fluke radio-module developer guide, cited (not opened): https://fccid.io/T68-FBLE/User-Manual/Module-Manual-2101604
- Web Bluetooth in Chrome 56: https://developer.chrome.com/blog/new-in-chrome-56?hl=vi
- Bluefy on the App Store: https://apps.apple.com/app/id1492822055
- Mozilla position (secondhand, Espruino forum): https://forum.espruino.com/comments/16781035
- Copyright Office FDA letter (2024): https://copyright.gov/1201/2024/USCO-letters/2024-DMCA-Copyright-Engagement-Cover-Note-6-21-2024-Final.pdf
- Sigrok/APPA thread (2020): https://eevblog.com/forum/testgear/sigrok-support-for-appa-150208506-benning-mm-12-cm-12-sefram-7352b-etc
- Trade and retail market commentary: https://www.achrnews.com/articles/142347-a-guide-to-digital-manifolds-and-smart-devices-for-refrigeration-technicians ; https://www.portlandiaelectric.supply/blogs/news/hvac-service-tools-brand-selector
- Extras: Extech MeterLink https://eepower.com/new-industry-products/extech-introduces-meterlink-industrial-android-app-for-remote-clamp-meter-readings/ ; Digi-Sense https://b2b-us.vwr.com/store/product/28122107/null

---

## 15. Method and limits

- **Tools.** Web search (standard mode, about 30 searches). Web fetch on about a dozen pages. GitHub through the authenticated `gh` CLI (repo metadata, file reads, code search on three strings).
- **Could not read.** The UEi HUB manual and the Fieldpiece JL3PR v24 manual. The fetch tool returned binary PDFs, and I could not extract text from them. (The lead read both afterwards; see section 1.)
- **Not checked.** Home Assistant, ESPHome, Wireshark dissectors, libsigrok's device list, FCC grant database lookups, Chrome status pages, and the terms of any vendor app.
- **Not run.** Code search for UEi, Testo or Yellow Jacket UUIDs.
- **Blocked or 404.** The measureQuick Bluetooth reference page (404). The MDN Web Bluetooth compatibility page (404). The WebFetch of the Cornell 17 U.S.C. §1201 page returned only summary text with short quotes, so subsection (f) is paraphrased with short exact quotes, not reproduced in full.
- **Time.** About 15 minutes over the bound. The open-source search was the productive part.
