// [plugin] jimcast-external-calculator/src/calc.ts
// Pure: no I/O, no eval. Recursive-descent arithmetic parser.
//
// A query counts as a "calculation" only if it contains a digit AND uses at
// least one binary operator or function call. "chrome", "42", "-5" and "(7)"
// never trigger it.

type Tok =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string };

const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

const FUNCS: Record<string, { min: number; max: number; fn: (a: number[]) => number }> = {
  sqrt:  { min: 1, max: 1, fn: (a) => Math.sqrt(a[0]) },
  abs:   { min: 1, max: 1, fn: (a) => Math.abs(a[0]) },
  sin:   { min: 1, max: 1, fn: (a) => Math.sin(a[0]) }, // radians
  cos:   { min: 1, max: 1, fn: (a) => Math.cos(a[0]) },
  tan:   { min: 1, max: 1, fn: (a) => Math.tan(a[0]) },
  asin:  { min: 1, max: 1, fn: (a) => Math.asin(a[0]) },
  acos:  { min: 1, max: 1, fn: (a) => Math.acos(a[0]) },
  atan:  { min: 1, max: 1, fn: (a) => Math.atan(a[0]) },
  ln:    { min: 1, max: 1, fn: (a) => Math.log(a[0]) },
  log:   { min: 1, max: 1, fn: (a) => Math.log10(a[0]) },
  log2:  { min: 1, max: 1, fn: (a) => Math.log2(a[0]) },
  exp:   { min: 1, max: 1, fn: (a) => Math.exp(a[0]) },
  floor: { min: 1, max: 1, fn: (a) => Math.floor(a[0]) },
  ceil:  { min: 1, max: 1, fn: (a) => Math.ceil(a[0]) },
  round: { min: 1, max: 1, fn: (a) => Math.round(a[0]) },
  min:   { min: 1, max: 99, fn: (a) => Math.min(...a) },
  max:   { min: 1, max: 99, fn: (a) => Math.max(...a) },
};

function tokenize(s: string): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = s.slice(i);

    let m = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(rest);
    if (m) { toks.push({ t: "num", v: parseFloat(m[0]) }); i += m[0].length; continue; }

    if (ch === "π") { toks.push({ t: "id", v: "pi" }); i++; continue; }
    m = /^[a-z][a-z0-9]*/i.exec(rest);
    if (m) { toks.push({ t: "id", v: m[0].toLowerCase() }); i += m[0].length; continue; }

    if (rest.startsWith("**")) { toks.push({ t: "op", v: "^" }); i += 2; continue; }
    if (ch === "×") { toks.push({ t: "op", v: "*" }); i++; continue; }
    if (ch === "÷") { toks.push({ t: "op", v: "/" }); i++; continue; }
    if ("+-*/%^(),".includes(ch)) { toks.push({ t: "op", v: ch }); i++; continue; }

    return null; // anything else (letters we don't know, symbols) → not math
  }
  return toks;
}

class ParseError extends Error {}

/** Returns the numeric result, or null if `raw` isn't a calculation. */
export function evaluateExpression(raw: string): number | null {
  const src = raw.trim().replace(/=+$/, "").trim(); // allow "2+2="
  if (!/\d/.test(src)) return null;
  const tokenized = tokenize(src);
  if (!tokenized || tokenized.length === 0) return null;
  const toks: Tok[] = tokenized;

  let pos = 0;
  let compound = false;
  const fail = (): never => { throw new ParseError(); };
  const isOp = (v: string) => { const t = toks[pos]; return t?.t === "op" && t.v === v; };

  function expr(): number {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const op = (toks[pos++] as { v: string }).v;
      const r = term();
      compound = true;
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  function term(): number {
    let v = unary();
    while (isOp("*") || isOp("/") || isOp("%")) {
      const op = (toks[pos++] as { v: string }).v;
      const r = unary();
      compound = true;
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  }

  // unary sits ABOVE power so that -2^2 = -(2^2) = -4
  function unary(): number {
    if (isOp("-")) { pos++; return -unary(); }
    if (isOp("+")) { pos++; return unary(); }
    return power();
  }

  function power(): number {
    const base = primary();
    if (isOp("^")) {
      pos++;
      const exp = unary(); // right-associative, allows 2^-3
      compound = true;
      return Math.pow(base, exp);
    }
    return base;
  }

  function primary(): number {
    const t = toks[pos];
    if (!t) return fail();
    if (t.t === "num") { pos++; return t.v; }
    if (t.t === "op" && t.v === "(") {
      pos++;
      const v = expr();
      if (!isOp(")")) fail();
      pos++;
      return v;
    }
    if (t.t === "id") {
      pos++;
      if (isOp("(")) {
        const f = FUNCS[t.v];
        if (!f) return fail();
        pos++;
        const args = [expr()];
        while (isOp(",")) { pos++; args.push(expr()); }
        if (!isOp(")")) fail();
        pos++;
        if (args.length < f.min || args.length > f.max) fail();
        compound = true;
        return f.fn(args);
      }
      if (t.v in CONSTS) return CONSTS[t.v];
      return fail();
    }
    return fail();
  }

  try {
    const v = expr();
    if (pos !== toks.length) return null;
    if (!compound || !Number.isFinite(v)) return null;
    return v;
  } catch (e) {
    if (e instanceof ParseError) return null;
    throw e;
  }
}

/** Plain, copy-friendly form: 12 significant digits, no grouping. */
export function formatRaw(n: number): string {
  return String(Number(n.toPrecision(12)));
}

/** Display form with thousands separators. */
export function formatDisplay(n: number): string {
  return Number(n.toPrecision(12)).toLocaleString("en-US", { maximumFractionDigits: 10 });
}
