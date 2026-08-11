// styled — turn a tag / component into a styled React component.
//
// Chainable factory returned by `styled(target)`:
//   .attrs(objOrFn)                  — default props applied before caller's
//   .withConfig({ shouldForwardProp, // filter which props reach the DOM
//                 label,             // override the auto-generated label
//                 componentId })     // stable id (SSR / component-selector)
//
// Prop forwarding rules for HOST-TAG targets:
//   * transient `$*` props are always stripped from the DOM
//   * a user-supplied shouldForwardProp REPLACES the default filter
//   * `as`, `SOURCE_ORDER`, `children`, `className`, `ref` are managed here
// Style interpolations always see the FULL props (transients + all) — that's
// the whole point of transients.
'use client';

import React from 'react';
import {
  IS_STYLED_COMPONENT,
  LABEL_PREFIX,
  RAW,
  SOURCE_ORDER,
  type VarSlot,
} from '@filbert-js/types';
import { ThemeContext } from '@filbert-js/theming';
import { __sheet } from '@filbert-js/style-sheet-context';
import { splitAtomicDeclarations } from '@filbert-js/css-parser';
import { factory } from './factory';
import { hash } from './hash';
import { useStylesheet } from './hooks';
import type { Interpolation } from './interpolate';

let id = 1;

// User-supplied predicate: `(prop, target) => boolean` (styled-components
// signature).
export type ShouldForwardProp = (prop: string, target: unknown) => boolean;

// `.attrs(obj)` or `.attrs((props) => obj)`.
export type AttrsDef<P = any> = Partial<P> | ((props: P) => Partial<P>);

export interface WithConfig {
  shouldForwardProp?: ShouldForwardProp;
  label?: string;
  componentId?: string;
  // Opt in to atomic-mode class emission — every DECLARATION becomes its own
  // `.fj-a-<hash-of-decl>` class, and the styled component ships a
  // space-joined list of them. Whole-app cross-component dedup. Only applies
  // to fully-static templates (no var-inversion, no nested selectors). Live
  // templates fall back to today's single-class model.
  atomic?: boolean;
  // Precompiled CSS body — babel-plugin-filbert sets this when every
  // interpolation in the template resolves at build time. The runtime skips
  // interpolate() and registers the string as-is.
  css?: string;
  // Set by a bundler plugin (vite-plugin-filbert / webpack-loader-filbert)
  // after it hoists the compiled CSS body into a linked stylesheet. The rule
  // is already served by the .css chunk so the runtime skips createStyles
  // for this className. `className` carries the class the plugin used to
  // scope the rule in the CSS file.
  preInjected?: boolean;
  className?: string;
}

interface FactoryConfig {
  attrs: AttrsDef[];
  shouldForwardProp: ShouldForwardProp | undefined;
  label: string | undefined;
  componentId: string | undefined;
  atomic: boolean;
  precompiledCss: string | undefined;
  preInjected: boolean;
  preInjectedClassName: string | undefined;
}

// A styled component knows nothing about DOM prop validity — we defer to a
// tiny allowlist. `$*` are always stripped so React never warns / serializes
// them onto the DOM.
function defaultShouldForwardProp(prop: string): boolean {
  if (prop.charCodeAt(0) === 36 /* $ */) return false;
  return true;
}

function applyAttrs(
  attrsList: AttrsDef[] | undefined,
  props: Record<string, unknown>,
): Record<string, unknown> {
  if (!attrsList || attrsList.length === 0) return props;
  const merged: Record<string, unknown> = {};
  for (let i = 0; i < attrsList.length; i++) {
    const def = attrsList[i];
    const resolved: Record<string, unknown> | undefined =
      typeof def === 'function' ? (def as any)(props) : (def as any);
    if (!resolved) continue;
    for (const key in resolved) {
      if (key === 'className') {
        merged.className = merged.className
          ? `${merged.className as string} ${resolved.className}`
          : resolved.className;
      } else {
        merged[key] = resolved[key];
      }
    }
  }
  // Caller props take precedence — merge over defaults.
  for (const key in props) {
    if (key === 'className') {
      merged.className = merged.className
        ? `${merged.className as string} ${props.className}`
        : props.className;
    } else {
      merged[key] = props[key];
    }
  }
  return merged;
}

