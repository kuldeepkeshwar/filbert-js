// Prop-forwarding behavior — new in the refactor.
//
// Three surfaces are being added:
//   1. Transient `$-prefix` props: `<Btn $primary>` — `$primary` drives styles
//      but is NOT forwarded to the DOM element. Matches modern
//      styled-components API.
//   2. `withConfig({ shouldForwardProp })` — user-controllable predicate.
//   3. `.attrs(objOrFn)` chain — default DOM attributes / props to apply.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { renderWithSheet, collectAllCSS } from '../helpers/render';

describe('transient $-prefix props', () => {
  it('$-prefixed props are NOT forwarded to a host element', () => {
    const Btn = styled.button`
      color: ${(p: any) => (p.$primary ? 'blue' : 'gray')};
    `;
    renderWithSheet(<Btn data-testid="b" $primary />);
    const el = screen.getByTestId('b');
    expect(el.getAttribute('$primary')).toBeNull();
    expect(el.getAttribute('primary')).toBeNull();
    // React warns on unknown DOM attributes; the transient filter prevents
    // that warning AND prevents the prop from appearing in the DOM.
  });

  it('$-prefixed props still reach the interpolation function (drives the inline var)', () => {
    const Btn = styled.button`
      color: ${(p: any) => (p.$primary ? 'blue' : 'gray')};
    `;
    renderWithSheet(<Btn data-testid="b" $primary />);
    // The sheet has `var(...)`; the resolved value lives in inline style.
    expect(collectAllCSS()).toMatch(/color\s*:\s*var\(--fj-/);
    const style = screen.getByTestId('b').getAttribute('style') || '';
    expect(style).toMatch(/--fj-[\w-]+:\s*blue/);
  });

  it('non-transient props ARE forwarded (as before)', () => {
    const Btn = styled.button`
      color: red;
    `;
    renderWithSheet(<Btn data-testid="b" type="submit" name="q" />);
    const el = screen.getByTestId('b');
    expect(el.getAttribute('type')).toBe('submit');
    expect(el.getAttribute('name')).toBe('q');
  });
});

describe('withConfig({ shouldForwardProp })', () => {
  it('user-supplied predicate controls what reaches the DOM', () => {
    const Btn = styled.button.withConfig({
      shouldForwardProp: (prop: string) => !['variant', 'size'].includes(prop),
    })`
      color: ${(p: any) => (p.variant === 'primary' ? 'blue' : 'gray')};
    `;
    renderWithSheet(<Btn data-testid="b" variant="primary" size="lg" name="q" />);
    const el = screen.getByTestId('b');
    expect(el.getAttribute('variant')).toBeNull();
    expect(el.getAttribute('size')).toBeNull();
    expect(el.getAttribute('name')).toBe('q');
  });

  it('interpolation still sees all props (predicate only gates the DOM)', () => {
    const Btn = styled.button.withConfig({
      shouldForwardProp: (prop: string) => prop !== 'variant',
    })`
      color: ${(p: any) => (p.variant === 'primary' ? 'blue' : 'gray')};
    `;
    renderWithSheet(<Btn data-testid="b" variant="primary" />);
    const style = screen.getByTestId('b').getAttribute('style') || '';
    expect(style).toMatch(/--fj-[\w-]+:\s*blue/);
  });
});

describe('.attrs() chain', () => {
  it('applies static default attributes', () => {
    const Btn = styled.button.attrs({ type: 'button', 'aria-live': 'polite' })`
      color: red;
    `;
    renderWithSheet(<Btn data-testid="b">x</Btn>);
    const el = screen.getByTestId('b');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('callsite props OVERRIDE attrs defaults', () => {
    const Btn = styled.button.attrs({ type: 'button' })`
      color: red;
    `;
    renderWithSheet(<Btn data-testid="b" type="submit" />);
    expect(screen.getByTestId('b').getAttribute('type')).toBe('submit');
  });

  it('function attrs receive props', () => {
    const Btn = styled.button.attrs((p: any) => ({
      type: p.$submit ? 'submit' : 'button',
    }))`
      color: red;
    `;
    renderWithSheet(<Btn data-testid="a" $submit />);
    renderWithSheet(<Btn data-testid="b" />);
    expect(screen.getByTestId('a').getAttribute('type')).toBe('submit');
    expect(screen.getByTestId('b').getAttribute('type')).toBe('button');
  });

  it('.attrs chains — later wins on conflict', () => {
    const Base = styled.button.attrs({ type: 'button', name: 'base' })`
      color: red;
    `;
    const Extra = styled(Base).attrs({ name: 'extra' })`
      color: blue;
    `;
    renderWithSheet(<Extra data-testid="e" />);
    const el = screen.getByTestId('e');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.getAttribute('name')).toBe('extra');
  });

  it('attrs className merges with the generated one', () => {
    const Btn = styled.button.attrs({ className: 'extra' })`
      color: red;
    `;
    renderWithSheet(<Btn data-testid="b" />);
    const el = screen.getByTestId('b');
    expect(el.className.split(/\s+/)).toContain('extra');
    // and at least one filbert-generated label class
    expect(el.className.split(/\s+/).some((c) => c.startsWith('fj-'))).toBe(true);
  });
});
