// Single-sheet stylesheet manager.
//
// Model:
//   * ONE `<style>` tag per bucket — keyframes / component-css / globals.
//     Lazily attached only when non-empty.
//   * Browser: CSSOM `sheet.insertRule` — no text reparse per rule add.
//   * Server: text-append (via virtual Tag). Same API.
//   * Regular component CSS + keyframes are NEVER removed on unmount —
//     eliminates the querySelector-on-unmount hazard.
//   * Global styles ARE removed on `<Global>` unmount (explicit boundary).
import {
  RAW,
  TYPES_CSS,
  TYPES_GLOBAL,
  TYPES_KEYFRAMES,
  type StyleType,
} from '@filbert-js/types';

// Minimal shape the sheet needs from its host. Real DOM elements and the
// server-stylesheet virtual Tag both satisfy this.
export interface SheetElement {
  append(...args: any[]): void;
  setAttribute(key: string, value: string): void;
  getAttribute(key: string): string | null;
  remove?: () => void;
  firstChild?: unknown;
  removeChild?: (child: any) => any;
  sheet?: CSSStyleSheet | null;
  _children?: any[];
  parentNode?: unknown;
}

export interface SheetRoot {
  append(child: SheetElement): void;
}

export interface StyleSheetInit {
  getRoot: () => SheetRoot;
  createElement: (tag: string) => SheetElement;
  cssParser: (input: { css: string; namespace: string }) => string;
  // Legacy params kept for API compat; unused by the new implementation.
  findElementByStyleId?: (cls: string) => unknown;
  css?: unknown;
}

interface KeyframeLike {
  [RAW]: [string, unknown[]] | string;
  toString(): string;
}

// Split a compiled CSS string into individual top-level rules. `insertRule`
// accepts one rule per call, so we split before calling it.
function splitTopLevelRules(css: string): string[] {
  const rules: string[] = [];
  const len = css.length;
  let depth = 0;
  let quote = 0;
  let start = 0;
  for (let i = 0; i < len; i++) {
    const c = css.charCodeAt(i);
    if (quote) {
      if (c === 92 && i + 1 < len) {
        i++;
        continue;
      }
      if (c === quote) quote = 0;
      continue;
    }
    if (c === 34 || c === 39) {
      quote = c;
      continue;
    }
    if (c === 123 /* { */) depth++;
    else if (c === 125 /* } */) {
      depth--;
      if (depth === 0) {
        const r = css.slice(start, i + 1).trim();
        if (r) rules.push(r);
        start = i + 1;
      }
    }
  }
  const tail = css.slice(start).trim();
  if (tail) rules.push(tail);
  return rules;
}

function insertRuleSheet(el: SheetElement): CSSStyleSheet | null {
  return el && el.sheet && typeof el.sheet.insertRule === 'function' ? el.sheet : null;
}

function insertBlock(el: SheetElement, compiled: string): number {
  const sheet = insertRuleSheet(el);
  if (!sheet) {
    el.append(compiled);
    return 0;
  }
  const rules = splitTopLevelRules(compiled);
  let inserted = 0;
  for (const rule of rules) {
    try {
      sheet.insertRule(rule, sheet.cssRules.length);
      inserted++;
    } catch (e) {
      // Best-effort text-append fallback for a rule the CSSOM rejects.
      el.append(rule);
    }
  }
  return inserted;
}

function clearSheet(el: SheetElement): void {
  const sheet = insertRuleSheet(el);
  if (sheet) {
    while (sheet.cssRules.length > 0) sheet.deleteRule(0);
  }
  if (el._children) {
    el._children.length = 0;
    return;
  }
  while (el.firstChild) el.removeChild!(el.firstChild);
}

export interface StyleSheetAPI {
  createStyles: (id: string, css: string, sourceOrder?: string, label?: string) => void;
  createKeyframes: (keyframe: KeyframeLike) => void;
  createGlobalStyles: (id: string, styles: string) => void;
  removeStyles: (hash: string, type: StyleType) => void;
  getStyles: () => {
    root: SheetRoot;
    css: Record<StyleType, Record<string, string>>;
  };
}

