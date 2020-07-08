import { RAW, TYPES, TYPES_KEYFRAMES } from '@filbert-js/types';

import { hash } from './hash';
import { interpolate } from './interpolate';

export function keyframes(styleTemplates, ...variables) {
  const [styleBlock] = interpolate(styleTemplates, variables);
  const keyframesName = hash(styleBlock, TYPES_KEYFRAMES);
  const keyframe = {
    [TYPES]: TYPES_KEYFRAMES,
    [RAW]: styleBlock,
    toString: () => keyframesName,
  };

  return keyframe;
}
