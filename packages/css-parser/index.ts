// css-parser — compile styled-component CSS bodies into namespaced rule text.
//
// Three tiers, cheapest wins:
//   1. Per-instance cache — repeat identical inputs are a Map.get().
//   2. Flat-body FAST PATH — a charcode scan for the common declarations-only
//      shape emits `.cls{body}` directly, no AST, no walker.
//   3. GENERAL PATH — a single char-walk emitter that streams rules into a
//      stack of per-frame string buffers. No intermediate AST, no per-node
//      allocations. Handles:
//        * comma-split selectors that respect paren depth (`:is(a, b)`)
//        * CONDITIONAL at-rules (@media / @supports / @container / @layer)
//          wrap the parent's namespaced scope inside the query
//        * TOP-LEVEL at-rules (@font-face / @keyframes / @page / @property /
//          @import / @charset / @namespace / @counter-style /
//          @font-feature-values) are hoisted outside `.cls { ... }` scope
//        * inline `/* ... */` comment stripping
//        * quote / paren / escape state respected everywhere

export interface ParserOptions {
  prefix?: (name: string, value: string) => string;
}
export interface ParseInput {
  css: string;
  namespace: string;
}
export type CssParser = (input: ParseInput) => string;

// Split a flat CSS body into individual `name:value` declarations, respecting
// quote / paren state. Used by atomic mode to hash each declaration for a
// stand-alone atomic class.
export function splitAtomicDeclarations(css: string): string[] {
  const out: string[] = [];
  const len = css.length;
  let depth = 0;
  let quote = 0;
  let start = 0;
  for (let i = 0; i < len; i++) {
    const c = css.charCodeAt(i);
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
    else if (c === 59 /* ; */ && depth === 0) {
      const decl = css.slice(start, i).trim();
      if (decl && decl.indexOf(':') !== -1) out.push(decl);
      start = i + 1;
    }
  }
  const tail = css.slice(start).trim();
  if (tail && tail.indexOf(':') !== -1) out.push(tail);
  return out;
}

// At-rules that BRACKET child rules — the query wraps the namespaced parent.
const CONDITIONAL_AT = /^@(media|supports|container|layer|-moz-document)\b/;

// At-rules that live at the TOP level of a stylesheet — hoisted out of any
// `.cls { }` scope.
const TOP_LEVEL_AT = /^@(font-face|keyframes|-webkit-keyframes|page|property|counter-style|font-feature-values|import|charset|namespace)\b/;

