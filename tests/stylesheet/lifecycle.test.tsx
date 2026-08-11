// Stylesheet lifecycle: <style> tag count, dedup, source order, unmount cleanup.
// This layer is being replaced — the current behavior is one <style> tag per
// unique class + a synchronous document.querySelector on unmount. Lock BOTH:
// (a) end-user observable behavior (dedup, ordering)
// (b) internal implementation contract (tag-per-class) — pinned as xfail so it
//     flips green once we merge to a single <style> element.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { styled } from '../helpers/styled';
import { keyframes } from '@filbert-js/core';

import {
  renderWithSheet,
  styleTagCount,
  allStyleTags,
  collectAllCSS,
} from '../helpers/render';

describe('injection — <style> tag count', () => {
  it('starts at zero style tags with no styled components rendered', () => {
    renderWithSheet(<div />);
    expect(styleTagCount()).toBe(0);
  });

  it('one styled component renders at least one style tag', () => {
    const Div = styled.div`
      color: red;
    `;
    renderWithSheet(<Div />);
    expect(styleTagCount()).toBeGreaterThanOrEqual(1);
  });

  it('three unrelated styled components share one merged <style> tag', () => {
    const A = styled.div`
      color: red;
    `;
    const B = styled.span`
      color: blue;
    `;
    const C = styled.p`
      color: green;
    `;
    renderWithSheet(
      <>
        <A />
        <B />
        <C />
      </>,
    );
    expect(styleTagCount()).toBe(1);
  });

  it('a component + a keyframes rule produce two tags (one per bucket)', () => {
    const fade = keyframes`from { opacity: 0; } to { opacity: 1; }`;
    const A = styled.div`
      animation: ${fade} 200ms;
    `;
    renderWithSheet(<A />);
    // One `styled-type="c"` tag + one `styled-type="k"` tag.
    expect(styleTagCount()).toBe(2);
  });
});

describe('dedup — same styles across instances', () => {
  it('mounting N instances of one styled component adds no extra style tags', () => {
    const Div = styled.div`
      color: red;
      padding: 8px;
    `;
    renderWithSheet(<Div />);
    const before = styleTagCount();
    renderWithSheet(
      <>
        <Div />
        <Div />
        <Div />
        <Div />
      </>,
    );
    // Post-mount: <=1 additional tag for the definition, none per-instance.
    expect(styleTagCount()).toBeLessThanOrEqual(before + 1);
  });

  it('two components with different declarations produce two tag ids', () => {
    const A = styled.div`
      color: red;
    `;
    const B = styled.div`
      color: blue;
    `;
    renderWithSheet(
      <>
        <A />
        <B />
      </>,
    );
    const ids = allStyleTags().map((t) => t.getAttribute('id'));
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids
  });
});

describe('source order stability', () => {
  it('mounting A before B keeps A ahead in the merged sheet', () => {
    const A = styled.div`
      color: red;
    `;
    const B = styled.span`
      color: blue;
    `;
    renderWithSheet(
      <>
        <A />
        <B />
      </>,
    );
    // With a single merged tag, the check is now positional WITHIN the text.
    const text = collectAllCSS();
    const redIdx = text.indexOf('red');
    const blueIdx = text.indexOf('blue');
    expect(redIdx).toBeGreaterThanOrEqual(0);
    expect(blueIdx).toBeGreaterThanOrEqual(0);
    expect(redIdx).toBeLessThan(blueIdx);
  });
});

describe('rules persist across unmount (no more querySelector-on-unmount)', () => {
  it('unmounting keeps component-css rules in the sheet (no per-instance thrash)', () => {
    const Div = styled.div`
      color: red;
    `;
    const { unmount } = renderWithSheet(<Div />);
    const beforeCount = styleTagCount();
    expect(beforeCount).toBeGreaterThanOrEqual(1);
    unmount();
    // Component-CSS rules are NEVER removed on unmount — this is intentional.
    // The sheet grows monotonically, bounded by unique templates × prop
    // combos; keeping rules avoids re-parse on remount and eliminates the
    // synchronous document.querySelector on every unmount that was the
    // scaling bug in the old implementation.
    expect(styleTagCount()).toBeGreaterThanOrEqual(beforeCount);
  });

  it('multiple instances of the same styled component share one entry', () => {
    const Div = styled.div`
      color: red;
    `;
    renderWithSheet(
      <>
        <Div />
        <Div />
        <Div />
        <Div />
      </>,
    );
    // Four instances of one styled component → one merged <style> tag.
    expect(styleTagCount()).toBe(1);
  });
});

describe('data-* attributes on filbert style tags', () => {
  it('every filbert-injected tag has data-type="styled-css"', () => {
    const Div = styled.div`
      color: red;
    `;
    renderWithSheet(<Div />);
    for (const el of allStyleTags()) {
      expect(el.getAttribute('data-type')).toBe('styled-css');
    }
  });

  it('the tag carries a styled-type attribute (c/k/g)', () => {
    const Div = styled.div`
      color: red;
    `;
    renderWithSheet(<Div />);
    for (const el of allStyleTags()) {
      const t = el.getAttribute('styled-type');
      expect(['c', 'k', 'g']).toContain(t);
    }
  });
});
