// Style-injection hooks.
//
// Registers synchronously in the render body so `renderToString` sees the
// styles for SSR (useInsertionEffect wouldn't fire on the server). Also uses
// useInsertionEffect on React 18+ for concurrent-rendering safety. Dedup at
// the sheet layer makes the double-registration a no-op.
import { TYPES_GLOBAL } from '@filbert-js/types';
import React from 'react';
import { __sheet } from '@filbert-js/style-sheet-context';

interface KeyframeLike {
  toString(): string;
  [key: symbol]: unknown;
}

export function useGlobalStylesheet(id: string, styles: string): void {
  __sheet.createGlobalStyles(id, styles);
  if (typeof React.useInsertionEffect === 'function') {
    React.useInsertionEffect(() => {
      __sheet.createGlobalStyles(id, styles);
    }, [id, styles]);
  }
  React.useEffect(() => {
    return () => __sheet.removeStyles(id, TYPES_GLOBAL);
  }, [id]);
}

export function useStylesheet(
  keyframes: KeyframeLike[],
  className: string,
  styles: string,
  sourceOrder?: string,
  label?: string,
): void {
  for (let i = 0; i < keyframes.length; i++) __sheet.createKeyframes(keyframes[i] as any);
  __sheet.createStyles(className, styles, sourceOrder, label);
  if (typeof React.useInsertionEffect === 'function') {
    React.useInsertionEffect(() => {
      for (let i = 0; i < keyframes.length; i++) __sheet.createKeyframes(keyframes[i] as any);
      __sheet.createStyles(className, styles, sourceOrder, label);
    }, [className]);
  }
}
