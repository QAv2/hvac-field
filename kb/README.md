# Knowledge base — authoring guide

The diagnosis engine is generic; everything it knows lives in these YAML files. `tools/build.py` merges them
into `docs/data/kb.json`, and `tools/check.mjs` tests them. Anyone can add a cause, a check, or a whole
system by following this page.

```
python3 tools/build.py && node tools/check.mjs            # build + every check + every scenario
node tools/check.mjs --module boiler-oil.yaml             # self-tests for one file's causes only
python3 tools/check_pt.py                                 # baked PT tables vs published charts
node tools/why.mjs --scenario "part of a scenario name"   # why each leading cause scores what it does
python3 tools/build.py --kb-dir X/kb --scen-dir X/scenarios --out X/out   # build a copy (a lane's snapshot)
node tools/check.mjs --kb X/out/kb.json --scenarios X/out/scenarios.json   # …and check that copy
```
A module is done when the build has **zero problems** and the checker shows **no warnings for its causes**.

Shared files (`systems.yaml`, `common.yaml`, `vc-core.yaml`, `synonyms.yaml`, `docs/js`, `tools`) have one
owner at a time. A module author edits only their module file and its scenarios; a change to a shared file is
made on a snapshot (build it with `--kb-dir`) and copied back whole.

## How the engine thinks (read this first)

One fault at a time. For the chosen system, every cause gets a prior (how common it is), and every finding
the tech enters multiplies each cause by how likely that finding is **if that cause were the fault**:

    P(cause | findings) ∝ prior × Π P(finding | cause)^0.9

- A cause that **says nothing** about a feature reads it at the **leak rate**: the feature's base rates with
  every abnormal state cut to about a third, renormalized. So an abnormal finding a cause can't explain counts
  against it. Silence is a statement: only leave a feature out if the cause truly doesn't move it.
- **Situational** features (weather, recent work, a power outage: `situational: true`) are the exception. A
  silent cause takes their plain base rate, so "it's −30 °F out" alone doesn't drag every cause toward the
  freeze-ups.
- **Next best check** = the unasked check with the most information gain about the leading causes, divided
  by its effort (`cost`). Cheap, decisive looks come first; a check that no cause in play has an opinion on is
  never suggested. So every cause needs at least one sign that sets it apart — ideally a cheap one.
- A pseudo-cause "nothing wrong found" is always in the race. The system's `ok_signs` say how a call with
  nothing wrong gets reported (mostly "not enough", seldom "nothing at all"); other complaint features
  (`complaint: true`) stay at their base rates, and every other check is read at the leak rate. So the
  complaint alone doesn't count against it, and all-normal readings push the real faults down.

## Files and ids

One module per file. Ids are `prefix.name`, lowercase, prefix = the module's namespace:
`gen.` (common), `vc.` (refrigeration core), `rf.` (commercial refrigeration), `hp.` (heat pump heating),
`blr.` (oil burner and boilers), `hyd.` (hot water, glycol, steam), `tu.` (terminal units), `ahu.` (air handling),
`ctl.` (controls and low-voltage circuits, on every system). A file may have
`module`, `title`, `notes`, and lists: `systems`, `context`, `features`, `inputs`, `measures`, `causes`,
`synonyms`, `refs`.

## Systems and context (kb/systems.yaml)

Selectable systems: `vc.ac`, `vc.hp`, `vc.walkin`, `vc.reachin`, `vc.ice`, `fuel.boiler`, `fuel.furnace`,
`hydronic`, `steam`, `terminal`, `ahu`. Groups: `vc` (all refrigeration), `fuel` (both oil-fired systems). Tagging an item
with a group applies it to every member. `'*'` = every system.

A system's `ok_note` is the advice shown when "nothing wrong found" leads, and `ok_signs` (signs, as on a
cause; the nearest system or group that has them wins) is how such calls get reported.

