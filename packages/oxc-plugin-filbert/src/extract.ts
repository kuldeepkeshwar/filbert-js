// Static extraction — mirrors babel-plugin-filbert/src/extract.ts.
//
// Given a TaggedTemplateExpression `styled.button\`...\``, decide whether every
// interpolation resolves at build time. If yes, return the compiled CSS body.
// Bail (return { ok: false }) at the first sign of a dynamic input; the
// runtime then handles the template normally.
//
// "Static" = literal, template literal of statics, unary `-lit`, `const` id
// bound at module scope to a static, or a member chain into such a const.
// Anything else (arrow fns, unknown ids, imports, keyframes) → bail.

import type { Node } from './parse';

export interface ExtractResult {
  ok: boolean;
  css?: string;
}

function evaluateStatic(
  node: Node,
  moduleConsts: Map<string, Node>,
  seen: Set<string>,
): { ok: boolean; value?: unknown } {
  if (!node) return { ok: false };
  switch (node.type) {
    case 'Literal': {
      // oxc emits `Literal` for string/number/boolean/null in JS files
      return { ok: true, value: node.value };
    }
    case 'StringLiteral':
      return { ok: true, value: node.value };
    case 'NumericLiteral':
      return { ok: true, value: node.value };
    case 'BooleanLiteral':
      return { ok: true, value: node.value };
    case 'NullLiteral':
      return { ok: true, value: null };

    case 'TemplateLiteral': {
      let out = '';
      const quasis = node.quasis || [];
      const expressions = node.expressions || [];
      for (let i = 0; i < quasis.length; i++) {
        out += quasis[i].value?.cooked ?? quasis[i].value?.raw ?? '';
        if (i < expressions.length) {
          const sub = evaluateStatic(expressions[i], moduleConsts, seen);
          if (!sub.ok) return { ok: false };
          out += String(sub.value ?? '');
        }
      }
      return { ok: true, value: out };
    }

    case 'UnaryExpression': {
      if (node.operator !== '-' && node.operator !== '+') return { ok: false };
      const arg = evaluateStatic(node.argument, moduleConsts, seen);
      if (!arg.ok) return { ok: false };
      const n = Number(arg.value as any);
      return { ok: true, value: node.operator === '-' ? -n : n };
    }

    case 'Identifier': {
      const name = node.name as string;
      if (seen.has(name)) return { ok: false }; // cycle guard
      const init = moduleConsts.get(name);
      if (!init) return { ok: false };
      seen.add(name);
      const r = evaluateStatic(init, moduleConsts, seen);
      seen.delete(name);
      return r;
    }

    case 'ObjectExpression': {
      const out: Record<string, unknown> = {};
      for (const p of node.properties || []) {
        if (p.type !== 'Property' && p.type !== 'ObjectProperty') return { ok: false };
        if (p.computed) return { ok: false };
        const key = p.key;
        let keyName: string | number;
        if (key?.type === 'Identifier') keyName = key.name;
        else if (key?.type === 'Literal' && (typeof key.value === 'string' || typeof key.value === 'number'))
          keyName = key.value as string | number;
        else if (key?.type === 'StringLiteral') keyName = key.value;
        else if (key?.type === 'NumericLiteral') keyName = key.value;
        else return { ok: false };
        const val = evaluateStatic(p.value, moduleConsts, seen);
        if (!val.ok) return { ok: false };
        out[String(keyName)] = val.value;
      }
      return { ok: true, value: out };
    }

    case 'MemberExpression': {
      if (node.computed) return { ok: false };
      const obj = evaluateStatic(node.object, moduleConsts, seen);
      if (!obj.ok || obj.value == null || typeof obj.value !== 'object') return { ok: false };
      const prop = node.property;
      if (prop?.type !== 'Identifier') return { ok: false };
      const v = (obj.value as Record<string, unknown>)[prop.name];
      if (v === undefined) return { ok: false };
      return { ok: true, value: v };
    }
  }
  return { ok: false };
}

export function tryExtractCss(
  templateLiteral: Node,
  moduleConsts: Map<string, Node>,
): ExtractResult {
  const quasis = templateLiteral.quasis || [];
  const expressions = templateLiteral.expressions || [];
  let out = '';
  for (let i = 0; i < quasis.length; i++) {
    out += quasis[i].value?.cooked ?? quasis[i].value?.raw ?? '';
    if (i < expressions.length) {
      const sub = evaluateStatic(expressions[i], moduleConsts, new Set());
      if (!sub.ok) return { ok: false };
      // Same coercion rules as the runtime and the babel plugin.
      if (sub.value == null || sub.value === false || sub.value === '') {
        // empty
      } else {
        out += String(sub.value);
      }
    }
  }
  return { ok: true, css: out };
}
