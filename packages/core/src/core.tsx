import React from 'react';
import { RAW, TYPE, TYPES_CSS, TYPES_KEYFRAMES } from '@filbert-js/types';
import { __sheet } from '@filbert-js/style-sheet-context';
import { factory, type StyledFactoryResult } from './factory';

// `css` — reusable CSS fragment. Can be interpolated into `styled` templates
// (inlined via RAW[0]) OR applied as a JSX `css` prop pragma (via `jsx`).
export const css = factory(TYPES_CSS) as (
  strings: TemplateStringsArray,
  ...args: unknown[]
) => StyledFactoryResult;

// `keyframes` — CSS `@keyframes` block. Stringifies to `k-<hash>`, the
// animation name, so it can be interpolated into `animation:` declarations.
export const keyframes = factory(TYPES_KEYFRAMES) as (
  strings: TemplateStringsArray,
  ...args: unknown[]
) => StyledFactoryResult;

// JSX pragma that handles the `css` prop — used when the filbert babel plugin
// rewrites `<div css={cssFragment} />` to `jsx('div', { css: cssFragment })`.
export function jsx(
  type: React.ElementType,
  props: (Record<string, unknown> & { css?: StyledFactoryResult; className?: string }) | null,
  ...children: React.ReactNode[]
): React.ReactElement {
  const { css: cssProp, className = '', ...rest } = props || {};
  if (cssProp) {
    const [styleBlock, kfList] = cssProp[RAW];
    (kfList as unknown[]).forEach((frame) => __sheet.createKeyframes(frame as any));
    __sheet.createStyles(
      cssProp.toString(),
      styleBlock as string,
      undefined,
      cssProp[TYPE] as any,
    );
    (rest as any).className = `${cssProp} ${className}`.trim();
  } else if (className) {
    (rest as any).className = className;
  }
  return React.createElement(type, rest as any, ...children);
}
