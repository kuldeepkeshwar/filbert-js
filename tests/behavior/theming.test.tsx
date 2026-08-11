// ThemeProvider from @filbert-js/theming — context-based runtime theming.
// With var-inversion, theme-driven values become inline-style CSS variables:
// the sheet ships once, the value lives on the element.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { ThemeProvider } from '@filbert-js/theming';
import { renderWithSheet, collectAllCSS } from '../helpers/render';

describe('ThemeProvider basics', () => {
  it('makes theme available via `p.theme` in interpolations', () => {
    const Div = styled.div`
      color: ${(p: any) => p.theme.brand};
    `;
    renderWithSheet(
      <ThemeProvider theme={{ brand: 'red' }}>
        <Div data-testid="d" />
      </ThemeProvider>,
    );
    // Sheet carries `var(--fj-...)`; the resolved theme value drives inline
    // style on the element.
    expect(collectAllCSS()).toMatch(/color\s*:\s*var\(--fj-/);
    const style = screen.getByTestId('d').getAttribute('style') || '';
    expect(style).toMatch(/--fj-[\w-]+:\s*red/);
  });

  it('supports nested ThemeProviders (inner wins)', () => {
    const Div = styled.div`
      color: ${(p: any) => p.theme.brand};
    `;
    renderWithSheet(
      <ThemeProvider theme={{ brand: 'red' }}>
        <ThemeProvider theme={{ brand: 'blue' }}>
          <Div data-testid="inner" />
        </ThemeProvider>
      </ThemeProvider>,
    );
    const style = screen.getByTestId('inner').getAttribute('style') || '';
    expect(style).toMatch(/--fj-[\w-]+:\s*blue/);
  });

  it('theme change: SAME className, DIFFERENT inline style (no sheet churn)', () => {
    const Div = styled.div`
      color: ${(p: any) => p.theme.brand};
    `;
    const { rerender } = renderWithSheet(
      <ThemeProvider theme={{ brand: 'red' }}>
        <Div data-testid="d" />
      </ThemeProvider>,
    );
    const before = screen.getByTestId('d').className;
    const cssBefore = collectAllCSS();
    rerender(
      <ThemeProvider theme={{ brand: 'green' }}>
        <Div data-testid="d" />
      </ThemeProvider>,
    );
    const after = screen.getByTestId('d').className;
    const cssAfter = collectAllCSS();
    // Class is stable — sheet is unchanged. Only inline style updates.
    expect(after).toBe(before);
    expect(cssAfter).toBe(cssBefore);
    const style = screen.getByTestId('d').getAttribute('style') || '';
    expect(style).toMatch(/--fj-[\w-]+:\s*green/);
  });
});

describe('missing ThemeProvider', () => {
  it('resolves p.theme.x to empty when no provider is present (no crash)', () => {
    // ThemeContext defaults to `{}` so `p.theme.brand` is undefined — dropped
    // gracefully. Rendering succeeds.
    const Div = styled.div`
      color: ${(p: any) => p.theme.brand};
    `;
    expect(() => renderWithSheet(<Div />)).not.toThrow();
  });

  it('DOES NOT crash if the interpolation is theme-defensive', () => {
    const Div = styled.div`
      color: ${(p: any) => (p.theme && p.theme.brand) || 'inherit'};
    `;
    expect(() => renderWithSheet(<Div data-testid="d" />)).not.toThrow();
    const style = screen.getByTestId('d').getAttribute('style') || '';
    expect(style).toMatch(/--fj-[\w-]+:\s*inherit/);
  });
});

describe('theme + props', () => {
  it('gives function interpolations access to both theme and own props', () => {
    const Div = styled.div`
      color: ${(p: any) => (p.$dark ? p.theme.dark : p.theme.light)};
    `;
    renderWithSheet(
      <ThemeProvider theme={{ dark: 'black', light: 'white' }}>
        <Div data-testid="a" $dark />
        <Div data-testid="b" />
      </ThemeProvider>,
    );
    const styleA = screen.getByTestId('a').getAttribute('style') || '';
    const styleB = screen.getByTestId('b').getAttribute('style') || '';
    expect(styleA).toMatch(/--fj-[\w-]+:\s*black/);
    expect(styleB).toMatch(/--fj-[\w-]+:\s*white/);
    // AND — critically — both instances share the same className.
    expect(screen.getByTestId('a').className).toBe(screen.getByTestId('b').className);
  });
});
