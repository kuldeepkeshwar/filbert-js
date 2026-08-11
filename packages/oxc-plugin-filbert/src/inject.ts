// magic-string edit helpers.
//
// Every mutation we perform is (a) an overwrite of a MemberExpression range
// like `styled.mainButton` → `styled("main-button")`, (b) an appendRight of
// `.withConfig({...})` at the end of the styled-root range, or (c) an
// appendLeft of `/*#__PURE__*/` at the tagged-template start. magic-string
// composes all three cleanly because they never overlap.

import type MagicString from 'magic-string';
import type { Node } from './parse';

export interface ConfigProps {
  label: string;
  componentId: string;
  css?: string;
}

function jsonString(s: string): string {
  return JSON.stringify(s);
}

export function buildWithConfigCall(props: ConfigProps): string {
  const parts: string[] = [
    `label: ${jsonString(props.label)}`,
    `componentId: ${jsonString(props.componentId)}`,
  ];
  if (props.css !== undefined) parts.push(`css: ${jsonString(props.css)}`);
  return `.withConfig({ ${parts.join(', ')} })`;
}

// Rewrite `styled.foo` → `styled("foo")` (kebab-casing camelCase). Called
// only after we've decided the enclosing tag is a filbert one.
export function rewriteStyledMemberToCall(
  ms: MagicString,
  styledName: string,
  memberNode: Node,
  kebabName: string,
): void {
  ms.overwrite(memberNode.start, memberNode.end, `${styledName}(${jsonString(kebabName)})`);
}

// Append `.withConfig({...})` after the styled root's end offset.
export function injectWithConfig(
  ms: MagicString,
  rootEnd: number,
  props: ConfigProps,
): void {
  ms.appendRight(rootEnd, buildWithConfigCall(props));
}

export function injectPureComment(ms: MagicString, tagStart: number): void {
  ms.appendLeft(tagStart, '/*#__PURE__*/');
}