// The chainable factory returned by `styled(Component)` (and by
// `.attrs(...)` / `.withConfig(...)`). Applied as a tagged template.
export interface StyledFactory<P = any> {
  (strings: TemplateStringsArray, ...interpolations: Interpolation[]): StyledComponent<P>;
  attrs(def: AttrsDef<P>): StyledFactory<P>;
  withConfig(cfg: WithConfig): StyledFactory<P>;
}

export type StyledComponent<P = any> = React.ForwardRefExoticComponent<
  React.PropsWithoutRef<P & { as?: React.ElementType; children?: React.ReactNode }> &
    React.RefAttributes<any>
> & {
  label: string;
  [IS_STYLED_COMPONENT]: true;
};

// Overloads: `styled('div')` uses JSX intrinsic props; `styled(Component)`
// uses that component's props. A bare `styled(Component)` also flows through.
export function styled<Tag extends keyof JSX.IntrinsicElements>(
  Component: Tag,
  options?: { label?: string },
): StyledFactory<JSX.IntrinsicElements[Tag]>;
export function styled<C extends React.ComponentType<any>>(
  Component: C,
  options?: { label?: string },
): StyledFactory<React.ComponentProps<C>>;
export function styled(
  Component: any,
  options: { label?: string } = {},
): StyledFactory<any> {
  return createFactory(Component, {
    attrs: [],
    shouldForwardProp: undefined,
    label: options.label,
    componentId: undefined,
    atomic: false,
    precompiledCss: undefined,
    preInjected: false,
    preInjectedClassName: undefined,
  });
}

