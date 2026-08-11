// Server-side rendering via @filbert-js/server-stylesheet. Filbert renders
// styles into a virtual DOM (a `Tag` tree in server-stylesheet/index.js),
// exposing `getStyles()` (string) and `getReactElements()` (elements).
import React from 'react';
import { describe, expect, it } from 'vitest';
import ReactDOMServer from 'react-dom/server';
import { styled } from '../helpers/styled';
import { keyframes } from '@filbert-js/core';
import { createStylesheet as createServerSheet } from '@filbert-js/server-stylesheet';
import { createStylesheet as createClientSheet } from '@filbert-js/browser-stylesheet';
import { StyleSheetProvider } from '@filbert-js/style-sheet-context';

describe('server-stylesheet — string output', () => {
  it('renderToString produces markup with a stable className', () => {
    const Button = styled.button`
      color: red;
    `;
    const sheet = createServerSheet();
    const html = ReactDOMServer.renderToString(
      <StyleSheetProvider stylesheet={sheet as any}>
        <Button data-testid="b">hi</Button>
      </StyleSheetProvider>,
    );
    expect(html).toMatch(/<button[^>]+class="[^"]*fj-/);
    expect(html).toContain('hi');
  });

  it('getStyles() returns a string containing the declared CSS', () => {
    const Button = styled.button`
      color: red;
      padding: 8px;
    `;
    const sheet = createServerSheet();
    ReactDOMServer.renderToString(
      <StyleSheetProvider stylesheet={sheet as any}>
        <Button />
      </StyleSheetProvider>,
    );
    const styles = sheet.getStyles();
    expect(typeof styles).toBe('string');
    expect(styles).toMatch(/color\s*:\s*red/);
    expect(styles).toMatch(/padding\s*:\s*8px/);
  });

  it('getStyles() output wraps each rule in a <style data-type="styled-css">', () => {
    const Div = styled.div`
      color: red;
    `;
    const sheet = createServerSheet();
    ReactDOMServer.renderToString(
      <StyleSheetProvider stylesheet={sheet as any}>
        <Div />
      </StyleSheetProvider>,
    );
    const styles = sheet.getStyles();
    expect(styles).toMatch(/<style[^>]*data-type="styled-css"/);
  });
});

describe('server-stylesheet — React elements output', () => {
  it('getReactElements() returns renderable React nodes', () => {
    const Div = styled.div`
      color: red;
    `;
    const sheet = createServerSheet();
    ReactDOMServer.renderToString(
      <StyleSheetProvider stylesheet={sheet as any}>
        <Div />
      </StyleSheetProvider>,
    );
    const els = sheet.getReactElements();
    expect(Array.isArray(els)).toBe(true);
    expect(els.length).toBeGreaterThanOrEqual(1);
    // renderable
    const rendered = ReactDOMServer.renderToStaticMarkup(<div>{els}</div>);
    expect(rendered).toMatch(/color\s*:\s*red/);
  });
});

describe('server-stylesheet — keyframes SSR', () => {
  it('emits the @keyframes rule alongside the styled-component rule', () => {
    const fade = keyframes`from { opacity: 0; } to { opacity: 1; }`;
    const Div = styled.div`
      animation: ${fade} 200ms;
    `;
    const sheet = createServerSheet();
    ReactDOMServer.renderToString(
      <StyleSheetProvider stylesheet={sheet as any}>
        <Div />
      </StyleSheetProvider>,
    );
    const styles = sheet.getStyles();
    expect(styles).toMatch(/@keyframes\s+k-/);
    expect(styles).toMatch(/animation\s*:\s*k-/);
  });
});

describe('client rehydration parity', () => {
  it('rendering the same tree on the server and client produces the same className', () => {
    const Div = styled.div`
      color: ${(p) => p.$c};
    `;

    // Server render
    const serverSheet = createServerSheet();
    const serverHtml = ReactDOMServer.renderToString(
      <StyleSheetProvider stylesheet={serverSheet as any}>
        <Div $c="red" data-testid="d">
          hi
        </Div>
      </StyleSheetProvider>,
    );
    const serverClass = serverHtml.match(/class="([^"]+)"/)[1];

    // Client render (jsdom is our client env)
    const clientSheet = createClientSheet();
    const { renderToString } = ReactDOMServer; // reuse for a static compare
    const clientHtml = renderToString(
      <StyleSheetProvider stylesheet={clientSheet}>
        <Div $c="red" data-testid="d">
          hi
        </Div>
      </StyleSheetProvider>,
    );
    const clientClass = clientHtml.match(/class="([^"]+)"/)[1];

    expect(clientClass).toBe(serverClass);
  });
});
