import { RAW, TYPE, TYPES_CSS } from '@filbert-js/types';

import { hash } from './hash';
import { interpolate } from './interpolate';

export function factory(type = TYPES_CSS, context) {
  return function () {
    const [css, keyframes] = interpolate.apply(context, arguments);
    const selector = `${type}-${hash(css)}`;
    return {
      [TYPE]: type,
      [RAW]: [css, keyframes],
      toString: () => selector,
    };
  };
}
