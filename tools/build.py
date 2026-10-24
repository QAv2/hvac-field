"""Compile the knowledge base: kb/*.yaml → docs/data/kb.json, with structural checks.

Usage: python3 tools/build.py            (then: node tools/check.mjs for the deep checks + tests)
       python3 tools/build.py --only boiler-oil.yaml --out .lane/blr
         builds just that module on top of the shared ones (systems, common, vc-core) into its own
         folder, so several people (or agents) can work on different modules at once.
Also compiles tests/scenarios/*.yaml → tests/scenarios.json for the test runner.
Exit code 1 on any error, with every problem listed (file, item id, what's wrong).
"""
import hashlib, json, re, sys, time
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parent.parent
KB = ROOT / "kb"
OUT = ROOT / "docs" / "data" / "kb.json"

PRIORS = {"very_common", "common", "occasional", "uncommon", "rare"}
NEEDS = {"gauges", "meter", "clamp", "combustion", "manometer", "thermometer", "probe", "refractometer",
         "shutdown", "ladder", "panel", "tools", "hydrometer"}
SIGN = re.compile(r"^([a-z0-9_]+(?:\|[a-z0-9_]+)*)([!?]?)$")
ID = re.compile(r"^[a-z][a-z0-9]*\.[a-z0-9_.]+$")
LISTS = ("systems", "context", "features", "inputs", "measures", "causes", "synonyms", "refs")
BASE = ("systems.yaml", "common.yaml", "vc-core.yaml", "synonyms.yaml")


