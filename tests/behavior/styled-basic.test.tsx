// Public API of `styled` from @filbert-js/core.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { renderWithSheet, styleTagCount, collectAllCSS } from '../helpers/render';

describe('styled.tag / styled(tag) / styled(Component) — return shape', () => {
  it('styled.button returns a React component', () => {
    const Button = styled.button`
      color: red;
    `;
    expect(typeof Button === 'object' || typeof Button === 'function').toBe(true);
    expect(Button.$$typeof).toBeDefined();
  });

  it("styled('button') behaves identically to styled.button", () => {
    const A = styled.button`
      color: red;
    `;
    const B = styled('button')`
      color: red;
    `;
    renderWithSheet(
      <>
        <A data-testid="a" />
        <B data-testid="b" />
      </>,
    );
    // Both mount as <button> elements and get some class assigned.
    expect(screen.getByTestId('a').tagName).toBe('BUTTON');
    expect(screen.getByTestId('b').tagName).toBe('BUTTON');
    expect(screen.getByTestId('a').className).toBeTruthy();
    expect(screen.getByTestId('b').className).toBeTruthy();
  });

  it('styled(Component) wraps a React component and forwards className', () => {
    const Inner = React.forwardRef<HTMLSpanElement>(function Inner(props, ref) {
      return <span ref={ref} {...props} data-testid="inner" />;
    });
    const Wrapped = styled(Inner)`
      color: red;
    `;
    renderWithSheet(<Wrapped />);
    const el = screen.getByTestId('inner');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toBeTruthy();
  });
});

describe('rendered DOM structure', () => {
  it('renders a single host element (plus filbert label class)', () => {
    const Button = styled.button`
      color: red;
    `;
    renderWithSheet(<Button data-testid="btn">hi</Button>);
    expect(screen.getByTestId('btn').tagName).toBe('BUTTON');
    expect(screen.getByTestId('btn').textContent).toBe('hi');
  });

  it('passes through arbitrary DOM props (aria-*, data-*, name, id)', () => {
    const Input = styled.input`
      color: red;
    `;
    renderWithSheet(
      <Input
        data-testid="i"
        aria-label="test"
        data-foo="bar"
        name="q"
        id="q1"
        placeholder="p"
      />,
    );
    const el = screen.getByTestId('i');
    expect(el.getAttribute('aria-label')).toBe('test');
    expect(el.getAttribute('data-foo')).toBe('bar');
    expect(el.getAttribute('name')).toBe('q');
    expect(el.getAttribute('id')).toBe('q1');
    expect(el.getAttribute('placeholder')).toBe('p');
  });

  it('preserves children', () => {
    const Div = styled.div`
      color: red;
    `;
    renderWithSheet(
      <Div data-testid="parent">
        <span>a</span>
        <span>b</span>
      </Div>,
    );
    expect(screen.getByTestId('parent').children.length).toBe(2);
  });
});

describe('className merging', () => {
  it("merges the caller's className with the generated one", () => {
    const Button = styled.button`
      color: red;
    `;
    renderWithSheet(<Button data-testid="b" className="user-class" />);
    const cls = screen.getByTestId('b').className;
    expect(cls).toContain('user-class');
    // and at least one filbert-generated class
    expect(cls.split(/\s+/).length).toBeGreaterThanOrEqual(2);
  });

  it("keeps a label class stable across renders", () => {
    const Button = styled.button`
      color: red;
    `;
    const { rerender } = renderWithSheet(<Button data-testid="b" />);
    const first = document.querySelector('[data-testid="b"]').className;
    rerender(<Button data-testid="b" />);
    const second = document.querySelector('[data-testid="b"]').className;
    expect(second).toBe(first);
  });
});

describe('stylesheet side-effects', () => {
  it('injects at least one <style> tag when a styled component mounts', () => {
    const Button = styled.button`
      color: red;
    `;
    expect(styleTagCount()).toBe(0);
    renderWithSheet(<Button />);
    expect(styleTagCount()).toBeGreaterThanOrEqual(1);
  });

  it('the generated stylesheet contains the declared CSS', () => {
    const Button = styled.button`
      color: red;
      padding: 8px 16px;
    `;
    renderWithSheet(<Button />);
    const css = collectAllCSS();
    expect(css).toMatch(/color\s*:\s*red/);
    expect(css).toMatch(/padding\s*:\s*8px\s+16px/);
  });
});
