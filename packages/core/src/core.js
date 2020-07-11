import { RAW, TYPE, TYPES_KEYFRAMES, TYPES_STYLES } from '@filbert-js/types';

import React from 'react';
import { __sheet } from '@filbert-js/style-sheet-context';
import { factory } from './factory';

export const css = factory({ type: TYPES_STYLES });
export const keyframes = factory({ type: TYPES_KEYFRAMES });
export function jsx(type, { css, className = '', ...props }, children) {
  const stylesheet = __sheet;
  if (css) {
    const [styleBlock, keyframes] = css[RAW];
    keyframes.forEach((frame) => stylesheet.createKeyframes(frame));
    stylesheet.createStyles(css.toString(), styleBlock, undefined, css[TYPE]);
    props.className = `${css.toString()} ${className}`.trim();
  }
  return React.createElement(type, props, children);
}
