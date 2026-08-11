// End-to-end: transform a snippet through the plugin, evaluate it, mount the
// resulting component and confirm the runtime fast-path registers the
// precompiled CSS and injects the label class.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { transformSync } from '@babel/core';
import filbertPlugin from '../../packages/babel-plugin-filbert/index';
import { styled } from '@filbert-js/core';
import { renderWithSheet, collectAllCSS } from '../helpers/render.jsx';

function evalTransformed(src: string, filename: string): any {
  const out = transformSync(src, {
    babelrc: false,
    configFile: false,
    filename,
    presets: [
      ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
      ['@babel/preset-react', { runtime: 'automatic' }],
      ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
    ],
    plugins: [[filbertPlugin, {}]],
  });
  if (!out || !out.code) throw new Error('no code');
  const fn = new Function('require', 'module', 'exports', out.code);
  const mod: any = { exports: {} };
  fn(
    (id: string) => {
      if (id === '@filbert-js/core') return { styled };
      if (id === 'react/jsx-runtime') return require('react/jsx-runtime');
      throw new Error(`unhandled require: ${id}`);
    },
    mod,
    mod.exports,
  );
  return mod.exports;
}

describe('runtime integration — precompiled css fast path', () => {
  it('static template: label class + hashed class both appear, and CSS is emitted', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      export const PrimaryButton = styled.button\`color: red; padding: 8px;\`;
    `;
    const { PrimaryButton } = evalTransformed(src, '/src/Button.tsx');
    renderWithSheet(<PrimaryButton data-testid="btn">hi</PrimaryButton>);
    const el = document.querySelector('[data-testid="btn"]')!;
    expect(el).not.toBeNull();

    // Label class is applied — proves withConfig({label}) came through.
    expect(el.className).toContain('Button__PrimaryButton');

    // Hashed class (fj-<hash>) present — proves fast-path chose a stable id.
    expect(el.className).toMatch(/fj-[a-z0-9]+/);

    // Registered CSS contains the exact body — proves the runtime uses the
    // precompiledCss string.
    const css = collectAllCSS();
    expect(css).toMatch(/color\s*:\s*red/);
    expect(css).toMatch(/padding\s*:\s*8px/);
  });

  it('live (dynamic) template still resolves interpolations at render time', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      export const Dyn = styled.div\`color: \${(p) => p.$c};\`;
    `;
    const { Dyn } = evalTransformed(src, '/src/Dyn.tsx');
    renderWithSheet(<Dyn data-testid="d" $c="rebeccapurple">x</Dyn>);
    const el = document.querySelector('[data-testid="d"]')!;
    // The label from the plugin sticks even without extraction.
    expect(el.className).toContain('Dyn__Dyn');
    // The inline style carries the CSS variable resolved for `$c`.
    const style = (el as HTMLElement).getAttribute('style') || '';
    expect(style).toMatch(/rebeccapurple/);
  });
});
