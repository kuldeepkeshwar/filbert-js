// oxc-plugin-filbert — same three transforms as babel-plugin-filbert but
// AST-diffed via oxc-parser and applied with magic-string.
//
//   A) displayName injection — every module-scope `const X = styled.tag\`...\``
//      gets `.withConfig({ label, componentId })` (and `.css` when static).
//   B) `styled.foo` → `styled('foo')` legacy rewrite (kebab-cased).
//   C) `/*#__PURE__*/` before every filbert-rooted tagged template.
//   D) Static extraction — same rules as the babel plugin (`extract.ts`).
//   E) `.filbert.d.ts` sidecar — same shape as the babel plugin (`variants.ts`).
//
// Bail rules are intentionally strict so we can never emit a subtly-wrong
// transform: only module-scope tagged templates, only chains rooted at a
// bare `styled.<tag>` / `styled('tag')` / `styled(Ident)` /
// `styled(A.B.C)`, and only const bindings resolved from the module scope
// snapshot.

import MagicString from 'magic-string';
import * as fs from 'fs';
import * as path from 'path';

import { parseFile, walk, OxcParseError, type Node } from './parse';
import { tryExtractCss } from './extract';
import { collectVariantsFromFn, variantMapToTsProps, type VariantMap } from './variants';
import { getFilenameBase, makeLabelAndId, toKebab } from './util';
import {
  buildWithConfigCall,
  injectPureComment,
  injectWithConfig,
  rewriteStyledMemberToCall,
} from './inject';

export interface FilbertPluginOptions {
  imports?: {
    styled?: string;
    css?: string;
    keyframes?: string;
    Global?: string;
  };
  pure?: boolean;
  extract?: boolean;
  emitDts?: boolean;
  dtsDir?: string;
  // On oxc parse failure, transparently rerun via babel-plugin-filbert. Default true.
  fallbackToBabel?: boolean;
  // Log fallback events. Default false.
  onFallback?: (info: { filename: string; reason: string }) => void;
  // Emit a hi-res source map. Off by default — magic-string's map generation
  // costs more than the entire rewrite pipeline; only opt in when consumers
  // actually want debugger step-through.
  sourceMap?: boolean;
}

export interface TransformResult {
  code: string;
  map?: any;
  fallback?: 'babel';
  bailed?: boolean;
}

// Walk left through a tag chain and return the innermost identifier the chain
// is rooted at, plus every node along the way (used to locate the styled
// root's `.end` for appendRight).
function tagRoot(tag: Node): { rootIdent: Node | null; chain: Node[] } {
  const chain: Node[] = [];
  let cur: Node = tag;
  while (cur) {
    chain.push(cur);
    if (cur.type === 'Identifier') return { rootIdent: cur, chain };
    if (cur.type === 'MemberExpression') { cur = cur.object; continue; }
    if (cur.type === 'CallExpression') { cur = cur.callee; continue; }
    return { rootIdent: null, chain };
  }
  return { rootIdent: null, chain };
}

// Find the leftmost styled(…) or styled.<tag> node in the tag chain.
// Returns the NODE whose `.end` is where `.withConfig(...)` should splice in.
function findStyledRootNode(tag: Node, styledName: string): Node | null {
  let cur: Node = tag;
  while (cur) {
    if (cur.type === 'CallExpression') {
      const callee = cur.callee;
      if (callee?.type === 'Identifier' && callee.name === styledName) return cur;
      if (callee?.type === 'MemberExpression') { cur = callee.object; continue; }
      return null;
    }
    if (cur.type === 'MemberExpression') {
      if (cur.object?.type === 'Identifier' && cur.object.name === styledName) return cur;
      cur = cur.object;
      continue;
    }
    return null;
  }
  return null;
}

// Collect the module-scope MemberExpressions of the form `styled.<Ident>` (or
// `styled['name']`) that participate in a rewritten tag. Used to convert
// `styled.mainButton` → `styled('main-button')`.
function isStyledMember(node: Node, styledName: string): { name: string } | null {
  if (node?.type !== 'MemberExpression') return null;
  if (node.object?.type !== 'Identifier') return null;
  if (node.object.name !== styledName) return null;
  if (!node.computed) {
    if (node.property?.type === 'Identifier') return { name: node.property.name };
  } else {
    // computed with a string literal is also OK
    const p = node.property;
    if (p?.type === 'StringLiteral' || (p?.type === 'Literal' && typeof p.value === 'string'))
      return { name: (p.value as string) };
  }
  return null;
}