The shared no-run causes in `common.yaml` (no line power, no control power, no call, short to ground) name
the thing that moves on each system — `vc.comp`, `blr.start`, `ahu.fan`, `hyd.circ`, `tu.fan` (and `tu.heat_amps`
for electric heat) — so a unit seen running
counts against them. A new system with its own "is it running?" feature adds it there too.

Context questions are asked once per job (refrigerant, metering device, …) and gate or bend causes:
```yaml
context:
  - id: fluid                      # unique across all files
    ask: What's in the loop?
    hint: optional one-liner
    systems: [hydronic]
    options:
      - {id: water, label: Water}
      - {id: eg, label: Ethylene glycol}
    defaults: {hydronic: water}    # optional per-system default
```
An option may carry `systems: [...]` (only offered there) and `words: [...]` (typing one of these words in
the description answers the question — "freezer" → low temp).

When several options' `words` match the description, the **last** matching option in the list wins, so
list the more specific option later ("ducted mini split" → `minisplit`, which comes after `ducted`).

Existing context ids (option ids in brackets):
- every refrigeration system (`vc`): `refrigerant`, `metering` [txv/eev/fixed/captube], `receiver`
  ['yes'/'no'], `app` [ac/mt/lt], `sh_location` [evap/comp], `condenser` [air/water], `phases` [single/three]
- A/C and heat pumps (`vc.ac`, `vc.hp`): `hp_unit` [ducted/inverter/minisplit], `ac_eff` [standard/high];
  heat pumps only: `rv_energized` [cool/heat] (which mode energizes the reversing-valve coil)
- commercial refrigeration: `hpc` [flooding/fan_cycling/vfd/none] (walk-ins, reach-ins, ice machines),
  `defrost` [off_cycle/electric/hot_gas] (walk-ins, reach-ins)
- oil-fired (`fuel`): `fuel_type` [no2/kero], `oil_piping` [one_pipe/two_pipe/two_stage], `flame_sensor`
  [cad/stack]; boilers only: `boiler_kind` [hw/steam]
- `hydronic`: `fluid` [water/glycol/pg/eg]
- `terminal`: `tu_heat` [water/glycol/steam/electric], `tu_type` [unit_heater/cabinet/fcu2/fcu4/baseboard/radiant]
- `ahu`: `fan_drive` [belt/direct], `vfd` ['yes'/'no'], `oa_type` [mixed/all_oa/hrv], `economizer`
  ['yes'/'no'], `heat_coil` [water/eg/pg/steam/electric/none], `cool_coil` [chw/dx/none]
- every system: `controls` [stat_mech/stat_digital/bas/unit] (what tells the equipment to run; defaults to `bas`
  on air handlers and `unit` on walk-ins, reach-ins and ice machines); A/C only: `rev_valve` ['yes'/'no'] (heat
  pump or cooling only)

Shared questions live in `systems.yaml`, a module's own questions in its module file. `hp_unit` and
`rv_energized` sit in `systems.yaml` because vc-core gates on `hp_unit` too; `controls` and `rev_valve` sit there
because any module may gate a thermostat or BAS cause on them.

## Features — the things a tech can observe or measure

