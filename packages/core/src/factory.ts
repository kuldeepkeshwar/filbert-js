import { RAW, TYPE, TYPES_CSS, type StyleType, type VarSlot } from '@filbert-js/types';
import { hash } from './hash';
import { interpolate, type InterpolateContext } from './interpolate';

export interface StyledFactoryResult {
  [TYPE]: StyleType;
  [RAW]: [string, unknown[], VarSlot[]];
  toString(): string;
}

export function factory(
  type: StyleType = TYPES_CSS,
  context?: InterpolateContext,
) {
  return function (this: unknown, ...args: unknown[]): StyledFactoryResult {
    // interpolate returns [staticBody, keyframes, vars]. vars is the list of
    // CSS custom-property placeholders — {name, fn} — that the render layer
    // applies as inline style. The staticBody contains `var(--name)` in
    // value-slot dynamics and inlined values elsewhere.
    const [css, keyframes, vars] = (interpolate as any).apply(context, args);
    const selector = `${type}-${hash(css)}`;
    return {
      [TYPE]: type,
      [RAW]: [css, keyframes, vars],
      toString: () => selector,
    };
  };
}
