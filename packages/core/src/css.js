import { RAW, TYPES, TYPES_STYLES } from '@filbert-js/types';

import React from 'react';
import { __sheet } from '@filbert-js/style-sheet-context';
import { hash } from './hash';
import { interpolate } from './interpolate';

export function css(styleTemplates, ...variables) {
  const [styleBlock, keyframes] = interpolate(styleTemplates, variables);
  const className = hash(styleBlock, TYPES_STYLES);

  return {
    [TYPES]: TYPES_STYLES,
    [RAW]: styleBlock,
    keyframes: keyframes,
    toString: () => className,
  };
}
export function jsx(type, { css, className = '', ...props }, children) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const stylesheet = __sheet;
  if (css) {
    const { keyframes, [RAW]: raw, [TYPES]: type } = css;
    keyframes.forEach((frame) => stylesheet.createKeyframes(frame));
    stylesheet.createStyles(css.toString(), raw, undefined, type);
    props.className = `${css} ${className}`.trim();
  }
  return React.createElement(type, props, children);
}