def arg(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None


ONLY = [x.strip() for x in arg("--only").split(",")] if arg("--only") else None
OUTDIR = Path(arg("--out")).resolve() if arg("--out") else None
# build from a copy of the sources (e.g. a lane working on a frozen snapshot): --kb-dir and --scen-dir
if arg("--kb-dir"):
    KB = Path(arg("--kb-dir")).resolve()
SCEN = Path(arg("--scen-dir")).resolve() if arg("--scen-dir") else ROOT / "tests" / "scenarios"

errors = []


class Loader(yaml.SafeLoader):
    """YAML 1.2 booleans: only true/false. yes/no/on/off stay strings, because they are everyday
    state names here (a fan is 'off', a leak is 'yes')."""


Loader.yaml_implicit_resolvers = {k: [r for r in v if r[0] != "tag:yaml.org,2002:bool"]
                                  for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
Loader.add_implicit_resolver("tag:yaml.org,2002:bool", re.compile(r"^(?:true|True|TRUE|false|False|FALSE)$"), list("tTfF"))


def err(where, msg):
    errors.append(f"{where}: {msg}")


def load():
    merged = {k: [] for k in LISTS}
    modules = []
    for path in sorted(KB.glob("*.yaml")):
        if ONLY and path.name not in ONLY and path.name not in BASE:
            continue
        try:
            doc = yaml.load(path.read_text(), Loader=Loader) or {}
        except yaml.YAMLError as e:
            err(path.name, f"YAML error: {e}")
            continue
        modules.append({"file": path.name, "module": doc.get("module", path.stem), "title": doc.get("title", "")})
        for k in LISTS:
            items = doc.get(k) or []
            if not isinstance(items, list):
                err(path.name, f"`{k}` must be a list")
                continue
            for it in items:
                if isinstance(it, dict):
                    it["_file"] = path.name
                merged[k].append(it)
        extra = set(doc) - set(LISTS) - {"module", "title", "notes"}
        if extra:
            err(path.name, f"unknown top-level keys: {sorted(extra)}")
    return merged, modules


def where(it):
    return f"{it.get('_file', '?')} [{it.get('id', '?')}]"


def check(kb):
    systems = {s["id"]: s for s in kb["systems"]}
    for s in kb["systems"]:
        if s.get("parent") and s["parent"] not in systems:
            err(where(s), f"parent {s['parent']} is not a system")

    def check_systems(it):
        for t in it.get("systems") or []:
            if t != "*" and t not in systems:
                err(where(it), f"unknown system {t}")
        if not it.get("systems"):
            err(where(it), "needs `systems` (use ['*'] for everything)")

    ctx = {}
    for c in kb["context"]:
        opts = []
        for o in c.get("options") or []:
            opts.append(str(o["id"]) if isinstance(o, dict) else str(o))
        ctx[c["id"]] = set(opts)
        if not c.get("ask"):
            err(where(c), "context question needs `ask`")
        if c.get("kind") != "refrigerant" and not opts:
            err(where(c), "context question needs `options`")
        check_systems(c)

    def check_cond(it, cond, label):
        if not isinstance(cond, dict):
            err(where(it), f"{label} must be a map of context id → value(s)")
            return
        for k, v in cond.items():
            if k not in ctx:
                err(where(it), f"{label}: unknown context question {k}")
                continue
            if ctx[k]:
                for x in v if isinstance(v, list) else [v]:
                    if str(x) not in ctx[k]:
                        err(where(it), f"{label}: {k} has no option {x!r} (options: {sorted(ctx[k])})")

    seen = {}
    for kind in ("features", "inputs", "measures", "causes"):
        for it in kb[kind]:
            i = it.get("id")
            if not i or not ID.match(str(i)):
                err(where(it), f"{kind[:-1]} id must look like 'module.name' (lowercase)")
                continue
            if (kind, i) in seen:
                err(where(it), f"duplicate {kind[:-1]} id (also in {seen[(kind, i)]})")
            seen[(kind, i)] = it.get("_file")

    feats = {}
    for f in kb["features"]:
        st = f.get("states")
        if not isinstance(st, dict) or len(st) < 2:
            err(where(f), "feature needs `states`: a map of at least two state ids → labels")
            continue
        for s in st:
            if not re.match(r"^[a-z0-9_]+$", str(s)):
                err(where(f), f"state id {s!r} must be lowercase letters, digits, _")
        feats[f["id"]] = set(map(str, st))
        if f.get("normal") is not None and str(f["normal"]) not in feats[f["id"]]:
            err(where(f), f"normal state {f['normal']} is not one of its states")
        if not f.get("name"):
            err(where(f), "feature needs `name`")
        if not f.get("ask") and f.get("ask") is not False:
            err(where(f), "feature needs `ask` (the question, as the next-check card shows it)")
        c = f.get("cost", 2)
        if not isinstance(c, (int, float)) or not 1 <= c <= 5:
            err(where(f), "cost must be 1–5")
        if f.get("needs") and f["needs"] not in NEEDS:
            err(where(f), f"needs {f['needs']!r} not in {sorted(NEEDS)}")
        if f.get("base"):
            if set(map(str, f["base"])) - feats[f["id"]]:
                err(where(f), "base names a state the feature doesn't have")
        check_systems(f)
        if f.get("requires"):
            check_cond(f, f["requires"], "requires")
    for f in kb["features"]:
        for key in ("ask_if", "ask_unless"):
            for fid, states in (f.get(key) or {}).items():
                if fid not in feats:
                    err(where(f), f"{key} names unknown feature {fid}")
                    continue
                for s in states if isinstance(states, list) else [states]:
                    if str(s) not in feats[fid]:
                        err(where(f), f"{key}: {fid} has no state {s}")

    def check_sign(it, fid, spec, label):
        if fid not in feats:
            err(where(it), f"{label}: unknown feature {fid}")
            return
        if isinstance(spec, dict):
            for s, v in spec.items():
                if str(s) not in feats[fid]:
                    err(where(it), f"{label}: {fid} has no state {s}")
                if not isinstance(v, (int, float)) or v < 0:
                    err(where(it), f"{label}: weight for {fid}.{s} must be a number ≥ 0")
            return
        m = SIGN.match(str(spec).strip())
        if not m:
            err(where(it), f"{label}: can't read sign {spec!r} for {fid}")
            return
        for s in m.group(1).split("|"):
            if s not in feats[fid]:
                err(where(it), f"{label}: {fid} has no state {s!r} (states: {sorted(feats[fid])})")

    for c in kb["causes"]:
        if not c.get("name"):
            err(where(c), "cause needs `name`")
        if c.get("prior") not in PRIORS:
            err(where(c), f"prior must be one of {sorted(PRIORS)}")
        if not c.get("fix"):
            err(where(c), "cause needs `fix` (what to do about it)")
        check_systems(c)
        signs = c.get("signs") or {}
        if len(signs) < 2:
            err(where(c), "cause needs at least two `signs`")
        for fid, spec in signs.items():
            check_sign(c, fid, spec, "signs")
        for w in c.get("when") or []:
            check_cond(c, w.get("if") or {}, "when.if")
            for fid, spec in (w.get("signs") or {}).items():
                check_sign(c, fid, spec, "when.signs")
        if c.get("requires"):
            check_cond(c, c["requires"], "requires")
        for r in c.get("refs") or []:
            if r not in {x["id"] for x in kb["refs"]}:
                err(where(c), f"unknown ref {r}")

    inputs = {i["id"] for i in kb["inputs"]}
    for i in kb["inputs"]:
        if not i.get("name") or not i.get("unit"):
            err(where(i), "input needs `name` and `unit`")
        check_systems(i)
        if i.get("requires"):
            check_cond(i, i["requires"], "requires")
    for m in kb["measures"]:
        check_systems(m)
        if not m.get("value"):
            err(where(m), "measure needs `value`")
        if m.get("sets"):
            if m["sets"] not in feats:
                err(where(m), f"sets unknown feature {m['sets']}")
            st = m.get("states")
            if not isinstance(st, list) or not st:
                err(where(m), "a measure that sets a feature needs `states`: a list of [state, condition]")
            else:
                for pair in st:
                    if not (isinstance(pair, list) and len(pair) == 2):
                        err(where(m), f"states entry {pair!r} must be [state, condition]")
                    elif m["sets"] in feats and str(pair[0]) not in feats[m["sets"]]:
                        err(where(m), f"state {pair[0]} is not a state of {m['sets']}")
        if m.get("requires"):
            check_cond(m, m["requires"], "requires")
    for s in kb["synonyms"]:
        if not (isinstance(s, list) and len(s) >= 2 and all(isinstance(x, str) for x in s)):
            err("synonyms", f"each synonym group must be a list of 2+ strings: {s!r}")
    return feats, inputs


def scenarios():
    out = []
    for path in sorted(SCEN.glob("*.yaml")):
        if ONLY and path.name not in ONLY:
            continue
        try:
            docs = yaml.load(path.read_text(), Loader=Loader) or []
        except yaml.YAMLError as e:
            err(path.name, f"YAML error: {e}")
            continue
        for d in docs:
            d["_file"] = path.name
            out.append(d)
    dest = (OUTDIR / "scenarios.json") if OUTDIR else (ROOT / "tests" / "scenarios.json")
    dest.write_text(json.dumps(out, indent=1))
    return out


def stamp():
    """Write the offline cache list and a content hash into docs/sw.js."""
    docs = ROOT / "docs"
    files = sorted(p for p in docs.rglob("*")
                   if p.is_file() and p.name not in ("sw.js", "field-dx-standalone.html") and not p.name.startswith("."))
    h = hashlib.sha256()
    for p in files:
        h.update(p.relative_to(docs).as_posix().encode())
        h.update(p.read_bytes())
    assets = ["./"] + [p.relative_to(docs).as_posix() for p in files]
    sw = (docs / "sw.js").read_text()
    sw = re.sub(r"const VERSION = '[^']*';", f"const VERSION = '{h.hexdigest()[:10]}';", sw)
    sw = re.sub(r"const ASSETS = \[[^\]]*\];", "const ASSETS = " + json.dumps(assets) + ";", sw, flags=re.S)
    (docs / "sw.js").write_text(sw)
    return h.hexdigest()[:10], len(assets)


def bundle_standalone():
    """Emit docs/field-dx-standalone.html: a zero-dependency single-file edition that runs over file://."""
    docs = ROOT / "docs"
    css = (docs / "css" / "app.css").read_text()
    data = {
        "kb": json.loads((docs / "data" / "kb.json").read_text()),
        "pt": json.loads((docs / "data" / "pt.json").read_text()),
        "glycol": json.loads((docs / "data" / "glycol.json").read_text()),
        "charging": json.loads((docs / "data" / "charging.json").read_text()),
    }
    order = ["kb", "engine", "expr", "calcs", "measure", "search", "tools", "main"]
    chunks = ["window.__FDX_INLINE_DATA__ = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";"]
    for mod in order:
        src = (docs / "js" / f"{mod}.js").read_text()
        exports = []
        lines = []
        for line in src.splitlines():
            m_star = re.match(r"^\s*import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s+'\.\/([a-z0-9_-]+)\.js';?\s*$", line)
            if m_star:
                lines.append(f"const {m_star.group(1)} = __mod_{m_star.group(2)};")
                continue
            m_named = re.match(r"^\s*import\s+\{([^}]+)\}\s+from\s+'\.\/([a-z0-9_-]+)\.js';?\s*$", line)
            if m_named:
                lines.append(f"const {{{m_named.group(1)}}} = __mod_{m_named.group(2)};")
                continue
            m_exp = re.match(r"^(\s*)export\s+(const|let|var|function|class)\s+([A-Za-z0-9_$]+)(.*)$", line)
            if m_exp:
                exports.append(m_exp.group(3))
                lines.append(f"{m_exp.group(1)}{m_exp.group(2)} {m_exp.group(3)}{m_exp.group(4)}")
                continue
            lines.append(line)
        if exports:
            lines.append(f"return {{ {', '.join(exports)} }};")
        chunks.append(f"const __mod_{mod} = (() => {{\n" + "\n".join(lines) + "\n})();")
    js_bundle = "\n".join(chunks)
    html = (docs / "index.html").read_text()
    html = re.sub(r'<link rel="manifest"[^>]*>\n?', "", html)
    html = re.sub(r'<link rel="icon"[^>]*>\n?', "", html)
    html = re.sub(r'<link rel="apple-touch-icon"[^>]*>\n?', "", html)
    html = html.replace('<link rel="stylesheet" href="css/app.css">', f"<style>\n{css}\n</style>")
    html = html.replace('<script type="module" src="js/main.js"></script>', f"<script>\n{js_bundle}\n</script>")
    out_file = docs / "field-dx-standalone.html"
    out_file.write_text(html)
    return out_file


def main():
    if OUTDIR:
        OUTDIR.mkdir(parents=True, exist_ok=True)
    kb, modules = load()
    check(kb)
    sc = scenarios()
    if errors:
        print(f"{len(errors)} problem(s):", file=sys.stderr)
        for e in errors:
            print("  -", e, file=sys.stderr)
        sys.exit(1)
    kb["meta"] = {"built": time.strftime("%Y-%m-%d %H:%M"), "modules": modules,
                  "counts": {k: len(kb[k]) for k in LISTS}}
    for k in LISTS:
        for it in kb[k]:
            if isinstance(it, dict):
                it["module"] = it.pop("_file", None)
    out = (OUTDIR / "kb.json") if OUTDIR else OUT
    out.write_text(json.dumps(kb, ensure_ascii=False, separators=(",", ":")))
    if not OUTDIR:
        standalone = bundle_standalone()
        v, n = stamp()
        print(f"sw.js: version {v}, {n} files cached for offline use")
        print(f"standalone: {standalone} ({standalone.stat().st_size // 1024} KB)")
    c = kb["meta"]["counts"]
    print(f"kb.json: {c['causes']} causes, {c['features']} features, {c['measures']} measures, "
          f"{c['inputs']} inputs, {len(modules)} modules, {len(sc)} scenarios → {out} "
          f"({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
