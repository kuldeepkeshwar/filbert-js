// Deep-composition edge cases for the .attrs() chain — beyond the basic
// scenarios in props-handling.test.tsx.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { renderWithSheet } from '../helpers/render';

describe('.attrs() chained more than twice', () => {
  it('.attrs().attrs().attrs() applies all three, later wins on conflict', () => {
    const Btn = styled.button
      .attrs({ type: 'button', name: 'a', 'aria-live': 'polite' })
      .attrs({ name: 'b', 'aria-live': 'assertive' })
      .attrs({ name: 'c' })`
      color: red;
    `;
    renderWithSheet(<Btn data-testid="b" />);
    const el = screen.getByTestId('b');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.getAttribute('name')).toBe('c');
    expect(el.getAttribute('aria-live')).toBe('assertive');
  });
});

describe('.attrs() with function attrs', () => {
  it('function attrs receive the CALLER props (not the already-merged shape)', () => {
    let receivedProps: any = null;
    const Btn = styled.button.attrs((p) => {
      receivedProps = p;
      return { type: 'submit' };
    })`
      color: red;
    `;
    renderWithSheet(<Btn data-testid="b" $variant="primary" />);
    expect(receivedProps).toBeTruthy();
    expect(receivedProps.$variant).toBe('primary');
  });

  it('function attrs can inject a $-prefixed prop that DRIVES styles', () => {
    const Btn = styled.button.attrs((p: any) => ({
      $c: p.$c ?? 'red',
    }))`
      color: ${(p: any) => p.$c};
    `;
    // Caller omits $c — the attrs default kicks in.
    renderWithSheet(<Btn data-testid="b" />);
    const style = screen.getByTestId('b').getAttribute('style') || '';
    expect(style).toMatch(/--fj-[\w-]+:\s*red/);
    // The injected $c must NOT appear on the DOM element (transient).
    expect(screen.getByTestId('b').getAttribute('$c')).toBeNull();
    expect(screen.getByTestId('b').getAttribute('c')).toBeNull();
  });
});

describe('.attrs() and styled(Base) inheritance', () => {
  it('extender.attrs() overrides base.attrs() on conflicting keys', () => {
    const Base = styled.button.attrs({ type: 'button', name: 'base', 'data-role': 'primary' })`
      color: red;
    `;
    const Ext = styled(Base).attrs({ name: 'ext', 'data-role': 'secondary' })`
      color: blue;
    `;
    renderWithSheet(<Ext data-testid="e" />);
    const el = screen.getByTestId('e');
    expect(el.getAttribute('type')).toBe('button'); // inherited
    expect(el.getAttribute('name')).toBe('ext'); // extender wins
    expect(el.getAttribute('data-role')).toBe('secondary'); // extender wins
  });

  it('function attrs on the extender see props AND base attrs are applied first', () => {
    const Base = styled.button.attrs({ type: 'submit' })`
      color: red;
    `;
    // We rely on the extender seeing the ORIGINAL props (transient design).
    const Ext = styled(Base).attrs((p: any) => ({
      'aria-label': `variant:${p.$variant}`,
    }))`
      color: blue;
    `;
    renderWithSheet(<Ext data-testid="e" $variant="lg" />);
    const el = screen.getByTestId('e');
    expect(el.getAttribute('type')).toBe('submit');
    expect(el.getAttribute('aria-label')).toBe('variant:lg');
  });
});

describe('.attrs() className merging', () => {
  it('.attrs({ className }) contributes to the final className list', () => {
    const Btn = styled.button.attrs({ className: 'extra-a' })`
      color: red;
    `;
    renderWithSheet(<Btn data-testid="b" />);
    const classes = screen.getByTestId('b').className.split(/\s+/);
    expect(classes).toContain('extra-a');
  });

  it('caller className + attrs className + generated class all merge', () => {
    const Btn = styled.button.attrs({ className: 'attrs-cls' })`
      color: red;
    `;
    renderWithSheet(<Btn data-testid="b" className="user-cls" />);
    const classes = screen.getByTestId('b').className.split(/\s+/);
    expect(classes).toContain('attrs-cls');
    expect(classes).toContain('user-cls');
    expect(classes.some((c) => c.startsWith('fj-'))).toBe(true);
  });
});

describe('.attrs() with style prop', () => {
  // CURRENT BEHAVIOR: `style` is treated as a regular prop by applyAttrs, so
  // the caller's `style` object REPLACES the attrs `style` wholesale (not
  // merged). Locking that in — a shallow-merge like `className` does would
  // be a friendlier semantic; if the API changes, this test flips.
  it('.attrs({ style }) is REPLACED by caller style (no shallow merge)', () => {
    const Btn = styled.button.attrs({ style: { marginTop: '4px', color: 'blue' } })`
      color: red;
    `;
    renderWithSheet(<Btn data-testid="b" style={{ color: 'green' }} />);
    const style = screen.getByTestId('b').getAttribute('style') || '';
    expect(style).not.toContain('margin-top');
    expect(style).toContain('color: green');
  });

  it('.attrs({ style }) applies alone when the caller passes no style', () => {
    const Btn = styled.button.attrs({ style: { marginTop: '4px' } })`
      color: red;
    `;
    renderWithSheet(<Btn data-testid="b" />);
    const style = screen.getByTestId('b').getAttribute('style') || '';
    expect(style).toContain('margin-top: 4px');
  });
});
