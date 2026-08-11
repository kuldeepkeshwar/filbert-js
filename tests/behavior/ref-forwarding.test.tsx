// Refs must reach the underlying DOM node (or wrapped component's ref target).
import React from 'react';
import { describe, expect, it } from 'vitest';
import { styled } from '../helpers/styled';
import { renderWithSheet } from '../helpers/render';

describe('ref forwarding', () => {
  it('forwards a ref to a host element', () => {
    const Div = styled.div`
      color: red;
    `;
    const ref = React.createRef();
    renderWithSheet(<Div ref={ref} data-testid="d" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('forwards a ref to a wrapped forwardRef component', () => {
    const Inner = React.forwardRef<HTMLSpanElement>(function Inner(props, ref) {
      return <span ref={ref} {...props} data-testid="inner" />;
    });
    const Wrapped = styled(Inner)`
      color: red;
    `;
    const ref = React.createRef();
    renderWithSheet(<Wrapped ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('a callback ref receives the node', () => {
    const Div = styled.div`
      color: red;
    `;
    let received = null;
    renderWithSheet(<Div ref={(n) => (received = n)} data-testid="d" />);
    expect(received).toBeInstanceOf(HTMLDivElement);
  });

  it('the styled component sets its own display name (via `.label`)', () => {
    const Div = styled.div`
      color: red;
    `;
    // filbert sets `label` (not `displayName`) — locking the observable knob.
    expect(Div.label).toBeTruthy();
    expect(Div.label).toMatch(/^fj-/);
  });
});
