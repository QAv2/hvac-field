"""Bake refrigerant pressure-temperature tables from CoolProp, and the glycol freeze-point table.

Usage: .venv/bin/python -I tools/bake_pt.py          (both; needs CoolProp)
       python3 tools/bake_pt.py --glycol-only        (glycol only; no CoolProp needed)
Writes docs/data/pt.json (saturation psig per whole °F, dew and bubble for blends) and
docs/data/glycol.json (freeze point vs mass fraction for ethylene and propylene glycol).
The app interpolates these tables, so it needs no CoolProp at run time.

Glycol freeze points come from the Dow product tables (by weight % glycol), not CoolProp: CoolProp's
incompressible MEG fit runs up to 4 °F colder than the published table at 40–55 % EG, which would
overstate freeze protection (see cloud-reports/H1.md).
"""
import json, math, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "docs" / "data"
TMIN, TMAX = -60, 160          # °F

# name, CoolProp fluid string, safety class, where you meet it
REFRIGERANTS = [
    ("R-22",        "R22",                "A1",  "Older A/C, heat pumps and commercial refrigeration (HCFC, phased out)"),
    ("R-410A",      "R410A",              "A1",  "A/C and heat pumps 2010–2025"),
    ("R-454B",      "HEOS::R454B.MIX",    "A2L", "New A/C and heat pumps (2025 on)"),
    ("R-32",        "R32",                "A2L", "Mini-splits and new A/C"),
    ("R-407C",      "HEOS::R407C.MIX",    "A1",  "R-22 replacement in A/C"),
    ("R-422D",      "HEOS::R422D.MIX",    "A1",  "R-22 retrofit"),
    ("R-427A",      "HEOS::R427A.MIX",    "A1",  "R-22 retrofit"),
    ("R-134a",      "R134a",              "A1",  "Medium-temp refrigeration, chillers, older vehicles"),
    ("R-513A",      "HEOS::R513A.MIX",    "A1",  "R-134a replacement"),
    ("R-404A",      "R404A",              "A1",  "Walk-ins and commercial low/medium temp"),
    ("R-507A",      "R507A",              "A1",  "Commercial low/medium temp"),
    ("R-448A",      "HEOS::R448A.MIX",    "A1",  "R-404A replacement (walk-ins, racks)"),
    ("R-449A",      "HEOS::R449A.MIX",    "A1",  "R-404A replacement (walk-ins, racks)"),
    ("R-407A",      "HEOS::R407A.MIX",    "A1",  "R-404A/R-22 replacement in commercial refrigeration"),
    ("R-407F",      "HEOS::R407F.MIX",    "A1",  "R-404A/R-22 replacement in commercial refrigeration"),
    ("R-452A",      "HEOS::R452A.MIX",    "A1",  "Transport refrigeration (R-404A replacement)"),
    ("R-290",       "R290",               "A3",  "Propane: self-contained reach-ins and ice machines"),
    ("R-600a",      "R600a",              "A3",  "Isobutane: small reach-ins and household refrigerators"),
    ("R-744",       "R744",               "A1",  "CO2 (subcritical only below 87.8 °F)"),
    ("R-717",       "R717",               "B2L", "Ammonia: industrial refrigeration"),
    ("R-1234yf",    "R1234yf",            "A2L", "Vehicle A/C"),
    ("R-1234ze(E)", "R1234ze(E)",         "A2L", "Chillers and medium-temp"),
]


def K(f):
    return (f - 32) * 5 / 9 + 273.15


def F(k):
    return (k - 273.15) * 9 / 5 + 32


def psig(pa):
    return pa / 6894.757293168 - 14.6959


def mix_branch(q, name):
    """Walk one saturation branch of a blend upward in 1 °F steps, seeding each flash with the
    previous solution (pressure, phase densities, phase compositions). CoolProp's cold-start
    mixture solver fails across whole bands near the top of the range; continuation does not."""
    AS = CP.AbstractState("HEOS", name)
    out, prev = [], None
    for t in range(TMIN, TMAX + 1):
        try:
            if prev is None:
                AS.update(CP.QT_INPUTS, q, K(t))
            else:
                g = CP.PyGuessesStructure()
                g.T, g.p = K(t), prev[0]
                g.rhomolar_liq, g.rhomolar_vap = prev[1], prev[2]
                g.x, g.y = prev[3], prev[4]
                AS.update_with_guesses(CP.QT_INPUTS, q, K(t), g)
        except Exception:
            if prev is None:
                continue  # look for a first solvable point
            break
        p = AS.p()
        if prev is not None and p <= prev[0]:
            break  # past the top of the envelope
        prev = (p, AS.saturated_liquid_keyed_output(CP.iDmolar), AS.saturated_vapor_keyed_output(CP.iDmolar),
                list(AS.mole_fractions_liquid()), list(AS.mole_fractions_vapor()))
        out.append(p)
    return out


