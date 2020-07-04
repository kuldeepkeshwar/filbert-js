import { RAW, TYPES, TYPES_KEYFRAMES } from '@filbert-js/types';

import { hash } from './hash';

export function keyframes(styleTemplates, ...variables) {
  const styleBlock = styleTemplates.reduce((previous, current, index) => {
    return `${previous}${variables[index - 1]}${current}`;
  });
  const keyframesName = hash(styleBlock, TYPES_KEYFRAMES);
  const keyframe = {
    [TYPES]: TYPES_KEYFRAMES,
    [RAW]: styleBlock,
    toString: () => keyframesName,
  };

  return keyframe;
}
