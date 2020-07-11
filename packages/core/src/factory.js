import { RAW, TYPE } from '@filbert-js/types';

import { hash } from './hash';
import { interpolate } from './interpolate';

export function factory({ type, context, label }) {
  return function(styleTemplates, ...variables) {
    const [styleBlock, keyframes] = interpolate(
      styleTemplates,
      variables,
      context,
    );
    const selector = hash(styleBlock, label || type);
    return {
      [TYPE]: type,
      [RAW]: [styleBlock, keyframes],
      toString: () => selector,
    };
  };
}