```yaml
- id: blr.cad_ohms
  name: CAD cell resistance             # short; chips read "name: state label"
  ask: What does the CAD cell read with the flame on?   # the next-check card's question
  ask_for: {fuel.furnace: '…'}          # optional: the question worded for one system (or group)
  how: Primary control off its sub-base... # optional: how to check, one or two sentences
  caution: Reset once only…           # optional: a hazard in making the check, shown in red on the check card
  systems: [fuel]
  states:                               # 2–5 states, lowercase ids → labels (order = display order)
    good: Under 1,600 Ω (flame seen)
    high: Over 1,600 Ω (flame not seen)
  normal: good                          # the "nothing wrong" state (defaults: normal, then no, then ok)
  base: {good: 0.9, high: 0.1}          # optional; default ≈ 0.86–0.92 on the normal state
  cost: 2                               # 1 look/ask · 2 quick touch/meter · 3 instrument set up · 4 test procedure · 5 teardown
  needs: meter                          # optional setup group: gauges, meter, clamp, combustion, manometer,
                                        #   thermometer, probe, refractometer, shutdown, ladder, panel, tools, hydrometer
  ask_if: {blr.flame: established}      # optional: only ask once these findings are known and match
  ask_unless: {blr.lockout: repeats}    # optional: never suggest it once a finding makes it unsafe or pointless
  requires: {fuel_type: [kerosene]}     # optional: only when the context fits (unknown context = allowed)
  complaint: true                       # optional: offered on the "what's wrong?" screen
  confuse: {none: {weak: 0.25}}         # optional: how often a true state gets reported as another
  follows: {gen.output: {high: [none, weak], normal: [normal]}}   # optional: the same fact told another way —
                                        #   a cause silent here reads it from its sign on that feature
  situational: true                     # optional: weather or history, not a symptom — a cause that doesn't
                                        #   mention it has no opinion (base rate), instead of being marked down
  chip: state                           # optional: state labels read alone ("No heat at all")
  phrases:                              # search words, per state — how a tech would type it
    high: [cad cell bad, cad cell dirty, flame not proven, lockout after 15 seconds]
```
Rules:
- **One physical quantity → one feature.** Don't add both "suction pressure low" and "evaporator
  temperature low"; they're the same fact and the engine would count it twice.
- States should be what the tech can actually tell apart in the field.
- Write `phrases` generously — this is how typed symptoms find their chip. Include slang, misspellings and
  abbreviations techs use.
- Use the shared features instead of duplicating them: `gen.output` (none/weak/normal — the main complaint;
  `{output}` reads as "cooling", "heat", "air" or "ice"), `gen.dead`, `gen.short_cycle`,
  `gen.runs_constantly`, `gen.water_leak`, `gen.burnt_smell`, `gen.intermittent`, `gen.recent_work`,
  `gen.after_outage`, `gen.power`, `gen.breaker` (ok/tripped/retrips), `gen.control_v`, `gen.call`,
  `gen.voltage`. Refrigeration modules also share the `vc.*` features (see vc-core.yaml).

## Inputs and measures — numbers that set features

```yaml
inputs:
  - {id: blr.stack_f, name: Stack temperature, unit: °F, systems: [fuel], probe: air, hint: In the flue before the draft regulator}
  - {id: blr.design_dt, name: Design ΔT, unit: °F, systems: [hydronic], default: 20}

measures:
  - id: blr.net_stack
    name: Net stack temperature
    unit: °F
    systems: [fuel]
    let: {room: 'blr.room_f ?? 70'}     # optional named sub-expressions
    value: blr.stack_f - room           # what's computed and shown
    target: '450'                       # optional expected value, shown beside it
    sets: blr.stack_temp                # the feature it classifies (optional — display-only otherwise)
    states:                             # first true condition wins; v = value, t = target
      - [high, v > 650]
      - [low, v < 300]
      - [normal, 'true']
```
A measure with `hidden: true` is a helper (used by other measures, not shown as a tile).

The expression language: numbers, `'strings'`, `+ - * /`, `< <= > >= == !=`, `&& || !`, `a ? b : c`,
`a ?? b` (b when a is unknown), parentheses, and functions `min max abs round clamp has coalesce`,
`tsat_dew tsat_bubble tsat_mid psat_dew psat_bubble` (refrigerant from context), `wetbulb(db, rh)`,
`dewpoint(db, rh)`, `rh_from_wb(db, wb)`, `fo_target_sh(wb, odb)`, `split_target(db, wb)`,
`glycol_freeze(pct, 'EG'|'PG')`, `flue_eff(stack, air, o2)`, `co_airfree(co, o2)`. Names are input ids,
other measure ids, `ctx.<context id>`, `let` names, `v`, `t`. Anything unknown is null and spreads: a measure
whose inputs are missing simply doesn't run, and when an earlier state's condition can't be judged (a reference
left blank) the bare `'true'` catch-all doesn't fire — the tile shows the number with no verdict. Write the
fallback as `'has(t)'` or similar when it needs its own condition. Two measures may set the same feature; the
first listed that can run wins.