interface FileState {
  variantsByComponent: Map<string, VariantMap>;
  fileBase: string;
  filename: string | null;
}

// The core rewriter. Returns the possibly-mutated code + a bailed flag when
// nothing changed (fast path for the caller to skip source-map work).
function runOxc(source: string, filename: string, options: FilbertPluginOptions): {
  code: string;
  map: any;
  state: FileState;
  changed: boolean;
} {
  const parsed = parseFile(filename, source);
  const { program, moduleConsts } = parsed;

  const importNames = {
    styled: 'styled',
    css: 'css',
    keyframes: 'keyframes',
    Global: 'Global',
    ...(options.imports || {}),
  };
  const styledName = importNames.styled;
  const importAllowlist = new Set(Object.values(importNames));
  const pure = options.pure !== false;
  const extract = options.extract !== false;
  const wantSourceMap = options.sourceMap === true;

  const st: FileState = {
    variantsByComponent: new Map(),
    fileBase: getFilenameBase(filename),
    filename,
  };

  const ms = new MagicString(source);

  // One combined walk with a parent stack. We track only the immediate
  // parent chain for two use cases:
  //   * `styled.foo` rewriting — no ancestry needed
  //   * TaggedTemplateExpression handling — needs parent + grandparent to
  //     recover the enclosing `const X = <tag>` and check module scope
  const stack: Node[] = [];

  walk(program, (n, _parent) => {
    // Track parent stack via enter/exit — we exit on the WAY OUT of a
    // node. Because `walk` is preorder-only, we push here and rely on the
    // stack length to know when to pop.
    // The simplest correct thing: push before recursing (post-visit), pop
    // AFTER. But `walk` doesn't give us a leave hook — so instead we
    // reason from the incoming `parent`: whenever `parent` is the top of
    // our stack we're still under it; otherwise unwind until it is.
    while (stack.length > 0 && stack[stack.length - 1] !== _parent) stack.pop();
    // (root node has parent === null and the stack starts empty, so no pop)

    if (n.type === 'MemberExpression') {
      const hit = isStyledMember(n, styledName);
      if (hit) {
        const kebab = /[A-Z]/.test(hit.name) ? toKebab(hit.name) : hit.name;
        rewriteStyledMemberToCall(ms, styledName, n, kebab);
      }
    } else if (n.type === 'TaggedTemplateExpression') {
      handleTaggedTemplate(n, stack, ms, st, {
        moduleConsts,
        styledName,
        importAllowlist,
        pure,
        extract,
      });
    }

    stack.push(n);
  });

  const changed = ms.hasChanged();
  return {
    code: changed ? ms.toString() : source,
    // Source-map generation is the single most expensive step of the whole
    // pipeline — build tools that don't need it (e.g. prod builds that only
    // want the transformed code + no debugger step-through) should leave
    // `sourceMap` off. Off by default.
    map: changed && wantSourceMap
      ? ms.generateMap({ source: filename, includeContent: true, hires: true })
      : null,
    state: st,
    changed,
  };
}

interface HandleCtx {
  moduleConsts: Map<string, Node>;
  styledName: string;
  importAllowlist: Set<string>;
  pure: boolean;
  extract: boolean;
}

