// css-ast: single-pass state machine over raw CSS text.
//
// Tracks quote / paren / brace depth inline while walking, so `:`, `;`, `,`,
// `{`, `}` inside strings or function-call arguments are never treated as
// structural characters. Emits a Node tree with rules[] and children[] plus
// each child's raw_selector text.

export interface RuleEntry {
  name: string;
  value: string;
}

export class Node {
  children: Node[];
  rules: RuleEntry[];
  start: number;
  end: number;
  raw: string;
  raw_selector: string | undefined;
  parent: Node | undefined;

  constructor(init: {
    children?: Node[];
    rules?: RuleEntry[];
    start?: number;
    end?: number;
    raw?: string;
    parent?: Node;
  }) {
    this.children = init.children ?? [];
    this.rules = init.rules ?? [];
    this.start = init.start ?? -1;
    this.end = init.end ?? -1;
    this.raw = init.raw ?? '';
    this.raw_selector = undefined;
    this.parent = init.parent;
  }
}

// Strip `/* ... */` comments before parsing. Handling them inline in the main
// walk would add branches to the hot path; one upfront pass is simpler and
// cheaper. Quote state is respected so a literal `/*` inside `content: '...'`
// survives.
function stripComments(src: string): string {
  const len = src.length;
  let out = '';
  let i = 0;
  let quote = 0;
  while (i < len) {
    const c = src.charCodeAt(i);
    if (quote) {
      out += src[i];
      if (c === 92 /* \ */ && i + 1 < len) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (c === quote) quote = 0;
      i++;
      continue;
    }
    if (c === 34 || c === 39 /* " or ' */) {
      quote = c;
      out += src[i];
      i++;
      continue;
    }
    if (c === 47 /* / */ && i + 1 < len && src.charCodeAt(i + 1) === 42 /* * */) {
      i += 2;
      while (i < len) {
        if (src.charCodeAt(i) === 42 && i + 1 < len && src.charCodeAt(i + 1) === 47) {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

// Locate the matching `}` for the `{` at index `open` in `src`, respecting
// quote and nested brace depth. Returns index of the close brace, or -1 if
// unbalanced.
function findMatchingBrace(src: string, open: number): number {
  const len = src.length;
  let depth = 1;
  let quote = 0;
  for (let i = open + 1; i < len; i++) {
    const c = src.charCodeAt(i);
    if (quote) {
      if (c === 92 && i + 1 < len) {
        i++;
        continue;
      }
      if (c === quote) quote = 0;
      continue;
    }
    if (c === 34 || c === 39) {
      quote = c;
      continue;
    }
    if (c === 123 /* { */) depth++;
    else if (c === 125 /* } */) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// NUL byte never appears in valid CSS — used to mark child-block positions
// inside the flattened body without risking collision with input text (which
// contains real whitespace, colons, commas etc).
const SENTINEL = '\0';

// Split a rule body into top-level `;`-separated chunks, respecting quotes
// and parens.
function splitStatements(body: string): string[] {
  const out: string[] = [];
  const len = body.length;
  let depth = 0;
  let quote = 0;
  let start = 0;
  for (let i = 0; i < len; i++) {
    const c = body.charCodeAt(i);
    if (quote) {
      if (c === 92 && i + 1 < len) {
        i++;
        continue;
      }
      if (c === quote) quote = 0;
      continue;
    }
    if (c === 34 || c === 39) {
      quote = c;
      continue;
    }
    if (c === 40 /* ( */) depth++;
    else if (c === 41 /* ) */) depth--;
    else if (c === 59 /* ; */ && depth === 0) {
      const s = body.slice(start, i).trim();
      if (s) out.push(s);
      start = i + 1;
    }
  }
  const tail = body.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

// Split one statement on its FIRST `:` at paren-depth 0, outside quotes.
function splitOnFirstColon(s: string): [string, string] | null {
  const len = s.length;
  let depth = 0;
  let quote = 0;
  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    if (quote) {
      if (c === 92 && i + 1 < len) {
        i++;
        continue;
      }
      if (c === quote) quote = 0;
      continue;
    }
    if (c === 34 || c === 39) {
      quote = c;
      continue;
    }
    if (c === 40) depth++;
    else if (c === 41) depth--;
    else if (c === 58 /* : */ && depth === 0) {
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    }
  }
  return null;
}

// Parse the body of a CSS block into `node.rules` + `node.children`.
function parseBody(raw: string, node: Node): void {
  const len = raw.length;
  let flat = '';
  let quote = 0;
  const childRaws: string[] = [];

  for (let i = 0; i < len; i++) {
    const c = raw.charCodeAt(i);
    if (quote) {
      flat += raw[i];
      if (c === 92 && i + 1 < len) {
        flat += raw[i + 1];
        i++;
      } else if (c === quote) {
        quote = 0;
      }
      continue;
    }
    if (c === 34 || c === 39) {
      quote = c;
      flat += raw[i];
      continue;
    }
    if (c === 123 /* { */) {
      const close = findMatchingBrace(raw, i);
      const inner = close >= 0 ? raw.slice(i + 1, close) : raw.slice(i + 1);
      childRaws.push(inner);
      // Append `;` after the sentinel so splitStatements treats adjacent
      // child blocks (`&:hover {...} &:focus {...}` — no `;` between them in
      // source) as separate statements.
      flat += SENTINEL + (childRaws.length - 1) + SENTINEL + ';';
      i = close >= 0 ? close : len;
      continue;
    }
    if (c === 125 /* } */) continue; // stray closer; skip
    flat += raw[i];
  }

  for (const stmt of splitStatements(flat)) {
    const sentIdx = stmt.indexOf(SENTINEL);
    if (sentIdx === -1) {
      const kv = splitOnFirstColon(stmt);
      if (!kv || !kv[0]) continue;
      node.rules.push({ name: kv[0], value: kv[1] });
      continue;
    }
    const selector = stmt.slice(0, sentIdx).trim();
    let j = sentIdx + 1;
    let idx = 0;
    while (j < stmt.length && stmt.charCodeAt(j) !== 0) {
      idx = idx * 10 + (stmt.charCodeAt(j) - 48);
      j++;
    }
    const childRaw = childRaws[idx];
    const child = new Node({ raw: childRaw, parent: node });
    child.raw_selector = selector;
    node.children.push(child);
    parseBody(childRaw, child);

    const tail = stmt.slice(j + 1).trim();
    if (tail) {
      const kv = splitOnFirstColon(tail);
      if (kv && kv[0]) node.rules.push({ name: kv[0], value: kv[1] });
    }
  }
}

export function toAST(raw: string): Node {
  const src = stripComments(raw);
  const root = new Node({ start: 0, end: src.length - 1, raw: src });
  parseBody(src, root);
  return root;
}
