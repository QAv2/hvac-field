"""Compare the baked PT tables (docs/data/pt.json) with published manufacturer charts
(research/pt-published.json, transcribed digits). Published charts disagree with each other by
1–3 psi, so a point passes within max(2.5 psi, 2 %).

Usage: python3 tools/check_pt.py      (exit 1 if any point is out of tolerance)
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
pt = json.loads((ROOT / "docs/data/pt.json").read_text())
pub = json.loads((ROOT / "research/pt-published.json").read_text())
t0 = pt["meta"]["t0"]

bad = 0
for ref, src in pub.items():
    if not isinstance(src, dict) or ref not in pt["refrigerants"]:
        continue
    r = pt["refrigerants"][ref]
    worst = 0.0
    rows = []
    for p in src.get("points") or []:
        i = p["F"] - t0
        for kind, key in (("bubble", "liquid_psig"), ("dew", "vapor_psig")):
            want = p.get(key)
            if want is None:
                continue
            col = r.get("p") or r.get(kind)
            if i >= len(col):
                continue
            got = col[i]
            d = got - want
            tol = max(2.5, 0.02 * abs(want))
            worst = max(worst, abs(d) / tol)
            if abs(d) > tol:
                bad += 1
                rows.append(f"    {p['F']:>4} °F {kind:6s} baked {got:7.1f}  chart {want:7.1f}  Δ {d:+.1f}")
    print(f"{ref:8s} worst {worst * 100:4.0f}% of tolerance  ({src.get('source', '')[:50]})")
    for x in rows:
        print(x)
print("PT check:", "OK" if not bad else f"{bad} point(s) out of tolerance")
sys.exit(1 if bad else 0)
