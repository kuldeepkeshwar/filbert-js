// Symbol/string constants shared across filbert packages.
// String-literal types are narrowed so switches on TYPE / TYPES_* stay
// type-safe.

const key = '__styled';

export const TYPE: unique symbol = Symbol.for(`${key}_type`) as any;
export const RAW: unique symbol = Symbol.for(`${key}_raw`) as any;
export const IS_STYLED_COMPONENT: unique symbol = Symbol.for(`${key}_is`) as any;

export const TYPES_KEYFRAMES = 'k' as const;
export const TYPES_GLOBAL = 'g' as const;
export const TYPES_CSS = 'c' as const;

export type StyleType =
  | typeof TYPES_CSS
  | typeof TYPES_KEYFRAMES
  | typeof TYPES_GLOBAL;

export const SOURCE_ORDER = `${key}_source_order` as const;
export const LABEL_PREFIX = 'fj-' as const;

// A CSS-variable placeholder produced by interpolate for a value-position
// function slot. Applied as inline style by the styled component at render.
export interface VarSlot {
  name: string;
  fn: (ctx: any) => unknown;
}

// Shape of a `keyframes` / `css()` result. `[RAW]` is a tuple
// `[body, keyframes[], vars?]`.
export interface StyledFragment {
  [TYPE]: StyleType;
  [RAW]: [string, StyledFragment[], VarSlot[]?];
  toString(): string;
}
