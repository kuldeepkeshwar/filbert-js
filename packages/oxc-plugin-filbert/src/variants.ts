// Variant TS inference — mirrors babel-plugin-filbert/src/variants.ts.
//
// Walk one function interpolation and collect `p.$x === 'lit'` (or the
// switched / negated forms) into a { $prop → Set<literal> } map.

import type { Node } from './parse';
import { walk } from './parse';

export type VariantMap = Map<string, Set<string | number | boolean>>;

function paramMatches(fn: Node, memberObj: Node): boolean {
  if (memberObj?.type !== 'Identifier') return false;
  const objName: string = memberObj.name;
  const params = fn.params || [];
  if (params.length === 0) return false;
  const first = params[0];
  if (first?.type === 'Identifier' && first.name === objName) return true;
  return false;
}

function litKey(n: Node): string | number | boolean | null {
  if (!n) return null;
  if (n.type === 'StringLiteral') return n.value;
  if (n.type === 'NumericLiteral') return n.value;
  if (n.type === 'BooleanLiteral') return n.value;
  if (n.type === 'Literal') {
    const v = n.value;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  }
  return null;
}

export function collectVariantsFromFn(fnNode: Node, out: VariantMap): void {
  const body = fnNode.body;
  if (!body) return;
  walk(body, (n) => {
    if (n.type !== 'BinaryExpression') return;
    const { operator, left, right } = n;
    if (operator !== '===' && operator !== '==' && operator !== '!==' && operator !== '!=')
      return;

    let memberSide: Node | null = null;
    let litSide: Node | null = null;

    if (left?.type === 'MemberExpression' && !left.computed) {
      memberSide = left;
      litSide = right;
    } else if (right?.type === 'MemberExpression' && !right.computed) {
      memberSide = right;
      litSide = left;
    }
    if (!memberSide || !litSide) return;

    const prop = memberSide.property;
    if (prop?.type !== 'Identifier') return;
    const name: string = prop.name;
    if (!name.startsWith('$')) return;

    if (!paramMatches(fnNode, memberSide.object)) return;

    const lit = litKey(litSide);
    if (lit === null) return;

    let set = out.get(name);
    if (!set) {
      set = new Set();
      out.set(name, set);
    }
    set.add(lit);
  });
}

// Same shape as babel-plugin-filbert.
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
