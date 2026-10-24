// Formula columns (database components step 6, CellEditors.dc.html). A small expression language evaluated per row,
// with no eval: numbers, "strings", true/false, + - * / %, comparisons, and / or / not, and the functions below.
// prop("Column name") reads a value from the row: numbers, dates (Date), booleans, or text.

const FNS = {
  prop: { args: 1, help: 'prop("Column")' },
  now: { args: 0, help: 'now()' },
  today: { args: 0, help: 'today()' },
  dateBetween: { args: 3, help: 'dateBetween(a, b, "days")' },
  dateAdd: { args: 3, help: 'dateAdd(date, 7, "days")' },
  if: { args: 3, help: 'if(test, a, b)' },
  round: { args: [1, 2], help: 'round(n, places)' },
  floor: { args: 1, help: 'floor(n)' },
  ceil: { args: 1, help: 'ceil(n)' },
  abs: { args: 1, help: 'abs(n)' },
  min: { args: [1, 99], help: 'min(a, b)' },
  max: { args: [1, 99], help: 'max(a, b)' },
  concat: { args: [1, 99], help: 'concat(a, b)' },
  length: { args: 1, help: 'length(text)' },
  contains: { args: 2, help: 'contains(text, part)' },
  empty: { args: 1, help: 'empty(value)' },
  toNumber: { args: 1, help: 'toNumber(text)' },
  lower: { args: 1, help: 'lower(text)' },
  upper: { args: 1, help: 'upper(text)' }
};
export const FORMULA_FUNCTIONS = Object.keys(FNS).filter((k) => k !== 'prop').map((k) => FNS[k].help);

class FormulaError extends Error {}
const fail = (msg) => { throw new FormulaError(msg); };

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) fail('Unexpected "' + ch + '"');
      out.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== ch) { if (src[j] === '\\' && j + 1 < src.length) j++; s += src[j]; j++; }
      if (j >= src.length) fail('A text value is missing its closing quote');
      out.push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '>=', '<=', '&&', '||'].indexOf(two) >= 0) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/%()<>,!'.indexOf(ch) >= 0) { out.push({ t: 'op', v: ch }); i++; continue; }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      const w = m[0];
      if (w === 'and') out.push({ t: 'op', v: '&&' });
      else if (w === 'or') out.push({ t: 'op', v: '||' });
      else if (w === 'not') out.push({ t: 'op', v: '!' });
      else if (w === 'true' || w === 'false') out.push({ t: 'bool', v: w === 'true' });
      else out.push({ t: 'id', v: w });
      i += w.length;
      continue;
    }
    fail('Unexpected "' + ch + '"');
  }
  return out;
}

// Recursive descent to a small tree: { k: 'lit', v } | { k: 'un', op, a } | { k: 'bin', op, a, b } | { k: 'call', fn, args }.
function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
  const take = (v) => { if (!isOp(v)) fail('Expected "' + v + '"'); p++; };
  const level = (ops, next) => () => {
    let a = next();
    while (peek() && peek().t === 'op' && ops.indexOf(peek().v) >= 0) { const op = toks[p++].v; a = { k: 'bin', op, a, b: next() }; }
    return a;
  };
  let expr;
  const primary = () => {
    const tk = toks[p++];
    if (!tk) fail('The formula ends too early');
    if (tk.t === 'num' || tk.t === 'str' || tk.t === 'bool') return { k: 'lit', v: tk.v };
    if (tk.t === 'op' && tk.v === '(') { const e = expr(); take(')'); return e; }
    if (tk.t === 'id') {
      if (!FNS[tk.v]) fail('Unknown function ' + tk.v + '()');
      take('(');
      const args = [];
      if (!isOp(')')) { args.push(expr()); while (isOp(',')) { p++; args.push(expr()); } }
      take(')');
      const want = FNS[tk.v].args;
      const [lo, hi] = Array.isArray(want) ? want : [want, want];
      if (args.length < lo || args.length > hi) fail(tk.v + '() takes ' + (lo === hi ? lo : lo + ' to ' + hi) + ' value' + (hi === 1 ? '' : 's'));
      return { k: 'call', fn: tk.v, args };
    }
    fail('Unexpected "' + tk.v + '"');
    return null;
  };
  const unary = () => {
    if (isOp('-') || isOp('!')) { const op = toks[p++].v; return { k: 'un', op, a: unary() }; }
    return primary();
  };
  const mul = level(['*', '/', '%'], unary);
  const add = level(['+', '-'], mul);
  const cmp = level(['==', '!=', '>', '<', '>=', '<='], add);
  const and = level(['&&'], cmp);
  expr = level(['||'], and);
  const tree = expr();
  if (p < toks.length) fail('Unexpected "' + toks[p].v + '"');
  return tree;
}

