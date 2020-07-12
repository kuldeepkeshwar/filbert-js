import { RAW, TYPE, TYPES_KEYFRAMES, TYPES_STYLES } from '@filbert-js/types';

import React from 'react';
import { __sheet } from '@filbert-js/style-sheet-context';
import { factory } from './factory';

export const css = factory(TYPES_STYLES);
export const keyframes = factory(TYPES_KEYFRAMES);
export function jsx(type, { css, className = '', ...props }, children) {
  const sheet = __sheet;
  if (css) {
    const [styleBlock, keyframes] = css[RAW];
    keyframes.forEach((frame) => sheet.createKeyframes(frame));
    sheet.createStyles(css.toString(), styleBlock, undefined, css[TYPE]);
    props.className = `${css} ${className}`.trim();
  }
  return React.createElement(type, props, children);
}
