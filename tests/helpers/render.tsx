// Render helper. Filbert's stylesheet is a mutable module singleton — no clean
// reset between tests. StyleSheetProvider swaps the active sheet, so wrapping
// every test render in a fresh provider isolates DOM state per test.
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { StyleSheetProvider } from '@filbert-js/style-sheet-context';
import { createStylesheet } from '@filbert-js/browser-stylesheet';

export function renderWithSheet(ui: React.ReactElement, options?: RenderOptions) {
  const sheet = createStylesheet();
  return {
    sheet,
    ...render(
      <StyleSheetProvider stylesheet={sheet}>{ui}</StyleSheetProvider>,
      options,
    ),
  };
}

export function styleTagCount(): number {
  return document.head.querySelectorAll('style[data-type="styled-css"]').length;
}

export function styleTagsFor(type: 'c' | 'k' | 'g'): HTMLStyleElement[] {
  return Array.from(
    document.head.querySelectorAll<HTMLStyleElement>(
      `style[data-type="styled-css"][styled-type="${type}"]`,
    ),
  );
}

export function allStyleTags(): HTMLStyleElement[] {
  return Array.from(
    document.head.querySelectorAll<HTMLStyleElement>('style[data-type="styled-css"]'),
  );
}

// Serialize a <style> tag's content — for tests. The new stylesheet uses
// CSSOM `insertRule` in the browser, so the tag's textContent is empty and
// the rules live in `sheet.cssRules`. Fall back to textContent for SSR /
// text-append rules.
function serializeStyleTag(el: HTMLStyleElement): string {
  const sheet = el.sheet;
  if (sheet && sheet.cssRules && sheet.cssRules.length > 0) {
    let out = '';
    for (const rule of Array.from(sheet.cssRules)) out += rule.cssText + '\n';
    return out;
  }
  return el.textContent || '';
}

export function collectAllCSS(): string {
  return allStyleTags().map(serializeStyleTag).join('\n');
}
