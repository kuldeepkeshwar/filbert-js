// Resolve tagged-template interpolations, producing:
//   * `styleStr`  — the resolved CSS body with static values inlined AND with
//     `var(--fj-<label>-<slotIdx>)` placeholders where function interpolations
//     could be VALUE-position inverted
//   * `keyframes` — collected keyframe objects
//   * `vars`      — Array<{ name, fn }> — CSS-variable placeholders that must
//     be driven at render time via `element.style.setProperty(name, fn(ctx))`
import {
  IS_STYLED_COMPONENT,
  RAW,
  TYPE,
  TYPES_CSS,
  TYPES_KEYFRAMES,
  type VarSlot,
} from '@filbert-js/types';
import { feedChunk, newScanState, isInvertible, scanSlot } from './scanner';

export type Interpolation =
  | string
  | number
  | boolean
  | null
  | undefined
  | ((ctx: any) => Interpolation)
  | { [TYPE]?: string; [RAW]?: unknown; toString(): string; label?: string; [key: symbol]: unknown };

export interface InterpolateContext {
  label?: string;
  theme?: unknown;
  [key: string]: unknown;
}

export type InterpolateResult = [string, unknown[], VarSlot[]];

// `this` binding carries `context` — provided by `factory.apply(context, ...)`.
// We type it via a parameter-less generic signature; consumers pass context
// through `Function.prototype.apply`.
export function interpolate(
  this: InterpolateContext | undefined,
  styleTemplates: TemplateStringsArray | string[],
  ...variables: Interpolation[]
): InterpolateResult {
  const keyframes: unknown[] = [];
  const vars: VarSlot[] = [];
  const state = newScanState();
  const context: InterpolateContext = this || {};
  const label = context.label || 'fj';
  let styleStr = styleTemplates[0] || '';
  feedChunk(state, styleStr);

  for (let i = 1; i < styleTemplates.length; i++) {
    const variable = variables[i - 1];
    const invertible = isInvertible(scanSlot(state));
    const chunk = resolveSlot(variable, context, keyframes, vars, invertible, label, i - 1);
    styleStr += chunk;
    feedChunk(state, chunk);
    const nextStr = styleTemplates[i] || '';
    styleStr += nextStr;
    feedChunk(state, nextStr);
  }
  return [styleStr, keyframes, vars];
}

function resolveSlot(
  variable: Interpolation,
  context: InterpolateContext,
  keyframes: unknown[],
  vars: VarSlot[],
  invertible: boolean,
  label: string,
  slotIdx: number,
): string {
  if (variable == null || variable === false || variable === '') return '';
  if (typeof variable === 'string' || typeof variable === 'number') return String(variable);
  if (typeof variable === 'function') {
    if (invertible) {
      const name = `--${label}-${slotIdx}`;
      vars.push({ name, fn: variable as (ctx: any) => unknown });
      return `var(${name})`;
    }
    return resolveSlot(
      variable(context) as Interpolation,
      context,
      keyframes,
      vars,
      false,
      label,
      slotIdx,
    );
  }

  const t = (variable as any)[TYPE];
  if (t === TYPES_KEYFRAMES) {
    if (keyframes.indexOf(variable) === -1) keyframes.push(variable);
    return String(variable);
  }
  if (t === TYPES_CSS) {
    const raw = (variable as any)[RAW];
    if (Array.isArray(raw)) {
      const [body, frameList] = raw;
      if (Array.isArray(frameList)) {
        for (const k of frameList) {
          if (keyframes.indexOf(k) === -1) keyframes.push(k);
        }
      }
      return (body as string) || '';
    }
    return '';
  }
  if ((variable as any)[IS_STYLED_COMPONENT]) {
    return `.${(variable as any).label}`;
  }
  try {
    return String(variable);
  } catch (e) {
    return '';
  }
}
