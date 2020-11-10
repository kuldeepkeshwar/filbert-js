import { RAW, TYPE, TYPES_CSS, TYPES_KEYFRAMES } from '@filbert-js/types';

import React from 'react';
import { __sheet } from '@filbert-js/style-sheet-context';
import { factory } from './factory';

export const css = factory(TYPES_CSS);
export const keyframes = factory(TYPES_KEYFRAMES);
export function jsx() {
  const { css, className = '', ...props } = arguments[1] || {};
  const sheet = __sheet;
  if (css) {
    const [styleBlock, keyframes] = css[RAW];
    keyframes.forEach((frame) => sheet.createKeyframes(frame));
    sheet.createStyles(css.toString(), styleBlock, undefined, css[TYPE]);
    props.className = `${css} ${className}`.trim();
    arguments[1] = props;
  }
  return React.createElement.apply(null, arguments);
}