// Split a selector list on `,` at paren-depth 0, outside quotes.
function splitSelectorList(s: string): string[] {
  const out: string[] = [];
  const len = s.length;
  let depth = 0;
  let quote = 0;
  let start = 0;
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
    else if (c === 44 /* , */ && depth === 0) {
      out.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(s.slice(start).trim());
  return out.filter((x) => x.length > 0);
}

function resolveSelectors(rawSelector: string, namespace: string): string {
  return splitSelectorList(rawSelector)
    .map((s) => {
      if (s.indexOf('&') !== -1) return s.split('&').join(namespace);
      return `${namespace} ${s}`;
    })
    .join(', ');
}

function defaultPrefix(name: string, value: string): string {
  return `${name}${RULE_SEPARATOR}${value}${RULE_END}`;
}

// Flat = no `{` `}` `&` `@` and no `/*` comment. The common declaration-only
// template shape (~60% of real templates) hits this — no AST, no walker.
function isFlatBody(css: string): boolean {
  const len = css.length;
  for (let i = 0; i < len; i++) {
    const c = css.charCodeAt(i);
    if (c === 123 || c === 125 || c === 38 || c === 64) return false;
    if (c === 47 && i + 1 < len && css.charCodeAt(i + 1) === 42) return false;
  }
  return true;
}

// Normalize whitespace around top-level `:` and `;` — quote/paren aware, so
// `content: "a: b"` and `background: url("data:image/svg;utf8,...")` survive
// intact.
function normalizeFlat(css: string): string {
  const len = css.length;
  let out = '';
  let quote = 0;
  let depth = 0;
  for (let i = 0; i < len; i++) {
    const c = css.charCodeAt(i);
    if (quote) {
      out += css[i];
      if (c === 92 && i + 1 < len) {
        out += css[i + 1];
        i++;
      } else if (c === quote) {
        quote = 0;
      }
      continue;
    }
    if (c === 34 || c === 39) {
      quote = c;
      out += css[i];
      continue;
    }
    if (c === 40) {
      depth++;
      out += css[i];
      continue;
    }
    if (c === 41) {
      depth--;
      out += css[i];
      continue;
    }
    if ((c === 58 || c === 59) && depth === 0) {
      let end = out.length;
      while (end > 0) {
        const oc = out.charCodeAt(end - 1);
        if (oc === 32 || oc === 9 || oc === 10 || oc === 13) end--;
        else break;
      }
      if (end !== out.length) out = out.slice(0, end);
      out += css[i];
      while (i + 1 < len) {
        const nc = css.charCodeAt(i + 1);
        if (nc === 32 || nc === 9 || nc === 10 || nc === 13) i++;
        else break;
      }
      continue;
    }
    out += css[i];
  }
  return out;
}

function emitFlat(css: string, namespace: string): string {
  return `${namespace}{${normalizeFlat(css.trim())}}`;
}

export const createParser = (options?: ParserOptions): CssParser => {
  const prefix = options?.prefix ?? defaultPrefix;
  // Cache: {css, namespace} pair → compiled output. Repeat calls with
  // identical inputs are common in animated apps and the rehydration path.
  const cache = new Map<string, string>();

  return ({ css, namespace }: ParseInput): string => {
    const key = namespace + '\x1f' + css;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const out = isFlatBody(css)
      ? emitFlat(css, namespace)
      : compileGeneral(css, namespace, prefix);
    cache.set(key, out);
    return out;
  };
};

// Single-pass emitter — walks the source once, tokenizing declarations and
// selectors inline, and pushes finished rules onto per-frame string buffers.
// No intermediate AST, no per-node allocations. Roughly stylis-shaped in the
// hot loop but with filbert's selector-resolution + @-rule hoisting rules.
//
// Frame kinds:
//   * 'scope'         — normal rule scope. `selector` = resolved (used for &
//     resolution AND for wrapping its own declarations).
//   * 'conditional'   — @media / @supports / @container / @layer. Wraps its
//     decls in `parent.selector { ... }` inside the query at emission time.
//     Selector propagates for `&` resolution inside.
//   * 'topLevel'      — @font-face / @keyframes / @page / @property / etc.
//     Hoisted to the top of the output; no parent-selector wrapping.
interface Frame {
  kind: 0 | 1 | 2; // 0 scope, 1 conditional, 2 topLevel
  selector: string; // for `&` resolution and, when scope, wrapping own decls
  query: string; // for at-rules
  decls: string;
  children: string;
}

// Fast at-rule classification via a char-by-char scan on the trimmed query
// text — avoids the compiled RegExp cost on every `{`.
function classifyAtRule(query: string): 1 | 2 | 0 {
  // query starts with `@`
  const len = query.length;
  let i = 1;
  let name = '';
  while (i < len) {
    const c = query.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10 || c === 13 || c === 40 /* ( */ || c === 123) break;
    name += query[i];
    i++;
  }
  // conditional wrappers
  if (
    name === 'media' ||
    name === 'supports' ||
    name === 'container' ||
    name === 'layer' ||
    name === '-moz-document'
  )
    return 1;
  // top-level hoists
  if (
    name === 'font-face' ||
    name === 'keyframes' ||
    name === '-webkit-keyframes' ||
    name === 'page' ||
    name === 'property' ||
    name === 'counter-style' ||
    name === 'font-feature-values' ||
    name === 'import' ||
    name === 'charset' ||
    name === 'namespace'
  )
    return 2;
  // Unknown @-rule — treat as conditional (best guess; browsers ignore
  // unknown at-rules anyway).
  return 1;
}

