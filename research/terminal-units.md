# Terminal heating units — sources and notes (kb/terminal.yaml)

Session H2, 2026-10-24. What the terminal-unit module rests on, and where each kind of statement came from.
All KB text is written in our own words. Nothing was copied from manufacturer manuals or proprietary apps.

## Sources used

| ref id | source | rights | used for |
|---|---|---|---|
| `tm-5-642` | US Army TM 5-642, *Operation and Maintenance, Small Heating Systems* (Aug 1990). Copy read: https://www.wbdg.org/FFC/ARMYCOE/COETM/tm_5_642.pdf | US Government work | steam unit heaters, steam coils, radiators, air vents, hot-water fan-coil units (details below) |
| `doe-steam-tip1` | US DOE, *Inspect and Repair Steam Traps*, Energy Tips — Steam, Steam Tip Sheet #1. Record: https://www.osti.gov/biblio/1053476 | US Government work | failed-open and failed-closed traps, and why a blowing trap hurts the rest of the return |
| `practice` | General field practice, in our own words | our text | most valve, fan, control and electric-heater faults |

Physics, not a source: electric heater output goes with V² (P = V²/R), so a 240 V element on 208 V gives
(208/240)² ≈ 0.75 of its rating; element resistance ≈ V² ÷ W (1,500 W at 240 V ≈ 38 Ω).

### What TM 5-642 contributed (paraphrased, by paragraph)

- **4-50 (air vents).** A vent that spits water and steam has dirt on its seat, a failed element, or a water
  pocket in the piping. A clogged vent air-binds the unit and keeps steam out. → `tu.steam_vent`.
- **4-52 / 4-54 (steam radiators).** Radiators must pitch toward the condensate outlet; extended-surface units
  need traps in perfect order because a little held-up condensate costs a lot of output. Covering radiators
  cuts output. If the radiator heats but the room doesn't, compare room heat loss with installed radiation.
  → `tu.steam_piping`, `tu.trap_closed`, `tu.air_blocked`, the system's `ok_note`.
- **4-55 to 4-58 (steam unit heaters).** Unit heaters are usually controlled by switching the fan. Where steam
  isn't always available, a reverse-acting aquastat or pressure switch lets the fan run only when the coil is
  hot. A strainer goes ahead of the trap; there must be ample drop from the coil outlet to the return and a
  trap big enough for start-up condensate. Spaces can stay cold with the units hot when the fan or fan speed is
  wrong, the units hang too high or too far apart, or the heat loss is more than the units can make. Failure to
  fill with steam is usually the air vent, clogged piping, or a trap too small.
  → `tu.fan_delay_open`, `tu.fan_delay_closed`, `tu.trap_closed`, `tu.steam_piping`, `tu.fan_slow`,
  `tu.stratification`, `tu.steam_vent`.
- **4-59 to 4-63 (steam coils).** Coils freeze mostly because the trap fails to drain them. Long coils need
  air vents and vacuum breakers; poor pitch cuts output a lot; the outlet should drop about a foot before the
  trap. Partial failure to heat: low steam pressure, inlet valve, traps, vacuum breaker, vents, dirty coil or
  filters, or wrong fan speed. → `tu.vac_breaker`, `tu.coil_frozen`, `tu.fins_dirty`, `tu.filter`, `tu.fan_slow`.
- **4-81 / 4-82 (heating unit malfunction; space fails to heat).** A unit fails to fill with steam because of
  low steam pressure, a valve disc fallen onto its seat or a valve that won't open, air binding, a waterlogged
  unit from a bad trap, a pocketed or rising outlet, a trap too small, or too little pitch (worst on small
  horizontal fin-tube). Unit heaters hung too high stratify heat at the roof; recirculation ducts from the floor
  to the unit inlet help. → `tu.steam_valve`, `tu.no_source`, `tu.steam_piping`, `tu.stratification`.
- **5-10 to 5-13 (hot-water fan-coil units).** A low-efficiency filter ahead of the fan protects the coil from
  lint; housing and hospitals need more filter changes. Capacity is by water valve, air bypass or fan speed.
  Return-air thermostats don't read the room when the fan is off. Fan motors are small shaded-pole or PSC
  motors, need periodic oiling, and a whole fan deck can be swapped. The coil's air side should be cleaned
  yearly. → `tu.filter`, `tu.fins_dirty`, `tu.stat_warm_spot`, `tu.fan_bearings`, `tu.fan_motor`, `tu.fan_cap`.

## Looked at, not used

- **UFC 3-410-01 / UFS 3-410-01** (WBDG). Confirmed the documents exist and that the supplement has a fan-coil
  section, but its text wasn't read in this session, so nothing in the KB cites it.
- **DOE Energy Saver page on electric resistance heating.** The URL tried returned 404 and a search found no
  current page. The electric-heater causes rest on general practice and the V²/R physics above.
- Trade-press articles on vacuum breakers (Deppmann, HeatingHelp) turned up in a search. They agree with
  TM 5-642 4-60/4-81g, but are copyrighted and were not used as a source.

## Numbers in the KB and where they come from

| number | where | basis |
|---|---|---|
| air rise ≈ 45 % of (water or steam temp − entering air); "high" over 1.4× that, "low" under 0.55× | `tu.air_rise` | coil effectiveness of a typical unit heater or fan coil at rated airflow (practice; e.g. 180 °F water, 60 °F air → ~50 °F rise) |
| 60 °F rise for steam, 40 °F for electric when no pipe temperature is entered | `tu.air_rise` | typical catalog-range rises (practice) |
| hot-water coil drop 10–30 °F; "wide" over 40 °F (or design + 20 °F) | `tu.coil_dt` | 20 °F design drop is the common schedule value (practice) |
| supply "lukewarm" under 110 °F (80 °F for radiant) | `tu.supply_pipe` | practice; heat-recovery loops at 120–140 °F still read hot |
| condensate outlet drops ~12 in before the trap | `tu.trap_closed`, `tu.steam_piping` | TM 5-642 4-60 |
| freeze-stat setting about 35–38 °F | `tu.freezestat_failed` | same figure the AHU module uses (practice) |
| 240 V on 208 V ≈ 75 % output | `tu.wrong_voltage`, `tu.rated_v` | P = V²/R |