export function StyleSheet(init: StyleSheetInit): StyleSheetAPI {
  const { getRoot, createElement, cssParser } = init;
  const root = getRoot();

  const cssRules: { id: string; css: string }[] = [];
  const cssRuleIds = new Set<string>();
  const keyframesRules = new Map<string, string>();
  const globalsRules = new Map<string, string>();

  let cssTag: SheetElement | null = null;
  let keyframesTag: SheetElement | null = null;
  let globalsTag: SheetElement | null = null;

  function makeTag(styleType: StyleType): SheetElement {
    const el = createElement('style');
    el.setAttribute('data-type', 'styled-css');
    el.setAttribute('styled-type', styleType);
    return el;
  }

  function ensureCssTag(): SheetElement {
    if (!cssTag) {
      cssTag = makeTag(TYPES_CSS);
      root.append(cssTag);
    }
    return cssTag;
  }
  function ensureKeyframesTag(): SheetElement {
    if (!keyframesTag) {
      keyframesTag = makeTag(TYPES_KEYFRAMES);
      root.append(keyframesTag);
    }
    return keyframesTag;
  }
  function ensureGlobalsTag(): SheetElement {
    if (!globalsTag) {
      globalsTag = makeTag(TYPES_GLOBAL);
      root.append(globalsTag);
    }
    return globalsTag;
  }

  function tagLabel(el: SheetElement, label: string): void {
    const existing = el.getAttribute('styled-component-type') || '';
    if (!existing.split(' ').includes(label)) {
      el.setAttribute(
        'styled-component-type',
        existing ? `${existing} ${label}` : label,
      );
    }
  }

  function reflowCssTag(): void {
    const el = ensureCssTag();
    clearSheet(el);
    for (const r of cssRules) insertBlock(el, r.css);
  }

  function createStyles(id: string, css: string, sourceOrder?: string, label?: string): void {
    if (cssRuleIds.has(id)) return;
    const compiled = cssParser({ css, namespace: `.${id}` });
    cssRuleIds.add(id);

    let idx = -1;
    if (sourceOrder) {
      for (let i = 0; i < cssRules.length; i++) {
        if (cssRules[i].id === sourceOrder) {
          idx = i;
          break;
        }
      }
    }
    const el = ensureCssTag();
    if (label) tagLabel(el, label);

    if (idx === -1) {
      cssRules.push({ id, css: compiled });
      insertBlock(el, compiled);
    } else {
      cssRules.splice(idx, 0, { id, css: compiled });
      reflowCssTag();
    }
  }

  function createKeyframes(keyframe: KeyframeLike): void {
    const name = String(keyframe);
    if (keyframesRules.has(name)) return;
    const raw = keyframe[RAW];
    const body = Array.isArray(raw) ? (raw[0] as string) : String(raw ?? '');
    const rule = `@keyframes ${name}{${body}}`;
    keyframesRules.set(name, rule);
    insertBlock(ensureKeyframesTag(), rule);
  }

  function createGlobalStyles(id: string, styles: string): void {
    const trimmed = styles.trim();
    if (globalsRules.get(id) === trimmed) return;
    globalsRules.set(id, trimmed);
    const el = ensureGlobalsTag();
    clearSheet(el);
    for (const [, text] of globalsRules) insertBlock(el, text);
  }

  function removeStyles(hash: string, type: StyleType): void {
    if (type !== TYPES_GLOBAL) return;
    if (!globalsRules.has(hash)) return;
    globalsRules.delete(hash);
    if (globalsRules.size === 0) {
      if (globalsTag && typeof globalsTag.remove === 'function') {
        globalsTag.remove();
      }
      globalsTag = null;
      return;
    }
    const el = ensureGlobalsTag();
    clearSheet(el);
    for (const [, text] of globalsRules) insertBlock(el, text);
  }

  function getStyles() {
    const c: Record<string, string> = {};
    for (const r of cssRules) c[r.id] = r.css;
    const k: Record<string, string> = {};
    for (const [name, rule] of keyframesRules) k[name] = rule;
    const g: Record<string, string> = {};
    for (const [id, text] of globalsRules) g[id] = text;
    return {
      root,
      css: { [TYPES_CSS]: c, [TYPES_KEYFRAMES]: k, [TYPES_GLOBAL]: g } as Record<
        StyleType,
        Record<string, string>
      >,
    };
  }

  return {
    getStyles,
    createStyles,
    createKeyframes,
    createGlobalStyles,
    removeStyles,
  };
}
