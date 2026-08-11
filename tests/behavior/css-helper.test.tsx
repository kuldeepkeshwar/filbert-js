// `css` from @filbert-js/core — usable as (a) a JSX `css` prop pragma and
// (b) a fragment that can be interpolated into `styled` templates.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { css, jsx } from '@filbert-js/core';
import { renderWithSheet, collectAllCSS } from '../helpers/render';

describe('css() fragment interpolation into styled templates', () => {
  it('inlines a css fragment — CURRENT BUG: only the fragment class selector is emitted', () => {
    // interpolate.js has no branch for the css() result object (only styled +
    // keyframes), so `${shared}` resolves to `shared.toString()` = the class
    // selector (`c-XXX`) rather than inlining the fragment's raw CSS. The
    // improved runtime should splice css() fragments into the parent template.
    const shared = css`
      color: red;
      padding: 8px;
    `;
    const Div = styled.div`
      ${shared}
      background: blue;
    `;
    renderWithSheet(<Div />);
    const c = collectAllCSS();
    expect(c).toMatch(/color\s*:\s*red/);
    expect(c).toMatch(/padding\s*:\s*8px/);
    expect(c).toMatch(/background\s*:\s*blue/);
  });

  it('same fragment used twice does not crash', () => {
    const shared = css`
      color: red;
    `;
    const Div = styled.div`
      ${shared}
      ${shared}
    `;
    expect(() => renderWithSheet(<Div />)).not.toThrow();
  });
});

describe('css() as a JSX prop — via the runtime jsx pragma', () => {
  // Full babel-pragma-in-bundler coverage lives in the babel-plugin tests.
  it('css prop via the jsx pragma (direct runtime call)', () => {
    const frag = css`
      color: red;
    `;
    // The pragma registers styles at element-creation time against the live
    // __sheet binding, so create the element inside the provider-wrapped tree.
    const WithCssProp = () => jsx('div', { css: frag, 'data-testid': 'd' }, 'hi');
    renderWithSheet(<WithCssProp />);

    const el = screen.getByTestId('d');
    expect(el.classList.contains(frag.toString())).toBe(true);

    const rules = collectAllCSS();
    const cls = frag.toString().replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
    expect(rules).toMatch(new RegExp(`\\.${cls}[^{]*\\{[^}]*color\\s*:\\s*red`));
  });
});
