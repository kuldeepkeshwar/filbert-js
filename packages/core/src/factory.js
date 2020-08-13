import { RAW, TYPE } from '@filbert-js/types';

import { hash } from './hash';
import { interpolate } from './interpolate';

export function factory(type, label, context) {
  return function() {
    const [css, keyframes] = interpolate.apply(context, arguments);
    const selector = hash(css, label || type);
    return {
      [TYPE]: type,
      [RAW]: [css, keyframes],
      toString: () => selector,
    };
  };
}
