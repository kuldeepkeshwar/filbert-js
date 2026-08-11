// Custom-property inversion — the S1 differentiator.
//
// When a styled component has function interpolations in VALUE position, the
// compiled rule ships once with `var(--fj-N)` placeholders; runtime drives the
// variables via inline `style.setProperty` on the DOM node. Net effect:
//
//   * ONE rule per styled component regardless of how many prop values are
//     used across the app
//   * className is STABLE across prop changes — the same class works for every
//     variant, only the inline style var differs
//   * animation-friendly: CSS transitions can interpolate between values
//     because the class doesn't churn per frame
//
// Non-value-position slots (selector, block) still hash-per-value — invert is
// only applied where the browser accepts a `var()` in its place.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { ThemeProvider } from '@filbert-js/theming';
import {
  renderWithSheet,
  collectAllCSS,
  styleTagCount,
} from '../helpers/render';

describe('static templates (no dynamics)', () => {
  it('mount → one class, one rule (unchanged)', () => {
    const Btn = styled.button`
      color: red;
      padding: 8px;
    `;
    renderWithSheet(<Btn data-testid="b" />);
    expect(collectAllCSS()).toMatch(/color\s*:\s*red/);
  });
});

describe('value-slot dynamic interpolations invert to CSS variables', () => {
  it('the compiled rule contains var(--fj-...)', () => {
    const Btn = styled.button`
      color: ${(p: any) => p.$c};
    `;
    renderWithSheet(<Btn data-testid="b" $c="red" />);
    const css = collectAllCSS();
    expect(css).toMatch(/color\s*:\s*var\(--fj-[\w-]+\)/);
  });

  it('the DOM element carries an inline style setting the variable', () => {
    const Btn = styled.button`
      color: ${(p: any) => p.$c};
    `;
    renderWithSheet(<Btn data-testid="b" $c="red" />);
    const el = screen.getByTestId('b');
    // element.style.getPropertyValue works for CSS custom properties.
    const styleAttr = el.getAttribute('style') || '';
    expect(styleAttr).toMatch(/--fj-[\w-]+:\s*red/);
  });

  it('two instances with different prop values share the SAME className', () => {
    const Btn = styled.button`
      color: ${(p: any) => p.$c};
    `;
    renderWithSheet(
      <>
        <Btn data-testid="a" $c="red" />
        <Btn data-testid="b" $c="blue" />
      </>,
    );
    const a = screen.getByTestId('a').className;
    const b = screen.getByTestId('b').className;
    expect(a).toBe(b);
  });

  it('two instances with different prop values inject ONE rule (not two)', () => {
    const Btn = styled.button`
      color: ${(p: any) => p.$c};
    `;
    renderWithSheet(
      <>
        <Btn $c="red" />
        <Btn $c="blue" />
        <Btn $c="green" />
        <Btn $c="yellow" />
      </>,
    );
    // One `color: var(--fj-N)` rule across all four variants.
    const css = collectAllCSS();
    const matches = css.match(/color\s*:\s*var\(/g) || [];
    expect(matches.length).toBe(1);
  });

  it('re-render with a NEW value updates the inline style, not the sheet', () => {
    const Btn = styled.button`
      color: ${(p: any) => p.$c};
    `;
    const { rerender } = renderWithSheet(<Btn data-testid="b" $c="red" />);
    const cssBefore = collectAllCSS();
    rerender(<Btn data-testid="b" $c="purple" />);
    const cssAfter = collectAllCSS();
    expect(cssAfter).toBe(cssBefore); // sheet unchanged
    // But the inline style did change.
    const style = screen.getByTestId('b').getAttribute('style') || '';
    expect(style).toMatch(/--fj-[\w-]+:\s*purple/);
  });

  it('multiple value-slot dynamics get distinct var names', () => {
    const Btn = styled.button`
      color: ${(p: any) => p.$c};
      padding: ${(p: any) => p.$p};
    `;
    renderWithSheet(<Btn data-testid="b" $c="red" $p="8px" />);
    const css = collectAllCSS();
    // Two var(--fj-...) placeholders in the rule.
    expect((css.match(/var\(--fj-[\w-]+\)/g) || []).length).toBe(2);
    const style = screen.getByTestId('b').getAttribute('style') || '';
    expect(style).toMatch(/red/);
    expect(style).toMatch(/8px/);
  });
});

describe('theme-driven values invert too', () => {
  it('p.theme.brand becomes a CSS variable', () => {
    const Btn = styled.button`
      color: ${(p: any) => p.theme.brand};
    `;
    renderWithSheet(
      <ThemeProvider theme={{ brand: 'crimson' }}>
        <Btn data-testid="b" />
      </ThemeProvider>,
    );
    const style = screen.getByTestId('b').getAttribute('style') || '';
    expect(style).toMatch(/crimson/);
    // and the sheet has `var(...)` not `crimson`.
    expect(collectAllCSS()).toMatch(/var\(--fj-/);
  });
});

describe('non-value-position dynamics fall back (no inversion)', () => {
  // We can't put var() into a SELECTOR. When the dynamic slot is a selector or
  // block position, we call the fn and inline. Different values → different
  // classes (today's behavior).
  it('component-selector interpolation still resolves inline', () => {
    const Child = styled.span`
      color: red;
    `;
    const Parent = styled.div`
      ${Child} {
        color: blue;
      }
    `;
    renderWithSheet(
      <Parent>
        <Child />
      </Parent>,
    );
    const css = collectAllCSS();
    // The child's class-selector must appear in the parent's rule text (not
    // as a var).
    const childCls = document.querySelector('span').className.split(' ').find(Boolean);
    expect(css).toContain(childCls);
  });
});
