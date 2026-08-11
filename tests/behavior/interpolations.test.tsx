// Dynamic interpolation behavior — string/number/nullish/function values,
// theme access, receiving props, receiving computed values.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { renderWithSheet, collectAllCSS } from '../helpers/render';

describe('literal interpolations', () => {
  it('inlines a string value', () => {
    const Div = styled.div`
      color: ${'red'};
    `;
    renderWithSheet(<Div data-testid="d" />);
    expect(collectAllCSS()).toMatch(/color\s*:\s*red/);
  });

  it('inlines a numeric value', () => {
    const Div = styled.div`
      opacity: ${0.5};
    `;
    renderWithSheet(<Div />);
    expect(collectAllCSS()).toMatch(/opacity\s*:\s*0\.5/);
  });

  it('inlines a template with multiple slots', () => {
    const Div = styled.div`
      color: ${'red'};
      background: ${'blue'};
    `;
    renderWithSheet(<Div />);
    const css = collectAllCSS();
    expect(css).toMatch(/color\s*:\s*red/);
    expect(css).toMatch(/background\s*:\s*blue/);
  });
});

describe('function interpolations — prop-driven styles (via CSS var inversion)', () => {
  it('calls the function against props and drives the value via inline style', () => {
    const Div = styled.div`
      color: ${(p: any) => p.$c};
    `;
    renderWithSheet(<Div data-testid="d" $c="red" />);
    // Sheet carries `var(--fj-...)`, element carries the resolved value in
    // inline style.
    expect(collectAllCSS()).toMatch(/color\s*:\s*var\(--fj-/);
    const style = screen.getByTestId('d').getAttribute('style') || '';
    expect(style).toMatch(/--fj-[\w-]+:\s*red/);
  });

  it('different prop values share the SAME className (var-inversion)', () => {
    const Div = styled.div`
      color: ${(p: any) => p.$c};
    `;
    renderWithSheet(
      <>
        <Div data-testid="a" $c="red" />
        <Div data-testid="b" $c="blue" />
      </>,
    );
    // The WHOLE point of inversion: one class, many values.
    expect(screen.getByTestId('a').className).toBe(screen.getByTestId('b').className);
  });

  it('same prop value across two instances re-uses the className', () => {
    const Div = styled.div`
      color: ${(p: any) => p.$c};
    `;
    renderWithSheet(
      <>
        <Div data-testid="a" $c="red" />
        <Div data-testid="b" $c="red" />
      </>,
    );
    expect(screen.getByTestId('a').className).toBe(screen.getByTestId('b').className);
  });
});

describe('nullish interpolations', () => {
  // Filbert's interpolate.js resolves nullish/false straight through toString,
  // producing literal 'null' / 'undefined' / 'false' in the CSS. Locking the
  // CURRENT behavior — the improved runtime should DROP them instead.
  it('drops null interpolations', () => {
    const Div = styled.div`
      color: red;
      background: ${null};
    `;
    renderWithSheet(<Div />);
    expect(collectAllCSS()).not.toMatch(/background\s*:\s*null/);
  });

  it('drops undefined interpolations', () => {
    const Div = styled.div`
      color: red;
      background: ${undefined};
    `;
    renderWithSheet(<Div />);
    expect(collectAllCSS()).not.toMatch(/background\s*:\s*undefined/);
  });

  it('drops false interpolations', () => {
    const Div = styled.div`
      color: red;
      background: ${false};
    `;
    renderWithSheet(<Div />);
    expect(collectAllCSS()).not.toMatch(/background\s*:\s*false/);
  });
});

describe('interpolations inside nested selectors', () => {
  it('inlines a var placeholder inside a pseudo block; inline style drives the value', () => {
    const Div = styled.div`
      &:hover {
        color: ${(p: any) => p.$c};
      }
    `;
    renderWithSheet(<Div data-testid="d" $c="red" />);
    const css = collectAllCSS();
    expect(css).toMatch(/:hover/);
    expect(css).toMatch(/color\s*:\s*var\(--fj-/);
    const style = screen.getByTestId('d').getAttribute('style') || '';
    expect(style).toMatch(/--fj-[\w-]+:\s*red/);
  });

  it('inlines a var placeholder inside @media; inline style drives the value', () => {
    const Div = styled.div`
      @media (min-width: 600px) {
        color: ${(p: any) => p.$c};
      }
    `;
    renderWithSheet(<Div data-testid="d" $c="red" />);
    const css = collectAllCSS();
    expect(css).toMatch(/@media/);
    expect(css).toMatch(/color\s*:\s*var\(--fj-/);
    const style = screen.getByTestId('d').getAttribute('style') || '';
    expect(style).toMatch(/--fj-[\w-]+:\s*red/);
  });
});
