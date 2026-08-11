// `keyframes` from @filbert-js/core — CSS animation-name interop.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { keyframes } from '@filbert-js/core';
import { renderWithSheet, collectAllCSS } from '../helpers/render';

describe('keyframes basics', () => {
  it('returns an object that stringifies to a class-like identifier', () => {
    const fade = keyframes`
      from { opacity: 0; }
      to { opacity: 1; }
    `;
    expect(String(fade)).toBeTruthy();
    expect(String(fade)).toMatch(/^k-/); // filbert prefixes keyframe hashes with the TYPES_KEYFRAMES letter
  });

  it('does NOT leak a trailing comma from the RAW array into the sheet — CURRENT BUG', () => {
    // stylesheet.js line 56: `@keyframes ${keyframe} {${keyframe[RAW]}}` —
    // `keyframe[RAW]` is `[css, keyframes[]]`; template-string coerces via
    // Array.prototype.toString which joins with a comma, so a stray `,}` ends
    // up in the emitted rule. The improved sheet should read RAW[0] directly.
    const fade = keyframes`from { opacity: 0; } to { opacity: 1; }`;
    const Div = styled.div`
      animation: ${fade} 200ms;
    `;
    renderWithSheet(<Div />);
    // The malformed close is `,}` immediately before the OUTER `}` of the
    // @keyframes rule. In filbert's current output there's a `,` right before
    // the second-to-last `}` in the whole sheet.
    expect(collectAllCSS()).not.toMatch(/,\s*\}\s*<\/style>|,\s*\}\s*$/m);
    // Structural check that catches it more reliably:
    expect(collectAllCSS()).not.toContain(',}');
  });

  it('injects the @keyframes rule when consumed by a styled component', () => {
    const fade = keyframes`
      from { opacity: 0; }
      to { opacity: 1; }
    `;
    const Div = styled.div`
      animation: ${fade} 200ms;
    `;
    renderWithSheet(<Div />);
    const css = collectAllCSS();
    expect(css).toMatch(/@keyframes\s+k-/);
    expect(css).toMatch(/from/);
    expect(css).toMatch(/to/);
    expect(css).toMatch(/animation\s*:\s*k-/);
  });
});

describe('keyframes dedup', () => {
  it('two components using the same keyframes share one @keyframes rule', () => {
    const fade = keyframes`
      from { opacity: 0; }
      to { opacity: 1; }
    `;
    const A = styled.div`
      animation: ${fade} 200ms;
    `;
    const B = styled.span`
      animation: ${fade} 300ms;
    `;
    renderWithSheet(
      <>
        <A />
        <B />
      </>,
    );
    const kfMatches = collectAllCSS().match(/@keyframes\s+k-[-\w]+/g) || [];
    expect(new Set(kfMatches).size).toBe(1);
  });

  it('two different keyframes produce two @keyframes rules', () => {
    const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
    const fadeOut = keyframes`from { opacity: 1; } to { opacity: 0; }`;
    const A = styled.div`
      animation: ${fadeIn} 200ms;
    `;
    const B = styled.div`
      animation: ${fadeOut} 200ms;
    `;
    renderWithSheet(
      <>
        <A />
        <B />
      </>,
    );
    const kfMatches = collectAllCSS().match(/@keyframes\s+k-[-\w]+/g) || [];
    expect(new Set(kfMatches).size).toBe(2);
  });
});