const DAY = 86400000;
const UNIT = { minutes: 60000, hours: 3600000, days: DAY, weeks: 7 * DAY };
const isDate = (v) => v instanceof Date;
const truthy = (v) => !(v === false || v == null || v === '' || v === 0 || (typeof v === 'number' && isNaN(v)));
const num = (v) => (isDate(v) ? v.getTime() : typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' ? v : v == null || v === '' ? 0 : parseFloat(v));

function run(n, get, now) {
  if (n.k === 'lit') return n.v;
  if (n.k === 'un') { const a = run(n.a, get, now); return n.op === '-' ? -num(a) : !truthy(a); }
  if (n.k === 'bin') {
    if (n.op === '&&') return truthy(run(n.a, get, now)) && truthy(run(n.b, get, now));
    if (n.op === '||') return truthy(run(n.a, get, now)) || truthy(run(n.b, get, now));
    const a = run(n.a, get, now), b = run(n.b, get, now);
    switch (n.op) {
      case '+': return typeof a === 'string' || typeof b === 'string' ? String(a == null ? '' : a) + String(b == null ? '' : b) : num(a) + num(b);
      case '-': return num(a) - num(b);
      case '*': return num(a) * num(b);
      case '/': return num(b) === 0 ? fail('Division by zero') : num(a) / num(b);
      case '%': return num(a) % num(b);
      case '==': return isDate(a) || isDate(b) ? num(a) === num(b) : a === b || (a != null && b != null && String(a) === String(b));
      case '!=': return !(isDate(a) || isDate(b) ? num(a) === num(b) : a === b || (a != null && b != null && String(a) === String(b)));
      case '>': return num(a) > num(b);
      case '<': return num(a) < num(b);
      case '>=': return num(a) >= num(b);
      case '<=': return num(a) <= num(b);
      default: return fail('Unknown operator ' + n.op);
    }
  }
  const A = (i) => run(n.args[i], get, now);
  switch (n.fn) {
    case 'prop': return get(String(A(0)));
    case 'now': return new Date(now.getTime());
    case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'dateBetween': {
      const a = A(0), b = A(1), u = String(A(2));
      if (!isDate(a) || !isDate(b)) return null;
      if (u === 'months') return (a.getFullYear() - b.getFullYear()) * 12 + a.getMonth() - b.getMonth();
      if (u === 'years') return a.getFullYear() - b.getFullYear();
      if (!UNIT[u]) fail('dateBetween() units: minutes, hours, days, weeks, months or years');
      // Whole days between calendar dates, so a date tomorrow is 1 at any hour today.
      if (u === 'days' || u === 'weeks') {
        const d = Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()) - new Date(b.getFullYear(), b.getMonth(), b.getDate())) / DAY);
        return u === 'days' ? d : Math.trunc(d / 7);
      }
      return Math.trunc((a - b) / UNIT[u]);
    }
    case 'dateAdd': {
      const d = A(0), k = num(A(1)), u = String(A(2));
      if (!isDate(d)) return null;
      const x = new Date(d.getTime());
      if (u === 'months') x.setMonth(x.getMonth() + k);
      else if (u === 'years') x.setFullYear(x.getFullYear() + k);
      else if (UNIT[u]) x.setTime(x.getTime() + k * UNIT[u]);
      else fail('dateAdd() units: minutes, hours, days, weeks, months or years');
      return x;
    }
    case 'if': return truthy(A(0)) ? A(1) : A(2);
    case 'round': { const f = Math.pow(10, n.args.length > 1 ? num(A(1)) : 0); return Math.round(num(A(0)) * f) / f; }
    case 'floor': return Math.floor(num(A(0)));
    case 'ceil': return Math.ceil(num(A(0)));
    case 'abs': return Math.abs(num(A(0)));
    case 'min': return Math.min.apply(null, n.args.map((_, i) => num(A(i))));
    case 'max': return Math.max.apply(null, n.args.map((_, i) => num(A(i))));
    case 'concat': return n.args.map((_, i) => { const v = A(i); return v == null ? '' : String(v); }).join('');
    case 'length': { const v = A(0); return v == null ? 0 : String(v).length; }
    case 'contains': return String(A(0) == null ? '' : A(0)).toLowerCase().indexOf(String(A(1)).toLowerCase()) >= 0;
    case 'empty': { const v = A(0); return v == null || v === '' || (Array.isArray(v) && !v.length); }
    case 'toNumber': { const v = parseFloat(A(0)); return isNaN(v) ? null : v; }
    case 'lower': return String(A(0) == null ? '' : A(0)).toLowerCase();
    case 'upper': return String(A(0) == null ? '' : A(0)).toUpperCase();
    default: return fail('Unknown function ' + n.fn + '()');
  }
}

// Compiles once; the result evaluates a row. get(name) returns that column's value, or undefined if there is none.
export function compileFormula(src) {
  const text = (src || '').trim();
  if (!text) return { ok: true, empty: true, run: () => ({ value: null }) };
  let tree;
  try { tree = parse(text); } catch (err) { return { ok: false, error: err.message, run: () => ({ error: err.message }) }; }
  return {
    ok: true,
    run: (get, now) => {
      try {
        const missing = [];
        const value = run(tree, (name) => { const v = get(name); if (v === undefined) missing.push(name); return v === undefined ? null : v; }, now || new Date());
        if (missing.length) return { error: 'No column named ' + missing[0] };
        return { value: typeof value === 'number' && !isFinite(value) ? null : value };
      } catch (err) { return { error: err instanceof FormulaError ? err.message : 'This formula could not run' }; }
    }
  };
}