function createFactory(Component: any, config: FactoryConfig): StyledFactory<any> {
  function tag(this: unknown, strings: TemplateStringsArray, ...interpolations: unknown[]) {
    const args: unknown[] = [strings, ...interpolations];

    function S(props: Record<string, any>, ref: React.Ref<any>) {
      const theme = React.useContext(ThemeContext);
      const propsWithAttrs = applyAttrs(config.attrs, props);

      let styles: string;
      let keyframes: unknown[];
      let vars: VarSlot[];
      let className: string;

      if (config.preInjected && config.preInjectedClassName) {
        // Bundler already emitted the rule into a linked stylesheet — take
        // the class it used and skip every runtime injection path.
        styles = '';
        keyframes = [];
        vars = [];
        className = config.preInjectedClassName;
      } else if (config.precompiledCss !== undefined) {
        // Fast path — babel already produced the CSS body. Skip interpolate.
        styles = config.precompiledCss;
        keyframes = [];
        vars = [];
        className = `fj-${(hash(styles) >>> 0).toString(36)}`;
      } else {
        const obj = factory(config.label as any, {
          ...propsWithAttrs,
          theme,
          label: ForwardRef.label,
        }).apply(null, args as any);

        const raw = obj[RAW] as [string, unknown[], VarSlot[]];
        styles = raw[0];
        keyframes = raw[1];
        vars = raw[2];
        className = obj.toString();
      }

      // Atomic mode: split declarations, register each as a stand-alone
      // `.fj-a-<hash>` rule, use the space-joined class list as the styled
      // component's className. Only kicks in for FULLY-STATIC bodies — any
      // var-inversion slot or nested block bails to the traditional
      // single-class model.
      const canAtomize =
        config.atomic &&
        vars.length === 0 &&
        styles.indexOf('{') === -1 &&
        styles.indexOf('&') === -1 &&
        styles.indexOf('@') === -1;
      if (config.preInjected && config.preInjectedClassName) {
        // Rule is already in a bundler-linked stylesheet — no createStyles.
      } else if (canAtomize) {
        for (let i = 0; i < keyframes.length; i++) {
          __sheet.createKeyframes(keyframes[i] as any);
        }
        const decls = splitAtomicDeclarations(styles);
        const atomicClasses: string[] = [];
        for (const decl of decls) {
          const cls = `fj-a-${(hash(decl) >>> 0).toString(36)}`;
          atomicClasses.push(cls);
          __sheet.createStyles(cls, decl, undefined, undefined);
        }
        className = atomicClasses.join(' ');
      } else {
        useStylesheet(
          keyframes as any,
          className,
          styles,
          (props as any)[SOURCE_ORDER],
          ForwardRef.label,
        );
      }

      // Resolve CSS-variable placeholders — inline style, no sheet mutation.
      let varStyle: Record<string, unknown> | null = null;
      if (vars && vars.length > 0) {
        varStyle = {};
        const ctx = { ...propsWithAttrs, theme };
        for (let i = 0; i < vars.length; i++) {
          const { name, fn } = vars[i];
          let value: unknown;
          try {
            value = fn(ctx);
          } catch (e) {
            value = null;
          }
          if (value == null || value === false || value === '') continue;
          varStyle[name] = value;
        }
      }

      const {
        className: passedClassName,
        [SOURCE_ORDER]: _sourceOrder,
        as,
        children,
        ...rest
      } = propsWithAttrs as any;

      const target = as || Component;
      const finalIsHostTag = typeof target === 'string';
      const sfp = config.shouldForwardProp || defaultShouldForwardProp;

      const forwardedProps: Record<string, unknown> = {};
      if (finalIsHostTag) {
        for (const key in rest) {
          if (sfp(key, target)) forwardedProps[key] = rest[key];
        }
      } else {
        for (const key in rest) forwardedProps[key] = rest[key];
      }

      const mergedClassName = [ForwardRef.label, className, passedClassName || '']
        .join(' ')
        .trim();

      let mergedStyle: Record<string, unknown> | undefined;
      if (varStyle) {
        mergedStyle = (propsWithAttrs as any).style
          ? { ...varStyle, ...(propsWithAttrs as any).style }
          : varStyle;
      } else {
        mergedStyle = (propsWithAttrs as any).style;
      }

      const finalProps: Record<string, unknown> = Object.assign(forwardedProps, {
        className: mergedClassName,
        [SOURCE_ORDER]: (Component as any)[IS_STYLED_COMPONENT] ? className : undefined,
        ref,
      });
      if (mergedStyle) finalProps.style = mergedStyle;

      return React.createElement(target, finalProps as any, children);
    }

    const ForwardRef = React.forwardRef(S) as unknown as StyledComponent<any>;
    (ForwardRef as any)[IS_STYLED_COMPONENT] = true;
    ForwardRef.label = config.label || `${LABEL_PREFIX}${id}`;
    id++;
    return ForwardRef;
  }

  tag.attrs = function (attrDef: AttrsDef) {
    return createFactory(Component, {
      ...config,
      attrs: [...config.attrs, attrDef],
    });
  };
  tag.withConfig = function (cfg: WithConfig) {
    const next: FactoryConfig = { ...config };
    if (cfg) {
      if (cfg.shouldForwardProp) next.shouldForwardProp = cfg.shouldForwardProp;
      if (cfg.label) next.label = cfg.label;
      if (cfg.componentId) next.componentId = cfg.componentId;
      if (typeof cfg.atomic === 'boolean') next.atomic = cfg.atomic;
      if (typeof cfg.css === 'string') next.precompiledCss = cfg.css;
      if (cfg.preInjected === true) next.preInjected = true;
      if (typeof cfg.className === 'string') next.preInjectedClassName = cfg.className;
    }
    return createFactory(Component, next);
  };
  return tag as unknown as StyledFactory<any>;
}
