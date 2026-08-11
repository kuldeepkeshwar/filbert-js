// React 18 StrictMode double-invokes the render function in dev to catch
// unsafe side-effects. Filbert registers styles during the render body (for
// SSR compatibility), so the sheet's dedup guard MUST tolerate double calls
// without corrupting the sheet — otherwise the sheet grows or throws.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { Global } from '@filbert-js/core';
import { renderWithSheet, collectAllCSS, styleTagCount } from '../helpers/render';

describe('React StrictMode compatibility', () => {
  it('rendering under StrictMode does not throw or corrupt the sheet', () => {
    const Btn = styled.button`
      color: red;
      padding: 8px;
    `;
    expect(() =>
      renderWithSheet(
        <React.StrictMode>
          <Btn data-testid="b" />
        </React.StrictMode>,
      ),
    ).not.toThrow();
    expect(screen.getByTestId('b')).toBeTruthy();
    expect(collectAllCSS()).toMatch(/color\s*:\s*red/);
  });

  it('the rule is registered ONCE even under StrictMode double render', () => {
    const Btn = styled.button`
      color: red;
    `;
    renderWithSheet(
      <React.StrictMode>
        <Btn data-testid="b" />
      </React.StrictMode>,
    );
    const css = collectAllCSS();
    // `color: red` appears exactly once — not doubled by the StrictMode
    // second invocation.
    const matches = css.match(/color\s*:\s*red/g) || [];
    expect(matches.length).toBe(1);
  });

  it('StrictMode + dynamic props keeps a stable className (var-inversion)', () => {
    const Btn = styled.button`
      color: ${(p: any) => p.$c};
    `;
    renderWithSheet(
      <React.StrictMode>
        <Btn data-testid="a" $c="red" />
        <Btn data-testid="b" $c="blue" />
      </React.StrictMode>,
    );
    expect(screen.getByTestId('a').className).toBe(screen.getByTestId('b').className);
    // One rule for both variants (S1 invariant preserved).
    const css = collectAllCSS();
    const vars = css.match(/color\s*:\s*var\(--fj-/g) || [];
    expect(vars.length).toBe(1);
  });

  it('StrictMode + <Global> does not double-inject global rules', () => {
    renderWithSheet(
      <React.StrictMode>
        <Global styles={`body { margin: 0; }`} />
      </React.StrictMode>,
    );
    const css = collectAllCSS();
    const matches = css.match(/margin\s*:\s*0/g) || [];
    // At most one — the sheet's dedup by id prevents duplication.
    expect(matches.length).toBeLessThanOrEqual(1);
  });
});