Write one-line `{…}` maps only for short values: an unquoted comma inside them ends the value. Quote any text
with a comma (`hint: "…"`); the build rejects the stray keys a comma leaves behind.

**YAML gotcha:** quote any expression containing `: ` (a ternary) or starting with a quote or `[ { * & ! | >`,
e.g. `target: 'ac ? 35 : 10'`. `yes`, `no`, `on`, `off` are strings here (YAML 1.2), but quote them in flow
maps anyway for readability: `{vc.drain: clogged, gen.water_leak: 'yes'}`.

## Causes

```yaml
- id: blr.nozzle_plugged
  name: Nozzle partly plugged or worn          # plain technician language, what's wrong
  systems: [fuel]
  requires: {burner: [gun]}                    # optional context gate
  prior: common                                # very_common · common · occasional · uncommon · rare
  keywords: [bad nozzle, dirty nozzle]         # extra search words
  signs:                                       # feature → sign
    blr.flame: unstable
    blr.smoke: high?
    gen.output: weak
  when:                                        # optional context-specific overrides (replace, not add)
    - if: {fuel_type: kerosene}
      signs: {blr.smoke: normal?}
  confirm: How to prove it, one or two sentences.
  fix: |
    What to do, in order. Plain steps a tech can follow. Include the "why it happened" check.
  safety: Optional — the hazard, said once.
  notes: Optional — conflicts between sources, nuance.
  refs: [tm-5-642, practice]                   # ids from any refs: list
```

### Signs
| written | means | P(state) |
|---|---|---|
| `high!` | nearly always | 0.95 |
| `high` | usually | 0.85 |
| `high?` | often | 0.60 |
| `low\|normal` | either, evenly | 0.85 split |
| `{low: 0.2, normal: 0.5, high: 0.3}` | exactly this | as given |

Leftover probability goes to the other states in proportion to their base rates. A single sign on the
**normal** state (`normal`, `'no'`) is lifted just above the base rate, so "this cause keeps X normal"
supports the cause when X reads normal.

Good signatures:
- 3–10 signs. The complaint (`gen.output` and friends), the decisive checks, and the measurements it moves.
- At least one **distinguishing** sign that no look-alike cause shares, preferably cheap (cost 1–2). If two
  causes would have identical signs, either merge them or add the check that separates them (a test, a look,
  a reading).
- Directions from physics or published data (NIST charts, public-domain manuals), never copied from
  proprietary apps or copyrighted manuals. Text in our own words.
- No maker or trade names in displayed text (names, questions, how, confirm, fix). Fault codes, valve
  polarity and settings differ by maker, so the text sends the tech to that maker's service manual or chart,
  and a part goes by its plain name (snap-disc thermostat, flooding valve, PTFE seat). Search `keywords` and
  `phrases` may carry the names techs actually type ("sentronic tripped", "headmaster stuck").
- Priors relative to the system: what a working tech sees most often is `very_common`/`common`.

## Scenarios (tests/scenarios/*.yaml)

Every module ships service-call scenarios. They're the regression suite.
```yaml
- name: Burner locks out after 15 s, CAD cell reads high
  system: fuel.boiler
  ctx: {fuel_type: kerosene}
  findings: {blr.lockout: 'yes', blr.cad_ohms: high}
  inputs: {blr.stack_f: 520}                   # optional: numbers → measures
  expect:
    top: blr.cad_cell_dirty                    # must be #1
    top3: [blr.cad_cell_dirty]                 # must be in the top 3
    not_top: [blr.nozzle_plugged]              # must not be #1
    not_top3: [gen.no_line_power]              # must not be in the top 3
    measured: {blr.stack_temp: normal}         # what the numbers must classify as
    unmeasured: [blr.o2]                       # the numbers must give no verdict here (a reference left blank)
    next_any: [blr.cad_ohms, blr.flame]        # one of the first three suggested checks
```
Write at least one scenario per common cause and a few "opening move" scenarios (only the complaint known —
the first suggested checks should be cheap and sensible).
