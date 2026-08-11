// Cascade behavior for styled(Styled) composition + the `as` prop.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { renderWithSheet, collectAllCSS } from '../helpers/render';

describe('styled(StyledComponent) composition', () => {
  it('renders the underlying host element (via the inner wrapper)', () => {
    const Base = styled.button`
      color: red;
    `;
    const Fancy = styled(Base)`
      color: blue;
    `;
    renderWithSheet(<Fancy data-testid="f">x</Fancy>);
    expect(screen.getByTestId('f').tagName).toBe('BUTTON');
  });

  it('adds both base and extender class names to the DOM node', () => {
    const Base = styled.button`
      color: red;
    `;
    const Fancy = styled(Base)`
      color: blue;
    `;
    renderWithSheet(<Fancy data-testid="f" />);
    const classes = screen.getByTestId('f').className.split(/\s+/);
    // both filbert labels present (starts with `fj-`).
    const labelClasses = classes.filter((c) => c.startsWith('fj-'));
    expect(labelClasses.length).toBeGreaterThanOrEqual(2);
  });

  it('extender wins in the cascade — its declaration is later in the sheet', () => {
    const Base = styled.button`
      color: red;
    `;
    const Fancy = styled(Base)`
      color: blue;
    `;
    renderWithSheet(<Fancy />);
    const css = collectAllCSS();
    const redIdx = css.indexOf('color:red') > -1 ? css.indexOf('color:red') : css.search(/color\s*:\s*red/);
    const blueIdx = css.indexOf('color:blue') > -1 ? css.indexOf('color:blue') : css.search(/color\s*:\s*blue/);
    expect(redIdx).toBeGreaterThanOrEqual(0);
    expect(blueIdx).toBeGreaterThanOrEqual(0);
    expect(blueIdx).toBeGreaterThan(redIdx);
  });
});

describe('`as` prop — element swap', () => {
  it('renders `<Div as="a">` as an anchor', () => {
    const Div = styled.div`
      color: red;
    `;
    renderWithSheet(<Div as="a" data-testid="a" href="#" />);
    expect(screen.getByTestId('a').tagName).toBe('A');
    expect(screen.getByTestId('a').getAttribute('href')).toBe('#');
  });

  it('renders `<Div as={Component}>` as the given component', () => {
    const Custom = React.forwardRef<HTMLElement>(function Custom(props, ref) {
      return <section ref={ref} {...props} data-testid="custom" />;
    });
    const Div = styled.div`
      color: red;
    `;
    renderWithSheet(<Div as={Custom} />);
    expect(screen.getByTestId('custom').tagName).toBe('SECTION');
  });

  it('carries the styled class onto the swapped element', () => {
    const Div = styled.div`
      color: red;
    `;
    renderWithSheet(<Div as="span" data-testid="s" />);
    expect(screen.getByTestId('s').className).toBeTruthy();
  });
});
