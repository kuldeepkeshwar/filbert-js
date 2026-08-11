// Static extraction — S4.
//
// Given a tagged-template `styled.button\`...\``, decide whether every
// interpolation can be resolved at build time. If yes, build the CSS body
// string and return it — the plugin then attaches it under `withConfig.css`
// and the runtime uses the fast path.
//
// What counts as "static":
//   * string / numeric / boolean literals
//   * template literals whose expressions are recursively static
//   * `foo` where `foo` is a top-level `const` bound to a static literal
//     initialiser (via `path.scope.getBinding`)
//   * member chain `a.b.c` where the root is a top-level `const` object of
//     static values
//
// Anything else (arrow fns, unknown identifiers, imports from other modules,
// keyframes, nested styled components, etc.) marks the template DYNAMIC and
// we bail — the runtime keeps handling it as it does today.

import type { NodePath } from '@babel/traverse';
import type * as BabelTypes from '@babel/types';

export interface ExtractResult {
  ok: boolean;
  css?: string;
}

function evaluateStatic(
  t: typeof BabelTypes,
  exprPath: NodePath<BabelTypes.Node>,
): { ok: boolean; value?: unknown } {
  const node = exprPath.node;

  if (t.isStringLiteral(node)) return { ok: true, value: node.value };
  if (t.isNumericLiteral(node)) return { ok: true, value: node.value };
  if (t.isBooleanLiteral(node)) return { ok: true, value: node.value };
  if (t.isNullLiteral(node)) return { ok: true, value: null };

  if (t.isTemplateLiteral(node)) {
    let out = '';
    const quasis = node.quasis;
    const expressions = (exprPath.get('expressions') as NodePath<BabelTypes.Node>[]) || [];
    for (let i = 0; i < quasis.length; i++) {
      out += quasis[i].value.cooked ?? quasis[i].value.raw;
      if (i < expressions.length) {
        const sub = evaluateStatic(t, expressions[i]);
        if (!sub.ok) return { ok: false };
        out += String(sub.value ?? '');
      }
    }
    return { ok: true, value: out };
  }

  if (t.isUnaryExpression(node) && node.operator === '-') {
    const arg = evaluateStatic(t, exprPath.get('argument') as NodePath<BabelTypes.Node>);
    if (!arg.ok) return { ok: false };
    return { ok: true, value: -(arg.value as number) };
  }

  if (t.isIdentifier(node)) {
    const binding = exprPath.scope.getBinding(node.name);
    if (!binding) return { ok: false };
    if (binding.kind !== 'const') return { ok: false };
    const initPath = binding.path.get('init') as NodePath<BabelTypes.Node> | undefined;
    if (!initPath || !initPath.node) return { ok: false };
    return evaluateStatic(t, initPath);
  }

  if (t.isObjectExpression(node)) {
    const out: Record<string, unknown> = {};
    const props = exprPath.get('properties') as NodePath<BabelTypes.Node>[];
    for (const p of props) {
      if (!t.isObjectProperty(p.node) || p.node.computed) return { ok: false };
      const key = p.node.key;
      let keyName: string | number;
      if (t.isIdentifier(key)) keyName = key.name;
      else if (t.isStringLiteral(key)) keyName = key.value;
      else if (t.isNumericLiteral(key)) keyName = key.value;
      else return { ok: false };
      const val = evaluateStatic(t, p.get('value') as NodePath<BabelTypes.Node>);
      if (!val.ok) return { ok: false };
      out[String(keyName)] = val.value;
    }
    return { ok: true, value: out };
  }

  if (t.isMemberExpression(node) && !node.computed) {
    const obj = evaluateStatic(t, exprPath.get('object') as NodePath<BabelTypes.Node>);
    if (!obj.ok || obj.value == null || typeof obj.value !== 'object') return { ok: false };
    const prop = node.property;
    if (!t.isIdentifier(prop)) return { ok: false };
    const v = (obj.value as Record<string, unknown>)[prop.name];
    if (v === undefined) return { ok: false };
    return { ok: true, value: v };
  }

  return { ok: false };
}

export function tryExtractCss(
  t: typeof BabelTypes,
  quasiPath: NodePath<BabelTypes.TemplateLiteral>,
): ExtractResult {
  const node = quasiPath.node;
  const quasis = node.quasis;
  const expressions = quasiPath.get('expressions') as NodePath<BabelTypes.Node>[];

  let out = '';
  for (let i = 0; i < quasis.length; i++) {
    out += quasis[i].value.cooked ?? quasis[i].value.raw;
    if (i < expressions.length) {
      const sub = evaluateStatic(t, expressions[i]);
      if (!sub.ok) return { ok: false };
      // Coerce like the runtime does — falsy/null/false → empty, everything
      // else stringified.
      if (sub.value == null || sub.value === false || sub.value === '') {
        // empty
      } else {
        out += String(sub.value);
      }
    }
  }
  return { ok: true, css: out };
}
