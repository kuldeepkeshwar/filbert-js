// Unit-level test for the runtime addition that the bundler plugins depend
// on: `styled(...).withConfig({ preInjected: true, className: 'fj-xyz' })`
// must (a) use the provided class verbatim and (b) NOT call `createStyles` on
// the sheet — the class is assumed to be served by a linked stylesheet the
// bundler already emitted.

import React from 'react';
import { describe, expect, it } from 'vitest';
import { styled } from '@filbert-js/core';
import { renderWithSheet, collectAllCSS, allStyleTags } from '../helpers/render';

describe('runtime — preInjected fast-fast-path', () => {
  it('uses the provided className and does not inject any rule', () => {
    // The bundler plugin would compile a static template into a call shaped
    // exactly like this. We construct it directly so the assertion targets
    // ONLY the runtime contract, not the babel/extraction pipeline.
    const Btn = styled('button').withConfig({
      label: 'X__Btn',
      componentId: 'fj-static',
      preInjected: true,
      className: 'fj-linked',
    })`color: red;`;

    renderWithSheet(<Btn data-testid="b">hi</Btn>);
    const el = document.querySelector('[data-testid="b"]')!;
    expect(el).not.toBeNull();
    expect(el.className).toContain('fj-linked');
    expect(el.className).toContain('X__Btn');

    // Nothing should have been registered on the sheet.
    const runtimeCss = collectAllCSS();
    expect(runtimeCss).not.toContain('fj-linked');
    for (const tag of allStyleTags()) {
      expect(tag.textContent || '').not.toMatch(/color:\s*red/);
    }
  });

  it('with className but preInjected:false, still runs createStyles', () => {
    // Defensive: only preInjected:true trips the shortcut. A stray className
    // property alone must not silently drop the rule.
    const Btn = styled('button').withConfig({
      label: 'Y__Btn',
      componentId: 'fj-static',
      className: 'fj-notused',
    })`color: blue;`;
    renderWithSheet(<Btn data-testid="c">hi</Btn>);
    // The regular runtime rule should have been injected.
    const runtimeCss = collectAllCSS();
    expect(runtimeCss).toMatch(/color:\s*blue/);
  });
});