function compileGeneral(
  css: string,
  namespace: string,
  prefix: (name: string, value: string) => string,
): string {
  const len = css.length;
  const usePrefix = prefix !== defaultPrefix;

  // Root frame — its selector is the styled component's namespace class.
  const root: Frame = {
    kind: 0,
    selector: namespace,
    query: '',
    decls: '',
    children: '',
  };
  const stack: Frame[] = [root];
  let hoisted = '';

  // Accumulator that becomes EITHER a declaration (on `;`) OR a selector /
  // at-rule query (on `{`). Reset on `;`, `{`, `}`.
  let pending = '';

  let quote = 0;
  let parenDepth = 0;

  for (let i = 0; i < len; i++) {
    const c = css.charCodeAt(i);

    if (quote) {
      pending += css[i];
      if (c === 92 /* \ */ && i + 1 < len) {
        pending += css[i + 1];
        i++;
      } else if (c === quote) {
        quote = 0;
      }
      continue;
    }
    if (c === 34 || c === 39) {
      quote = c;
      pending += css[i];
      continue;
    }
    // /* ... */ comment — strip inline
    if (c === 47 /* / */ && i + 1 < len && css.charCodeAt(i + 1) === 42 /* * */) {
      i += 2;
      while (i < len) {
        if (css.charCodeAt(i) === 42 && i + 1 < len && css.charCodeAt(i + 1) === 47) {
          i += 2;
          break;
        }
        i++;
      }
      i--; // for loop will i++
      continue;
    }
    if (c === 40) {
      parenDepth++;
      pending += css[i];
      continue;
    }
    if (c === 41) {
      parenDepth--;
      pending += css[i];
      continue;
    }

    if (c === 59 /* ; */ && parenDepth === 0) {
      // Declaration terminator. Split on the first top-level `:` and emit
      // `name:value;` tight (drops whitespace around the colon so the output
      // byte-matches the older AST-based path).
      const trimmed = pending.trim();
      pending = '';
      if (!trimmed) continue;
      const colon = firstTopLevelColon(trimmed);
      if (colon === -1) continue; // malformed; drop
      const name = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim();
      const top = stack[stack.length - 1];
      top.decls += usePrefix ? prefix(name, value) : name + ':' + value + ';';
      continue;
    }

    if (c === 123 /* { */) {
      // The accumulated text is a selector or at-rule query. Reset pending.
      const rawSelector = pending.trim();
      pending = '';
      const top = stack[stack.length - 1];

      if (rawSelector.charCodeAt(0) === 64 /* @ */) {
        const kind = classifyAtRule(rawSelector);
        if (kind === 2) {
          // Top-level at-rule (@font-face / @keyframes / …). Selector isn't
          // used for `&` — nested selectors (from/to) are treated verbatim.
          stack.push({
            kind: 2,
            selector: '',
            query: rawSelector,
            decls: '',
            children: '',
          });
        } else {
          // Conditional at-rule. Nested rules inherit parent's selector for
          // `&` resolution.
          stack.push({
            kind: 1,
            selector: top.selector,
            query: rawSelector,
            decls: '',
            children: '',
          });
        }
      } else {
        // Normal rule scope. If the direct parent is a top-level at-rule,
        // the selector is used verbatim (from / to / 50% inside @keyframes).
        // Otherwise resolve `&` and prefix descendants against parent.
        const resolved =
          top.kind === 2 ? rawSelector : resolveSelectors(rawSelector, top.selector);
        stack.push({
          kind: 0,
          selector: resolved,
          query: '',
          decls: '',
          children: '',
        });
      }
      continue;
    }

    if (c === 125 /* } */) {
      // End of the current frame.
      const frame = stack.pop()!;
      const parent = stack[stack.length - 1];
      if (frame.kind === 0) {
        // Scope: emit `selector{decls}children`.
        const block =
          frame.selector + '{' + frame.decls + '}' + frame.children;
        if (parent) parent.children += block;
      } else if (frame.kind === 1) {
        // Conditional at-rule: wrap decls in parent scope, then append children.
        const wrappedDecls = frame.decls
          ? frame.selector + '{' + frame.decls + '}'
          : '';
        const block =
          frame.query + '{' + wrappedDecls + frame.children + '}';
        if (parent) parent.children += block;
      } else {
        // Top-level at-rule: emit into hoisted, NOT parent.
        hoisted += frame.query + '{' + frame.decls + frame.children + '}';
      }
      pending = '';
      continue;
    }

    pending += css[i];
  }

  // Any trailing declaration without `;`.
  const tail = pending.trim();
  if (tail && tail.indexOf(':') !== -1) {
    if (usePrefix) {
      const colon = firstTopLevelColon(tail);
      if (colon !== -1) {
        root.decls += prefix(tail.slice(0, colon).trim(), tail.slice(colon + 1).trim());
      }
    } else {
      root.decls += tail + ';';
    }
  }

  // Assemble the root frame + hoisted at-rules.
  const rootBlock = root.selector + '{' + root.decls + '}' + root.children;
  return hoisted ? rootBlock + hoisted : rootBlock;
}

// First `:` at paren-depth 0 outside strings. Only invoked on the (rare)
// custom-prefix path.
function firstTopLevelColon(s: string): number {
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
    else if (c === 58 && depth === 0) return i;
  }
  return -1;
}
