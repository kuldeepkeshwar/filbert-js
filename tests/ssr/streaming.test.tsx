// Streaming SSR — React 18 `renderToPipeableStream` compatibility.
// The server sheet exposes `flushStyles()` + `hasPendingStyles()` so a
// streaming host can inject style chunks at shell / suspense boundaries.
import React from 'react';
import { describe, expect, it } from 'vitest';
import ReactDOMServer from 'react-dom/server';
import { styled } from '../helpers/styled';
import { keyframes } from '@filbert-js/core';
import { createStylesheet as createServerSheet } from '@filbert-js/server-stylesheet';
import { StyleSheetProvider } from '@filbert-js/style-sheet-context';

describe('flushStyles — incremental style emission', () => {
  it('returns pending styles then clears the pending buffer', () => {
    const A = styled.div`
      color: red;
    `;
    const B = styled.span`
      color: blue;
    `;
    const sheet = createServerSheet();

    // First chunk — renders A.
    ReactDOMServer.renderToString(
      <StyleSheetProvider stylesheet={sheet as any}>
        <A>a</A>
      </StyleSheetProvider>,
    );
    const chunk1 = sheet.flushStyles();
    expect(chunk1).toMatch(/color\s*:\s*red/);
    expect(chunk1).toMatch(/<style[^>]*data-type="styled-css"/);

    // A second immediate flush returns nothing new.
    expect(sheet.flushStyles()).toBe('');
    expect(sheet.hasPendingStyles()).toBe(false);

    // Second chunk — renders B.
    ReactDOMServer.renderToString(
      <StyleSheetProvider stylesheet={sheet as any}>
        <B>b</B>
      </StyleSheetProvider>,
    );
    expect(sheet.hasPendingStyles()).toBe(true);
    const chunk2 = sheet.flushStyles();
    expect(chunk2).toMatch(/color\s*:\s*blue/);
    // chunk2 does NOT re-emit A's rule (already flushed).
    expect(chunk2).not.toMatch(/color\s*:\s*red/);
  });

  it('emits keyframes in the k bucket, component css in the c bucket', () => {
    const fade = keyframes`from { opacity: 0; } to { opacity: 1; }`;
    const A = styled.div`
      animation: ${fade} 200ms;
    `;
    const sheet = createServerSheet();
    ReactDOMServer.renderToString(
      <StyleSheetProvider stylesheet={sheet as any}>
        <A />
      </StyleSheetProvider>,
    );
    const flushed = sheet.flushStyles();
    // Both bucket wrappers should appear at least once.
    expect(flushed).toMatch(/styled-type="k"/);
    expect(flushed).toMatch(/styled-type="c"/);
    expect(flushed).toMatch(/@keyframes/);
  });

  it('hasPendingStyles returns false on an empty sheet', () => {
    const sheet = createServerSheet();
    expect(sheet.hasPendingStyles()).toBe(false);
    expect(sheet.flushStyles()).toBe('');
  });
});

describe('collectStyles wrapping still works', () => {
  it('is a function that wraps a React tree with the provider', () => {
    const sheet = createServerSheet();
    const Btn = styled.button`
      color: red;
    `;
    const wrapped = sheet.collectStyles(<Btn>x</Btn>);
    const html = ReactDOMServer.renderToStaticMarkup(wrapped);
    expect(html).toContain('<button');
    expect(html).toMatch(/class="[^"]*fj-/);
  });
});
