// Variant TypeScript inference — S3.
//
// Walk every function interpolation in a styled template and collect the
// literal comparisons against `p.$<name>` — this gives the variant surface
// for the styled component and drives a `.filbert.d.ts` sidecar.
//
// Handles both `p.$variant === 'primary'` and `p.$variant === "primary"`.
// Also handles the switched form `'primary' === p.$variant` and `!==` (we
// still record the literal since it's a known member of the union).

import type { NodePath } from '@babel/traverse';
import type * as BabelTypes from '@babel/types';

// { $variant: Set<'primary','secondary'> }
export type VariantMap = Map<string, Set<string | number | boolean>>;

function paramMatches(
  t: typeof BabelTypes,
  fn: BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression,
  memberObj: BabelTypes.Node,
): boolean {
  if (!t.isIdentifier(memberObj)) return false;
  const objName = (memberObj as BabelTypes.Identifier).name;
  const params = fn.params;
  if (params.length === 0) return false;
  const first = params[0];
  // (p) => ...
  if (t.isIdentifier(first) && (first as BabelTypes.Identifier).name === objName) return true;
  // ({ $variant }) => ... — the object member form. We treat destructured
  // identifiers separately; for now the styled-components idiom is `(p) =>
  // p.$variant`, which is what we optimise for.
  return false;
}

function litKey(t: typeof BabelTypes, n: BabelTypes.Node): string | number | boolean | null {
  if (t.isStringLiteral(n)) return (n as BabelTypes.StringLiteral).value;
  if (t.isNumericLiteral(n)) return (n as BabelTypes.NumericLiteral).value;
  if (t.isBooleanLiteral(n)) return (n as BabelTypes.BooleanLiteral).value;
  return null;
}

// Collect $prop → Set<literal> from one function interpolation.
export function collectVariantsFromFn(
  t: typeof BabelTypes,
  fnPath: NodePath<BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression>,
  out: VariantMap,
): void {
  const fn = fnPath.node;
  fnPath.traverse({
    BinaryExpression(inner) {
      const { operator, left, right } = inner.node;
      if (operator !== '===' && operator !== '==' && operator !== '!==' && operator !== '!=')
        return;

      // p.$x === 'lit'  or 'lit' === p.$x
      let memberSide: BabelTypes.MemberExpression | null = null;
      let litSide: BabelTypes.Node | null = null;

      if (t.isMemberExpression(left) && !(left as BabelTypes.MemberExpression).computed) {
        memberSide = left as BabelTypes.MemberExpression;
        litSide = right;
      } else if (
        t.isMemberExpression(right) &&
        !(right as BabelTypes.MemberExpression).computed
      ) {
        memberSide = right as BabelTypes.MemberExpression;
        litSide = left;
      }
      if (!memberSide || !litSide) return;

      // property must be a transient identifier `$name`
      const prop = memberSide.property;
      if (!t.isIdentifier(prop)) return;
      const name = (prop as BabelTypes.Identifier).name;
      if (!name.startsWith('$')) return;

      // object must be the function's first param
      if (!paramMatches(t, fn, memberSide.object)) return;

      const lit = litKey(t, litSide);
      if (lit === null) return;

      let set = out.get(name);
      if (!set) {
        set = new Set();
        out.set(name, set);
      }
      set.add(lit);
    },
  });
}

// Format a variant map as a TS `{ $variant?: 'primary' | 'secondary'; }`
// property block.
export function variantMapToTsProps(map: VariantMap): string {
  const keys = [...map.keys()].sort();
  const parts: string[] = [];
  for (const k of keys) {
    const values = [...(map.get(k) as Set<string | number | boolean>)];
    const union = values
      .map((v) => (typeof v === 'string' ? JSON.stringify(v) : String(v)))
      .join(' | ');
    parts.push(`    ${JSON.stringify(k)}?: ${union};`);
  }
  return parts.join('\n');
}