def table(fluid):
    if "::" in fluid:
        name = fluid.split("::")[1]
        d, b = mix_branch(1, name), mix_branch(0, name)
        n = min(len(d), len(b))
        return [round(psig(x), 2) for x in d[:n]], [round(psig(x), 2) for x in b[:n]], None
    tc = F(CP.PropsSI("Tcrit", fluid))
    dew, bub = [], []
    for t in range(TMIN, TMAX + 1):
        if t >= tc:
            break
        dew.append(round(psig(CP.PropsSI("P", "T", K(t), "Q", 1, fluid)), 2))
        bub.append(round(psig(CP.PropsSI("P", "T", K(t), "Q", 0, fluid)), 2))
    return dew, bub, tc


def main():
    global CoolProp, CP
    import CoolProp
    import CoolProp.CoolProp as CP
    out = {"meta": {"source": f"CoolProp {CoolProp.__version__}", "generated": time.strftime("%Y-%m-%d"),
                    "t0": TMIN, "step": 1, "units": {"T": "°F", "P": "psig"},
                    "note": "Blends list dew (vapor) and bubble (liquid) pressures. Mixture models marked 'mix' "
                            "are checked against published charts by tools/check_pt.py before use."},
           "refrigerants": {}}
    for name, fluid, safety, use in REFRIGERANTS:
        dew, bub, tc = table(fluid)
        if len(dew) < 40:
            print(f"SKIP {name}: only {len(dew)} points", file=sys.stderr)
            continue
        glide = max(abs(a - b) for a, b in zip(dew, bub))
        rec = {"cp": fluid, "safety": safety, "use": use, "mix": "::" in fluid,
               "tmax": TMIN + len(dew) - 1}
        if tc is not None:
            rec["tcrit"] = round(tc, 1)
        if glide < 0.3:
            rec["p"] = [round((a + b) / 2, 2 if a < -10 else 1) for a, b in zip(dew, bub)]
        else:
            rec["dew"] = [round(a, 2 if a < -10 else 1) for a in dew]
            rec["bubble"] = [round(b, 2 if b < -10 else 1) for b in bub]
        out["refrigerants"][name] = rec
        i40 = 40 - TMIN
        print(f"{name:12s} {len(dew):3d} pts  40°F dew {dew[i40]:7.1f}  bubble {bub[i40]:7.1f} psig")
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "pt.json").write_text(json.dumps(out, separators=(",", ":")))

    bake_glycol()
    print("wrote", DATA / "pt.json", (DATA / "pt.json").stat().st_size, "bytes")


# Freezing point (°F) every 5 weight % of glycol, 0–60 %, as printed in the Dow product information:
# "Typical Freezing and Boiling Points of DOWTHERM SR-1 Fluid" (ethylene glycol, Form 180-01312) and
# "... of DOWFROST HD Fluid" (propylene glycol, Form 180-01315). ASHRAE Fundamentals' glycol tables
# carry the same figures. Freeze (slush) point, not burst protection.
DOW_EG = [32.0, 29.4, 26.2, 22.2, 17.9, 12.7, 6.7, -0.2, -8.1, -17.5, -28.9, -42.0, -54.9]
DOW_PG = [32.0, 29.1, 26.1, 22.9, 19.2, 14.7, 9.2, 2.4, -6.0, -16.1, -28.3, -42.8, -59.9]


def bake_glycol():
    gly = {"meta": {"source": "Dow DOWTHERM SR-1 (EG) and DOWFROST HD (PG) typical freezing points, "
                              "5 % steps interpolated to 1 %",
                    "x": "mass fraction %", "freeze": "°F"}, "MEG": [], "MPG": []}
    for fl, tab in (("MEG", DOW_EG), ("MPG", DOW_PG)):
        for pct in range(0, 61):
            i, f = divmod(pct, 5)
            v = tab[i] if f == 0 else tab[i] + (tab[i + 1] - tab[i]) * f / 5
            gly[fl].append(round(v, 1))
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "glycol.json").write_text(json.dumps(gly, separators=(",", ":")))
    print("glycol 50%:", gly["MEG"][50], "°F (EG)", gly["MPG"][50], "°F (PG)")


if __name__ == "__main__":
    if "--glycol-only" in sys.argv:
        bake_glycol()
    else:
        main()
