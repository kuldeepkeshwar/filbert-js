// Atomic CSS mode — opt-in via `.withConfig({ atomic: true })`.
// Each declaration becomes its own `.fj-a-<hash>{decl}` rule; the styled
// component ships a space-joined list of them. Whole-app dedup: two
// components sharing a `color: red` declaration share the SAME atomic class.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { renderWithSheet, collectAllCSS } from '../helpers/render';

describe('atomic mode — basics', () => {
  it('a static template with N decls produces N atomic classes on the element', () => {
    const Btn = styled.button.withConfig({ atomic: true })`
      color: red;
      padding: 8px;
      font-size: 14px;
    `;
    renderWithSheet(<Btn data-testid="b" />);
    const classes = screen.getByTestId('b').className.split(/\s+/);
    const atomic = classes.filter((c) => c.startsWith('fj-a-'));
    expect(atomic.length).toBe(3);
  });

  it('each decl lives in the sheet as `.fj-a-<hash>{decl}`', () => {
    const Btn = styled.button.withConfig({ atomic: true })`
      color: red;
      padding: 8px;
    `;
    renderWithSheet(<Btn />);
    const css = collectAllCSS();
    expect(css).toMatch(/\.fj-a-\w+\s*\{[^}]*color:\s*red/);
    expect(css).toMatch(/\.fj-a-\w+\s*\{[^}]*padding:\s*8px/);
  });

  it('two components sharing a decl share the atomic class (cross-component dedup)', () => {
    const A = styled.button.withConfig({ atomic: true })`
      color: red;
      padding: 8px;
    `;
    const B = styled.span.withConfig({ atomic: true })`
      color: red;
      font-size: 14px;
    `;
    renderWithSheet(
      <>
        <A data-testid="a" />
        <B data-testid="b" />
      </>,
    );
    const aClasses = new Set(
      screen.getByTestId('a').className.split(/\s+/).filter((c) => c.startsWith('fj-a-')),
    );
    const bClasses = new Set(
      screen.getByTestId('b').className.split(/\s+/).filter((c) => c.startsWith('fj-a-')),
    );
    // Some overlap — the `color: red` decl is shared.
    const shared = [...aClasses].filter((c) => bClasses.has(c));
    expect(shared.length).toBe(1);
  });

  it('color:red decl produces only ONE rule in the sheet, even across many components', () => {
    const A = styled.button.withConfig({ atomic: true })`
      color: red;
    `;
    const B = styled.div.withConfig({ atomic: true })`
      color: red;
    `;
    const C = styled.span.withConfig({ atomic: true })`
      color: red;
    `;
    renderWithSheet(
      <>
        <A />
        <B />
        <C />
      </>,
    );
    const css = collectAllCSS();
    // The `color: red` declaration appears exactly ONCE in the sheet.
    const matches = css.match(/color:\s*red/g) || [];
    expect(matches.length).toBe(1);
  });
});

describe('atomic mode — bails to traditional model when it should', () => {
  it('templates with nested selectors DO NOT atomize', () => {
    const Btn = styled.button.withConfig({ atomic: true })`
      color: red;
      &:hover {
        color: blue;
      }
    `;
    renderWithSheet(<Btn data-testid="b" />);
    const classes = screen.getByTestId('b').className.split(/\s+/);
    const atomic = classes.filter((c) => c.startsWith('fj-a-'));
    expect(atomic.length).toBe(0);
    // The traditional single hash-class is still present.
    expect(classes.some((c) => c.startsWith('c-'))).toBe(true);
  });

  it('templates with dynamic (var-inversion) slots DO NOT atomize', () => {
    const Btn = styled.button.withConfig({ atomic: true })`
      color: ${(p: any) => p.$c};
      padding: 8px;
    `;
    renderWithSheet(<Btn data-testid="b" $c="red" />);
    const classes = screen.getByTestId('b').className.split(/\s+/);
    const atomic = classes.filter((c) => c.startsWith('fj-a-'));
    expect(atomic.length).toBe(0);
  });

  it('templates with @media DO NOT atomize', () => {
    const Btn = styled.button.withConfig({ atomic: true })`
      color: red;
      @media (min-width: 600px) {
        color: blue;
      }
    `;
    renderWithSheet(<Btn data-testid="b" />);
    const classes = screen.getByTestId('b').className.split(/\s+/);
    const atomic = classes.filter((c) => c.startsWith('fj-a-'));
    expect(atomic.length).toBe(0);
  });
});

describe('atomic mode is OPT-IN — default behavior unchanged', () => {
  it('a template without .withConfig({ atomic: true }) uses the traditional single class', () => {
    const Btn = styled.button`
      color: red;
      padding: 8px;
    `;
    renderWithSheet(<Btn data-testid="b" />);
    const classes = screen.getByTestId('b').className.split(/\s+/);
    const atomic = classes.filter((c) => c.startsWith('fj-a-'));
    expect(atomic.length).toBe(0);
  });
});
