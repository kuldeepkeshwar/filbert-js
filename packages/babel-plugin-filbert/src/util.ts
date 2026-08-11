// Small helpers shared by the visitors.

import type { NodePath } from '@babel/traverse';
import type * as BabelTypes from '@babel/types';

// djb2-ish, matches the runtime `hash()` in packages/core/src/hash.ts so a
// build-time hash is stable across the two.
export function hash32(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    h = (h << 5) - h + chr;
    h |= 0;
  }
  return h;
}

// A short base36 tag suitable for classnames / component IDs.
export function shortHash(str: string): string {
  const h = hash32(str);
  return (h >>> 0).toString(36);
}

// Marker so a visitor doesn't rewrite a tag it already rewrote.
export const FILBERT_TOUCHED = Symbol('filbert-touched');

export function getFilenameBase(filename: string | null | undefined): string {
  if (!filename) return 'anon';
  const noQuery = filename.split('?')[0];
  const parts = noQuery.split(/[\\/]/);
  const last = parts[parts.length - 1] || 'anon';
  return last.replace(/\.[^.]+$/, '') || 'anon';
}

export const toKebab = (s: string): string =>
  s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

// Walk left-to-right down a chain of member/call expressions to find the
// "root" — the leftmost node that is either `styled.<tag>`, `styled('tag')` or
// `styled(Component)`. Returns null if the chain doesn't start with `styled`.
export function findStyledRoot(
  t: typeof BabelTypes,
  tagPath: NodePath<BabelTypes.Expression>,
  styledName: string,
): NodePath<BabelTypes.Expression> | null {
  let cur: NodePath<BabelTypes.Node> = tagPath;
  // Descend the chain: outermost node is either a CallExpression (.attrs(...)
  // / .withConfig(...) call, or the styled(...) root itself) or a
  // MemberExpression (styled.div, or an intermediate .attrs / .withConfig
  // member access). We keep descending until we hit `styled(...)` or
  // `styled.<tag>`.
  while (true) {
    if (cur.isCallExpression()) {
      const callee = cur.get('callee') as NodePath<BabelTypes.Expression>;
      // styled('tag' | Comp)
      if (t.isIdentifier(callee.node) && (callee.node as BabelTypes.Identifier).name === styledName) {
        return cur as NodePath<BabelTypes.Expression>;
      }
      // .attrs / .withConfig on something further left — keep descending.
      if (t.isMemberExpression(callee.node)) {
        cur = callee.get('object') as NodePath<BabelTypes.Node>;
        continue;
      }
      return null;
    }
    if (cur.isMemberExpression()) {
      const obj = cur.get('object') as NodePath<BabelTypes.Expression>;
      // styled.<tag>
      if (t.isIdentifier(obj.node) && (obj.node as BabelTypes.Identifier).name === styledName) {
        return cur as NodePath<BabelTypes.Expression>;
      }
      cur = obj as NodePath<BabelTypes.Node>;
      continue;
    }
    return null;
  }
}

// Given `varName` at a source file (basename `fileBase`), produce the label
// and componentId a la styled-components: `Card__Button` + `fj-<hash>`.
export function makeLabelAndId(
  fileBase: string,
  varName: string,
): { label: string; componentId: string } {
  return {
    label: `${fileBase}__${varName}`,
    componentId: `fj-${shortHash(`${fileBase}::${varName}`)}`,
  };
}
