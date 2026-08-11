import React from 'react';
import { StyleSheet, type StyleSheetAPI } from '@filbert-js/stylesheet';
import { StyleSheetProvider } from '@filbert-js/style-sheet-context';
import { createParser } from '@filbert-js/css-parser';

const cssParser = createParser();

interface AttrEntry {
  name: string;
  value: string;
}

// Virtual DOM node — the server counterpart to a real `<style>` element.
// Duck-types the SheetElement interface StyleSheet expects.
class Tag {
  _type: string;
  _attributes: AttrEntry[] = [];
  _children: Array<Tag | string> = [];
  _parent: Tag | undefined;

  constructor(type: string) {
    this._type = type;
  }
  remove(): void {
    this._parent?.removeChild(this);
  }
  setAttribute(name: string, value: string): void {
    const attr = this._attributes.find((a) => a.name === name);
    if (attr) attr.value = value;
    else this._attributes.push({ name, value });
  }
  getAttribute(name: string): string | null {
    const attr = this._attributes.find((a) => a.name === name);
    return attr ? attr.value : null;
  }
  append(child: Tag | string): void {
    if (typeof child === 'string') {
      this._children.push(child);
    } else {
      this._children.push(child);
      child._parent = this;
    }
  }
  removeChild(child: Tag): void {
    this._children = this._children.filter((c) => c !== child);
  }
  toString(): string {
    if (this._type === 'root') return this.toInnerHTML();
    const attrs = this._attributes
      .map((a) => `${a.name}="${a.value}"`)
      .join(' ');
    return `<${this._type} ${attrs}>${this.toInnerHTML()}</${this._type}>`;
  }
  toInnerHTML(): string {
    return this._children
      .map((c) => (typeof c === 'string' ? c : c.toString()))
      .join('');
  }
  toReactElements(): React.ReactNode[] {
    return this._children.map((child, index) => {
      if (typeof child === 'string') return child;
      const Type = child._type as any;
      const attrs: Record<string, string> = {};
      for (const a of child._attributes) attrs[a.name] = a.value;
      return React.createElement(
        Type,
        { ...attrs, key: index },
        child._children.map((c) =>
          typeof c === 'string' ? c : (c as Tag).toReactElements(),
        ),
      );
    });
  }
}

// Overrides `getStyles` to return the serialized markup string. Uses Omit so
// the return-type difference doesn't clash with the base API's shape.
export interface ServerStyleSheetAPI extends Omit<StyleSheetAPI, 'getStyles'> {
  getStyles: () => string;
  getReactElements: () => React.ReactNode[];
  collectStyles: (app: React.ReactNode) => React.ReactElement;
  // Streaming SSR helpers — React 18 `renderToPipeableStream` /
  // `renderToReadableStream`.
  //
  //   * `flushStyles()` returns everything collected SINCE the previous flush
  //     (or since sheet creation) as a ready-to-inject `<style>` HTML string,
  //     then clears the pending buffer. Callers write this into the streamed
  //     HTML at each chunk / shell boundary.
  //   * `hasPendingStyles()` — cheap check so a streaming host can decide
  //     whether to emit anything at the next boundary.
  flushStyles: () => string;
  hasPendingStyles: () => boolean;
}

function init() {
  const root = new Tag('root');
  return {
    getRoot: () => root as any,
    createElement: (type: string) => new Tag(type) as any,
    findElementByStyleId: (_: string) => undefined,
  };
}

function collectStyles(stylesheet: StyleSheetAPI) {
  return (app: React.ReactNode) =>
    React.createElement(StyleSheetProvider, { stylesheet }, app);
}

export const createStylesheet = (
  options: Record<string, unknown> = {},
): ServerStyleSheetAPI => {
  const { getRoot, createElement, findElementByStyleId } = init();
  const baseSheet = StyleSheet({
    getRoot,
    createElement,
    findElementByStyleId,
    cssParser,
    ...options,
  });

  const _getStyles = baseSheet.getStyles.bind(baseSheet);

  // Track how much of the virtual sheet has already been flushed by the
  // streaming helpers so we don't re-emit rules on subsequent chunks. The
  // count is over the OUTER root's children list — each `<style>` bucket tag
  // is one child of root. Streaming semantics: on each flushStyles call we
  // serialize just the new content added since the previous call, wrap it in
  // an HTML string, and advance the marker.
  const flushedRuleIndex = { c: 0, k: 0, g: 0 };

  function bucketByType(): Record<string, Tag | undefined> {
    // Root children are the c/k/g `<style>` tags. Enumerate by attribute.
    const root = _getStyles().root as unknown as Tag;
    const map: Record<string, Tag | undefined> = { c: undefined, k: undefined, g: undefined };
    for (const child of root._children) {
      if (typeof child === 'string') continue;
      const t = (child as Tag).getAttribute('styled-type');
      if (t === 'c' || t === 'k' || t === 'g') map[t] = child as Tag;
    }
    return map;
  }

  function flushStyles(): string {
    const buckets = bucketByType();
    let out = '';
    for (const type of ['k', 'g', 'c'] as const) {
      const el = buckets[type];
      if (!el) continue;
      const prev = flushedRuleIndex[type];
      const cur = el._children.length;
      if (cur <= prev) continue;
      let body = '';
      for (let i = prev; i < cur; i++) {
        const c = el._children[i];
        body += typeof c === 'string' ? c : (c as Tag).toString();
      }
      flushedRuleIndex[type] = cur;
      if (body) out += `<style data-type="styled-css" styled-type="${type}">${body}</style>`;
    }
    return out;
  }

  function hasPendingStyles(): boolean {
    const buckets = bucketByType();
    for (const type of ['k', 'g', 'c'] as const) {
      const el = buckets[type];
      if (el && el._children.length > flushedRuleIndex[type]) return true;
    }
    return false;
  }

  const serverSheet: ServerStyleSheetAPI = {
    createStyles: baseSheet.createStyles,
    createKeyframes: baseSheet.createKeyframes,
    createGlobalStyles: baseSheet.createGlobalStyles,
    removeStyles: baseSheet.removeStyles,
    getStyles: (): string => {
      const { root } = _getStyles();
      return (root as unknown as Tag).toString();
    },
    getReactElements: (): React.ReactNode[] => {
      const { root } = _getStyles();
      return (root as unknown as Tag).toReactElements();
    },
    collectStyles: (app: React.ReactNode) =>
      React.createElement(StyleSheetProvider, { stylesheet: baseSheet }, app),
    flushStyles,
    hasPendingStyles,
  };
  return serverSheet;
};

export { createStyleFlusher } from './streaming';
