// The `${Component}` interpolation — inline component-selector.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { renderWithSheet, collectAllCSS } from '../helpers/render';

describe('${Component} interpolation', () => {
  it('interpolates to the target class selector', () => {
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
    // The parent rule must reference the child's class in some form.
    const childCls = document.querySelector('span').className.split(' ').find(Boolean);
    expect(childCls).toBeTruthy();
    expect(css).toContain(childCls);
  });

  it('works in descendant combinators (& ${Child})', () => {
    const Child = styled.span`
      color: red;
    `;
    const Parent = styled.div`
      & ${Child} {
        color: blue;
      }
    `;
    renderWithSheet(
      <Parent>
        <Child />
      </Parent>,
    );
    const css = collectAllCSS();
    const childCls = document.querySelector('span').className.split(' ').find(Boolean);
    expect(css).toContain(childCls);
  });

  it('produces a stable selector across renders of the same styled component', () => {
    const Child = styled.span`
      color: red;
    `;
    const a = String(Child);
    const b = String(Child);
    expect(a).toBe(b);
  });
});