function handleTaggedTemplate(
  n: Node,
  stack: Node[],
  ms: MagicString,
  st: FileState,
  ctx: HandleCtx,
): void {
  const { moduleConsts, styledName, importAllowlist, pure, extract } = ctx;
  const tag = n.tag;
  const { rootIdent } = tagRoot(tag);
  if (!rootIdent || !importAllowlist.has(rootIdent.name)) return;

  if (pure) injectPureComment(ms, n.start);

  const isStyledRooted = rootIdent.name === styledName;
  if (!isStyledRooted) return;

  // Recover `const X = <tag>` from the immediate parent chain.
  const parent = stack[stack.length - 1];
  const grand = stack[stack.length - 2];
  let varName: string | null = null;
  if (parent?.type === 'VariableDeclarator' && parent.init === n && parent.id?.type === 'Identifier') {
    varName = parent.id.name;
  }

  // Static extraction attempt (cheap to do regardless of scope decision).
  let compiledCss: string | undefined;
  if (extract) {
    const res = tryExtractCss(n.quasi, moduleConsts);
    if (res.ok) compiledCss = res.css;
  }

  // Variant collection — from every ArrowFn / FunctionExpression in the
  // template's expressions. Only bother if we have a var name — the
  // sidecar keys off it.
  if (varName) {
    const map: VariantMap = new Map();
    for (const ex of n.quasi.expressions || []) {
      if (ex.type === 'ArrowFunctionExpression' || ex.type === 'FunctionExpression') {
        collectVariantsFromFn(ex, map);
      }
    }
    if (map.size > 0) st.variantsByComponent.set(varName, map);
  }

  if (!varName) return;

  // Module-scope guard: parent must be VariableDeclarator, grandparent
  // must be VariableDeclaration whose parent is Program (or an
  // ExportNamedDeclaration under Program). Anything else is nested and
  // we bail.
  if (!grand || grand.type !== 'VariableDeclaration') return;
  // The stack shape at this point is [ …ancestors…, grand ] (parent is on
  // top). We check the frame above grand for module-scope.
  const great = stack[stack.length - 3];
  if (great && great.type !== 'Program' && great.type !== 'ExportNamedDeclaration') return;

  const rootNode = findStyledRootNode(tag, styledName);
  if (!rootNode) return;

  const { label, componentId } = makeLabelAndId(st.fileBase, varName);
  injectWithConfig(ms, rootNode.end, { label, componentId, css: compiledCss });
}

// Public API.
export function transform(
  source: string,
  filename: string,
  options: FilbertPluginOptions = {},
): TransformResult {
  const emitDts = options.emitDts !== false;

  // Fast-bail: if the file doesn't even mention the imported identifier there
  // is nothing to rewrite. This is the dominant case in a real app —
  // ~95% of files don't touch filbert — and skipping the parse alone is a
  // 40-50× speedup for those.
  const styledName = options.imports?.styled ?? 'styled';
  if (source.indexOf(styledName) < 0) {
    return { code: source, bailed: true };
  }

  try {
    const { code, map, state, changed } = runOxc(source, filename, options);
    if (emitDts) writeDtsIfAny(state, options);
    return { code, map, bailed: !changed };
  } catch (err) {
    if (err instanceof OxcParseError && options.fallbackToBabel !== false) {
      const babel = loadBabel();
      if (babel) {
        options.onFallback?.({ filename, reason: err.message });
        const out = babel.transformSync(source, {
          babelrc: false,
          configFile: false,
          filename,
          presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
          plugins: [[babel.filbertPlugin, options]],
        });
        return { code: out?.code || source, map: out?.map, fallback: 'babel' };
      }
    }
    throw err;
  }
}

interface BabelBridge {
  transformSync: (
    code: string,
    opts: any,
  ) => { code: string | null | undefined; map?: any } | null;
  filbertPlugin: any;
}

function loadBabel(): BabelBridge | null {
  try {
    // Loaded lazily so consumers not using the fallback pay no cost.

    const core = require('@babel/core');

    const plugin = require('babel-plugin-filbert');
    return { transformSync: core.transformSync, filbertPlugin: plugin.default || plugin };
  } catch {
    return null;
  }
}

function writeDtsIfAny(st: FileState, options: FilbertPluginOptions) {
  if (!st.filename) return;
  if (st.variantsByComponent.size === 0) return;
  const outDir = options.dtsDir
    ? path.resolve(options.dtsDir)
    : path.dirname(st.filename);
  const outPath = path.join(outDir, `${st.fileBase}.filbert.d.ts`);
  const bodyLines: string[] = [];
  bodyLines.push(`// AUTO-GENERATED by oxc-plugin-filbert. DO NOT EDIT.`);
  bodyLines.push(`declare module '*/${st.fileBase}' {`);
  bodyLines.push(`  import type { StyledComponent } from '@filbert-js/core';`);
  for (const [name, map] of st.variantsByComponent) {
    const props = variantMapToTsProps(map);
    bodyLines.push(`  export const ${name}: StyledComponent<{`);
    bodyLines.push(props);
    bodyLines.push(`  }>;`);
  }
  bodyLines.push(`}`);
  const body = bodyLines.join('\n') + '\n';
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, body);
  } catch {
    // best-effort
  }
}

// Re-export a couple of building blocks for callers who want to reuse them.
export { buildWithConfigCall };
