// Small, safe expression language for the knowledge base: measures and targets are written as
// data ("vc.suction_line_f - tsat_dew(vc.suction_psig)") instead of code. No eval.
//
// Values are numbers, strings, booleans or null. Null means "not known yet" and propagates:
// arithmetic and comparisons with null give null, AND/OR/NOT use three-valued logic, and `a ?? b`
// falls back to b when a is null. Identifiers may contain dots (vc.suction_psig, ctx.metering).

const OPS = ['??', '||', '&&', '==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '!', '?', ':', '(', ')', ','];

function lex(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^\d*\.?\d+(?:[eE][-+]?\d+)?/.exec(src.slice(i));
      out.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === "'" || c === '"') {
      const j = src.indexOf(c, i + 1);
      if (j < 0) throw new SyntaxError(`unclosed string in: ${src}`);
      out.push({ t: 'str', v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
      const w = m[0];
      if (w === 'true' || w === 'false') out.push({ t: 'bool', v: w === 'true' });
      else if (w === 'null') out.push({ t: 'null' });
      else out.push({ t: 'id', v: w });
      i += w.length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new SyntaxError(`unexpected "${c}" in: ${src}`);
    out.push({ t: 'op', v: op });
    i += op.length;
  }
  out.push({ t: 'end' });
  return out;
}

// binding powers for the Pratt parser
const BP = { '??': 2, '||': 3, '&&': 4, '==': 5, '!=': 5, '<': 6, '<=': 6, '>': 6, '>=': 6, '+': 7, '-': 7, '*': 8, '/': 8 };

export function parse(src) {
  const toks = lex(String(src));
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expect = (v) => {
    const k = next();
    if (k.t !== 'op' || k.v !== v) throw new SyntaxError(`expected "${v}" in: ${src}`);
  };
  function primary() {
    const k = next();
    if (k.t === 'num' || k.t === 'str' || k.t === 'bool') return { k: 'lit', v: k.v };
    if (k.t === 'null') return { k: 'lit', v: null };
    if (k.t === 'id') {
      if (peek().t === 'op' && peek().v === '(') {
        next();
        const args = [];
        if (!(peek().t === 'op' && peek().v === ')')) {
          for (;;) {
            args.push(expr(0));
            if (peek().t === 'op' && peek().v === ',') { next(); continue; }
            break;
          }
        }
        expect(')');
        return { k: 'call', f: k.v, args };
      }
      return { k: 'id', v: k.v };
    }
    if (k.t === 'op' && k.v === '(') { const e = expr(0); expect(')'); return e; }
    if (k.t === 'op' && (k.v === '-' || k.v === '!')) return { k: 'un', op: k.v, a: expr(9) };
    throw new SyntaxError(`unexpected token in: ${src}`);
  }
  function expr(minBp) {
    let left = primary();
    for (;;) {
      const k = peek();
      if (k.t !== 'op') break;
      if (k.v === '?') {
        if (minBp > 1) break;
        next();
        const a = expr(0);
        expect(':');
        const b = expr(1);
        left = { k: 'tern', c: left, a, b };
        continue;
      }
      const bp = BP[k.v];
      if (!bp || bp <= minBp) break;
      next();
      left = { k: 'bin', op: k.v, a: left, b: expr(bp) };
    }
    return left;
  }
  const ast = expr(0);
  if (peek().t !== 'end') throw new SyntaxError(`trailing input in: ${src}`);
  return ast;
}

const isNull = (v) => v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v));

// Builtins that propagate null (any null argument gives null). Domain functions such as the
// refrigerant PT lookups are added by calcs.js through `register`.
const FN = {
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  abs: (x) => Math.abs(x),
  round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  clamp: (x, lo, hi) => Math.min(hi, Math.max(lo, x)),
};
// Builtins that see nulls themselves.
const FN_NULLSAFE = {
  has: (x) => !isNull(x),
  coalesce: (...a) => { for (const x of a) if (!isNull(x)) return x; return null; },
};

export function register(name, fn, nullSafe = false) {
  (nullSafe ? FN_NULLSAFE : FN)[name] = fn;
}

export const knownFunction = (name) => name in FN || name in FN_NULLSAFE;

function ev(n, env) {
  switch (n.k) {
    case 'lit': return n.v;
    case 'id': { const v = env(n.v); return isNull(v) ? null : v; }
    case 'un': {
      const a = ev(n.a, env);
      if (isNull(a)) return null;
      return n.op === '-' ? -a : !a;
    }
    case 'tern': {
      const c = ev(n.c, env);
      if (isNull(c)) return null;
      return c ? ev(n.a, env) : ev(n.b, env);
    }
    case 'call': {
      const args = n.args.map((a) => ev(a, env));
      if (n.f in FN_NULLSAFE) return FN_NULLSAFE[n.f](...args);
      const f = FN[n.f];
      if (!f) throw new ReferenceError(`unknown function ${n.f}()`);
      if (args.some(isNull)) return null;
      const r = f(...args);
      return isNull(r) ? null : r;
    }
    case 'bin': {
      if (n.op === '??') { const a = ev(n.a, env); return isNull(a) ? ev(n.b, env) : a; }
      if (n.op === '&&') {
        const a = ev(n.a, env);
        if (a === false) return false;
        const b = ev(n.b, env);
        if (b === false) return false;
        return isNull(a) || isNull(b) ? null : Boolean(b);
      }
      if (n.op === '||') {
        const a = ev(n.a, env);
        if (a === true) return true;
        const b = ev(n.b, env);
        if (b === true) return true;
        return isNull(a) || isNull(b) ? null : Boolean(a) || Boolean(b);
      }
      const a = ev(n.a, env), b = ev(n.b, env);
      if (isNull(a) || isNull(b)) return null;
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? null : a / b;
        case '<': return a < b;
        case '<=': return a <= b;
        case '>': return a > b;
        case '>=': return a >= b;
        case '==': return a === b;
        case '!=': return a !== b;
      }
    }
  }
  throw new Error(`bad node ${n.k}`);
}

const cache = new Map();
export function compile(src) {
  let ast = cache.get(src);
  if (!ast) { ast = parse(src); cache.set(src, ast); }
  return ast;
}

// env: a function name → value (null when unknown)
export function evaluate(src, env) {
  const v = ev(compile(src), env);
  return isNull(v) ? null : v;
}

// identifiers and function names an expression uses (for validation)
export function refs(src) {
  const ids = new Set(), fns = new Set();
  (function walk(n) {
    if (n.k === 'id') ids.add(n.v);
    else if (n.k === 'call') { fns.add(n.f); n.args.forEach(walk); }
    else if (n.k === 'un') walk(n.a);
    else if (n.k === 'bin') { walk(n.a); walk(n.b); }
    else if (n.k === 'tern') { walk(n.c); walk(n.a); walk(n.b); }
  })(compile(src));
  return { ids, fns };
}
