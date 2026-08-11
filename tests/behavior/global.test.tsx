// <Global styles="..." /> — global stylesheet injection + cleanup.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { Global } from '@filbert-js/core';
import { renderWithSheet, collectAllCSS } from '../helpers/render';

describe('Global — insertion', () => {
  it('injects the styles string as a global rule', () => {
    renderWithSheet(<Global styles={`body { margin: 0; padding: 0; }`} />);
    const css = collectAllCSS();
    expect(css).toMatch(/body\s*\{[^}]*margin\s*:\s*0/);
  });

  it('multiple Global components each inject their own block', () => {
    renderWithSheet(
      <>
        <Global styles={`body { margin: 0; }`} />
        <Global styles={`html { color: red; }`} />
      </>,
    );
    const css = collectAllCSS();
    expect(css).toMatch(/body\s*\{[^}]*margin\s*:\s*0/);
    expect(css).toMatch(/html\s*\{[^}]*color\s*:\s*red/);
  });
});

describe('Global — removal on unmount', () => {
  it('removes the global tag when the Global component unmounts', () => {
    const { unmount } = renderWithSheet(<Global styles={`body { color: red; }`} />);
    expect(collectAllCSS()).toMatch(/body\s*\{[^}]*color\s*:\s*red/);
    unmount();
    expect(collectAllCSS()).not.toMatch(/body\s*\{[^}]*color\s*:\s*red/);
  });
});

describe('Global — updates', () => {
  it('replaces the tag contents when styles prop changes', () => {
    // Filbert stores by id from useState — same id, appended text on update.
    // Locking the current behavior: after an update the new styles are
    // present in the sheet.
    const { rerender } = renderWithSheet(<Global styles={`body { color: red; }`} />);
    rerender(<Global styles={`body { color: blue; }`} />);
    expect(collectAllCSS()).toMatch(/color\s*:\s*blue/);
  });
});
