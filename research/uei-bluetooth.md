# UEi Test Instruments wireless probes: Bluetooth interoperability research

Research date: 2026-10-22. Bound: about 20 minutes. Sources are cited inline. Anything not confirmed by a primary source is marked **OPEN** or **inference**.

## What this means for the build

- **The probes are radio, and the phone is the only documented host.** UEi's own material says the HUB kit's probes "connect directly to your phone via Bluetooth" (measureQuick HUB6/HUB8 page, which quotes UEi's product copy). The App Store listing for the UEi Hub app describes BLE-era features (Bluetooth connection reliability, BLE scanning). The probe radio is most likely BLE, but **no source names the Bluetooth version or BLE for the HUB probes**. The manual's IC notice cites RSS-247 (a 2.4 GHz digital standard), which fits BLE and does not prove it. **OPEN**: confirm with an FCC grant lookup for the WPP1/WPC1/WOT2 FCC IDs, or with a BLE sniff of the UEi Hub app (see Section 4).
- **No public SDK, API, protocol doc, or developer program was found.** The app's vendor is Kane Asia Inc. (App Store listing). Interoperability will be reverse-engineered, not licensed. Expect the protocol to change with app or firmware updates. The App Store version history shows Bluetooth fixes in 2.2.815 (Sep 27), 2.2.818 (Oct 11), and 2.2.820 (Oct 15), which suggests the protocol layer is still moving.
- **Battery is replaceable alkaline, not built-in lithium.** Every probe found uses AA or AAA cells (Section 1). That is good for air travel: spare alkaline AA/AAA carry without a lithium-battery limit. Confirm the chemistry on each cell and the WPC2 and WVG2 battery types, which are **OPEN**.
- **Web Bluetooth is a viable prototype path on Chrome for Android, not a guaranteed one.** Linux needs an experimental flag, and the flag set is a security trade-off. Safari and Firefox do not support Web Bluetooth (secondhand, 2025 blog; see Section 4). If the field phone is an iPhone, Web Bluetooth is not an option, and the build needs a native app.
- **Method templates exist** (Section 3). The strongest is the readthedocs "Reverse Engineering BLE Devices" guide and the Wireshark-based Cobra iRAD write-up. The Meater probe project is closest in shape (a BLE probe that allows one connection at a time).

## 1. UEi product lineup (what the probes measure, radio, battery)

Sources are retailer, measureQuick, App Store, and the UEi manual. Model numbers come from these sources; where a source is missing a detail, the cell says so.

| Model | Measures | Radio (as stated) | Battery (as stated) | Source |
|---|---|---|---|---|
| WPP1 wireless pressure probe (HUB4/HUB6 generation) | 0 to 1000 PSI, 1/4" connector; temperature/pressure at line | "Wireless output: Yes"; not named | 2x AA, "100+ hours" | UEi HUB manual (2018), see [UEI HUB Manual PDF](https://res.cloudinary.com/iwh/image/upload/q_auto,g_center/assets/1/26/UEI_HUB_Manual.pdf) |
| WPP2 (HUB4 kit in current listing) | Pressure probe, WPP2/WPP3 handling added in app 2.2.544 | not named | AA (2) per UEi HUB4 listing | [ueitest.com HUB4 product page](https://ueitest.com/ECommerce/product/HUB4); App Store version notes |
| WPC1 pipe clamp (HUB4/HUB6 generation) | Pipe-clamp line temperature; cabled to WPP1, max pipe 1.5 in | Not stated; it has no separate battery in the manual (cable to WPP1) | Via WPP1 (inference) | UEi HUB manual |
| WPC2 pipe clamp (current HUB6/HUB8) | 32 to 176 °F pipe-clamp temperature (retailer copy) | Not named | **OPEN** | [plumbersstock HUB8](https://www.plumbersstock.com/uei-hubup8.html); [measureQuick HUB6/HUB8](https://measurequick.com/smart-tools/uei/hub/uei-hub6-hub8/) |
| WHP1 wireless hygrometer | Temperature, RH, dew point, wet bulb, enthalpy (via app) | Not named | 2x AAA, "100+ hours" | UEi HUB manual; [plumbersstock HUB8](https://www.plumbersstock.com/uei-hubup8.html) |
| WVG2 wireless vacuum gauge | Vacuum (HUB8 kit) | Not named | **OPEN** | [measureQuick HUB6/HUB8](https://measurequick.com/smart-tools/uei/hub/uei-hub6-hub8/) |
| WOT2 outdoor temperature probe | Outdoor air temperature | "Works with the HUB app on Android and iOS" (retailer), 350 ft range | 2x AA, about 230 hours (retailer) | [plumbersstock WOT2](https://plumbersstock.com/uei-wot2.html) |
| WRS | Listed in App Store "supported probes" (newer listing); no spec found | - | **OPEN** | [App Store, UEi Hub](https://apps.apple.com/app/id1358221837) |
| DL599 true-RMS clamp meter | AC/DC current, voltage, power, capacitance, temperature (K-type) | "Bluetooth wireless (free app)" connects to measureQuick; BLE vs Classic not stated | 4x AAA (no chemistry given) | [measureQuick DL599](https://measurequick.com/smart-tools/uei/electrical-meters/uei-dl599/) |
| DL579 clamp meter | True-RMS HVAC/R clamp, temp, capacitance | Retailers list no Bluetooth; **treat as no Bluetooth until confirmed** | - | [TestEquity DL579](https://www.testequity.com/product/10282393-DL579) |
| 121GW multimeter (developed with EEVblog) | Multimeter; Bluetooth connectivity per search snippet | Not verified | Not verified | [EEVblog 121GW](https://eevblog.com/product/121gw/) (search snippet only, page not fetched) |
| DL289 | No result returned | - | - | **OPEN**: not in any source found |

Other notes:
- The HUB kits are HUB2, HUB4, HUB6, and HUB8. HUB8 adds WVG2 and WOT2 to HUB6. HUB6 includes 2x WHP1, 2x WPP1, and 2x WPC2 (measureQuick HUB6 page).
- Wireless range: 350 ft (measureQuick, WOT2 retailer copy). The HUB4 datasheet says "up to 150 ft... pending environmental conditions" (search snippet, TestEquipmentDepot datasheet).
- App platform: the UEi HUB app is on the App Store and is described by UEi as "iOS and Android" (ueitest.com HUB4 page). The App Store search result is iOS-only in the snippet. Google Play availability was **not** verified.
- Measurements the app computes: superheat and subcooling, refrigerant-side and air-side calculations, vacuum, psychrometrics (App Store description; [plumbersstock HUB8](https://www.plumbersstock.com/uei-hubup8.html)).

## 2. SDK, API, partner integrations

- **No UEi SDK, API, or developer program was found.** Searches for "UEi developer SDK API Bluetooth partner" returned only the UEi app listing and unrelated companies (UEIDAQ, Universal Electronics). **Confirmed absent from public sources as of this search**, which is not the same as confirmed absent from UEi's business.
- **UEi Link app (Kane Asia Inc.)**: App Store listing says it is the companion app for SPM, DPM, and DT2 kits and "reads instrument values over Bluetooth" (search snippet, [App Store UEi Link](https://apps.apple.com/mx/app/uei-link/id6544792992); page not fetched). This is the only UEi Bluetooth material in the results, and it is a different product family from the HUB.
- **measureQuick** (third-party app) lists UEi HUB and HAC support and the DL599. Its marketing says "80+ tools across 17+ brands" and that it reads Fieldpiece probes over BLE "since 2018" (Fieldpiece claim is competitor marketing, see Section 2a). **The measureQuick reference page for Bluetooth probes returned 404** (support.measurequick.com), and the UEi category page names no protocol, SDK, or partner program. Its connection method for UEi is **OPEN**.
- Other partner names the owner asked about (Hilmor, iManifold, ServiceTitan): **no evidence of UEi integration was found in this search.** Not checked further (outside the bound). **OPEN**.

### 2a. Fieldpiece (for comparison)
- No public SDK or protocol doc for Job Link found. The Job Link architecture: wireless JobLink probes (JL3PC, JL3PR) are BLE devices; the JL2 bridges older radio manifolds to Bluetooth ([measureQuick Job Link page](https://measurequick.com/smart-tools/fieldpiece/joblink/)). Live range: 350 ft (JL3PR manual, [Opman JL3PR v24](https://resources.fieldpiece.com/wp-content/uploads/2025/10/Opman-JL3PR-v24.pdf)); Fieldpiece's 2021 press release claims up to 1000 ft (conflict, not resolved).

## 3. Protocol documentation (GATT, packet format)

- **Nothing found** for UEi, Kane Asia, or the HUB probes on GitHub, Home Assistant forums, or the web. Searches run: UEi BLE GATT; "UEi Hub" + BLE + decoder + Home Assistant; "Kane Asia" + Bluetooth.
- **GitHub repository search via `gh search repos`** for "UEi Hub bluetooth", "uei probe ble", "UEi Test Instruments", "Kane Asia bluetooth", and "measureQuick" all returned empty lists. **Caveat**: I did not confirm the `gh` CLI is authenticated for search, so treat this as a weak negative. **OPEN**.
- **Fieldpiece Job Link**: no GitHub reverse-engineering found. The closest is a general reverse-engineering guide.
- **Testo Smart Probes**: no reverse-engineering found in search. Nothing usable.
- **Method templates (primary or near-primary):**
  - Reverse Engineering BLE Devices (readthedocs), protocol reverse-engineering chapter: https://reverse-engineering-ble-devices.readthedocs.io/en/latest/protocol_reveng/00_protocol_reveng.html (and index https://reverse-engineering-ble-devices.readthedocs.io/)
  - Reverse Engineering Bluetooth Protocols (Cobra iRAD 900; Wireshark capture of phone-app traffic): https://github.com/brandonasuncion/Reverse-Engineering-Bluetooth-Protocols (fork: https://github.com/david-foo/Reverse-Engineering-Bluetooth-Protocols). Method only; device unrelated.
  - meaterble (Meater BLE probe reverse-engineering; notes that each probe allows a single BLE connection): https://github.com/nathanfaber/meaterble. Structurally the closest analog, a wireless temperature probe.
  - Adafruit, Reverse Engineering a BLE Light Bulb (gatttool/bluez workflow): https://learn.adafruit.com/reverse-engineering-a-bluetooth-low-energy-light-bulb.md?view=all
  - OWON B35T+ (gatttool display tool, GitHub): https://github.com/53845714nF/OWON_B35T. A BLE multimeter with a small public protocol note. Not UEi.
- **Suggested capture route (inference, method, not yet done):** On Android, enable Bluetooth HCI snoop logging in developer options, run the UEi Hub app against the owner's probes, and open the capture in Wireshark. Use nRF Connect on the phone to enumerate GATT services and characteristics while the probes are connected. Pair the captured service UUIDs with the app's advertised names. Cross-check that the probe advertises only to one central at a time (the Meater analog suggests this). The owner's hardware is the test rig. Check UEi's terms before publishing decoded protocol.

## 4. Web Bluetooth on Chrome (Android and Linux)

- **Android:** Chrome for Android 6.0 and later is listed as supported without a flag (developer.chrome.com Bluetooth page, which says it was "Last updated 2015-07-21" and is stale; GitHub implementation-status, old commit, https://github.com/WebBluetoothCG/web-bluetooth/blob/158ebcbda139497849a41d826d5191fa4d9e61e7/implementation-status.md). **Current Chrome Android version is OPEN.** The page's support matrix is stale, so verify on the field phone's Chrome version.
- **Linux:** The same sources say Linux needs `chrome://flags/#enable-experimental-web-platform-features` (the page itself says "enable the `#experimental-web-platform-features` flag in `about://flags`"). A CircuitPython doc recommends not enabling the broad experimental flag because it turns on many other experimental features, and suggests `chrome://flags/#enable-web-bluetooth-new-permissions-backend` (or the about://flags/#enable-web-bluetooth variant) instead (https://code.circuitpython.org, search snippet). Also reported: BlueZ 5.41+ and kernel 3.19+ requirements in the older implementation-status doc. **Current Chrome Linux flag state is OPEN**; verify on chrome://version and chrome://flags on the target machine.
- **Requirements (developer.chrome.com, secure context, user gesture, BLE 4.0+):** the API works only in secure contexts (HTTPS or localhost), `requestDevice` must be triggered by a user gesture (tap or click), and devices need Bluetooth 4.0 or later. Source: https://developer.chrome.com/docs/capabilities/bluetooth.
- **Pairing and bonding:** the official docs do not describe bonding. CircuitPython notes that on Linux the flags are required to connect at all; elsewhere the flags mostly affect bond storage and reconnect. **OPEN** for current behavior and whether a bonded UEi probe needs a re-pair after a Chrome restart.
- **Notifications:** `startNotifications` is supported in the API (sample in developer.chrome.com docs). Linux notification support is only "partial" in the old status doc. **OPEN**: test on real probes.
- **Other browsers:** Safari and Firefox don't support Web Bluetooth natively, per a 2025 beaconzone blog (secondhand, https://www.beaconzone.co.uk/blog/browser-support-for-web-bluetooth/). Firefox has a WebBT extension that needs a native companion (https://addons.mozilla.org/en-US/firefox/addon/webbt/). Check the owner's phone model.
- **Known gotchas from search (anecdotal):** an Ubuntu user reported Web Bluetooth disabled after a system update, re-enabled by the flag; a Manjaro user needed the Chrome flag even after running bluetoothd with experimental options (forum threads, https://forum.manjaro.org/t/cant-use-web-bluetooth-in-google-chrome/103496). Anecdotal; not reproduced.

## Open questions (consolidated)

1. OPEN: Radio type of the HUB probes (BLE vs proprietary 2.4 GHz). Needs the FCC grant for WPP1/WPC1/WOT2 or a BLE sniff.
2. OPEN: WPC2, WVG2, WRS, and DL289 specs, including battery type and chemistry.
3. OPEN: Whether a probe accepts only one BLE central at a time. Matters if the app and a custom client both need to read.
4. OPEN: Whether the UEi Hub app is available on Google Play in the US (only the App Store was checked).
5. OPEN: Chrome Android and Linux current support, flags, and notification behavior (sources are stale).
6. OPEN: Whether UEi or Kane Asia has any developer, partner, or integration program (search found none; not asked directly).
7. OPEN: Hilmor, iManifold, ServiceTitan integrations with UEi (not checked).
8. OPEN: The measureQuick Bluetooth reference page returned 404, so how measureQuick connects to UEi probes is unknown.

## Sources

- UEi HUB manual (2018 PDF): https://res.cloudinary.com/iwh/image/upload/q_auto,g_center/assets/1/26/UEI_HUB_Manual.pdf
- UEi HUB4 product page: https://ueitest.com/ECommerce/product/HUB4
- UEi Hub app, App Store: https://apps.apple.com/app/id1358221837 (also https://apps.apple.com/id/app/uei-hub/id1358221837)
- UEi Link app, App Store: https://apps.apple.com/mx/app/uei-link/id6544792992
- measureQuick HUB6/HUB8: https://measurequick.com/smart-tools/uei/hub/uei-hub6-hub8/
- measureQuick DL599: https://measurequick.com/smart-tools/uei/electrical-meters/uei-dl599/
- measureQuick UEi category: https://measurequick.com/smart-tools/uei/
- plumbersstock HUB8 kit: https://www.plumbersstock.com/uei-hubup8.html
- plumbersstock WOT2: https://plumbersstock.com/uei-wot2.html
- TestEquity DL579: https://www.testequity.com/product/10282393-DL579
- DigiKey UEi supplier page (Kane Group since 1992): https://www.digikey.com.mx/es/supplier-centers/uei-test-instruments
- Fieldpiece Job Link (measureQuick): https://measurequick.com/smart-tools/fieldpiece/joblink/
- Fieldpiece JL3PR manual v24: https://resources.fieldpiece.com/wp-content/uploads/2025/10/Opman-JL3PR-v24.pdf
- Reverse Engineering BLE Devices: https://reverse-engineering-ble-devices.readthedocs.io/
- Reverse Engineering Bluetooth Protocols (Cobra iRAD): https://github.com/brandonasuncion/Reverse-Engineering-Bluetooth-Protocols
- meaterble: https://github.com/nathanfaber/meaterble
- OWON_B35T: https://github.com/53845714nF/OWON_B35T
- Adafruit BLE light bulb: https://learn.adafruit.com/reverse-engineering-a-bluetooth-low-energy-light-bulb.md?view=all
- Chrome Web Bluetooth docs: https://developer.chrome.com/docs/capabilities/bluetooth
- Web Bluetooth implementation status (old commit): https://github.com/WebBluetoothCG/web-bluetooth/blob/158ebcbda139497849a41d826d5191fa4d9e61e7/implementation-status.md
- Browser support (2025 blog, secondhand): https://www.beaconzone.co.uk/blog/browser-support-for-web-bluetooth/
- WebBT Firefox extension: https://addons.mozilla.org/en-US/firefox/addon/webbt/
- Manjaro forum thread (anecdotal): https://forum.manjaro.org/t/cant-use-web-bluetooth-in-google-chrome/103496
