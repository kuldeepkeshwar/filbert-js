// Rough perf harness: transform a realistic-sized file N times with each
// engine and assert oxc is at least 3× faster. The whole point of this
// package is to beat babel's parse-and-print cost; the test is a
// regression alarm, not a benchmark.
import { describe, expect, it } from 'vitest';
import { transformSync } from '@babel/core';

import babelFilbertPlugin from '../../packages/babel-plugin-filbert/index';
import { transform as oxcTransform } from '../../packages/oxc-plugin-filbert/index';

// A ~40-component fixture that exercises the hot path (labels + static
// extraction + variant collection). Sized to hit the babel-print cost without
// making the test slow enough to feel like a bench.
function makeFixture(): string {
  const parts: string[] = [
    `import { styled } from '@filbert-js/core';`,
    `const RED = '#ff0000';`,
    `const theme = { colors: { primary: 'tomato', secondary: 'skyblue' } };`,
  ];
  for (let i = 0; i < 40; i++) {
    parts.push(`
      const Btn${i} = styled.button\`
        color: \${RED};
        background: \${theme.colors.primary};
        padding: 8px;
        border-radius: 4px;
        font-size: \${(p) => p.$size === 'sm' ? '12px' : p.$size === 'lg' ? '20px' : '16px'};
      \`;
    `);
  }
  return parts.join('\n');
}

function babelRun(src: string, filename: string) {
  const out = transformSync(src, {
    babelrc: false,
    configFile: false,
    filename,
    presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
    plugins: [[babelFilbertPlugin, { emitDts: false }]],
  });
  if (!out?.code) throw new Error('babel returned no code');
  return out.code;
}

function oxcRun(src: string, filename: string) {
  return oxcTransform(src, filename, { emitDts: false }).code;
}

function bench(fn: () => void, iterations: number): number {
  // Warm-up.
  for (let i = 0; i < 5; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return performance.now() - start;
}

// A non-styled file — every real app has a lot of these. Babel still runs
// the full parse + preset-typescript pass; oxc bails at strchr.
function makeNonStyledFixture(): string {
  return `
    import * as React from 'react';
    export function Comp(props: { name: string; onClick: () => void }) {
      const label = props.name.toUpperCase();
      return React.createElement('div', { onClick: props.onClick }, label);
    }
    export const helper = (x: number) => x * 2;
    export type Foo = { a: string; b: number };
    ${Array.from({ length: 30 }, (_, i) => `const _pad${i} = ${i};`).join('\n')}
  `;
}

describe('oxc plugin — performance', () => {
  it('is at least 3× faster than babel-plugin-filbert on a styled-heavy file', () => {
    const src = makeFixture();
    const filename = '/src/Perf.tsx';
    // Sanity: both engines must produce a withConfig for every component.
    expect(babelRun(src, filename).match(/\.withConfig\(/g)?.length).toBe(40);
    expect(oxcRun(src, filename).match(/\.withConfig\(/g)?.length).toBe(40);

    const N = 100;
    const babelMs = bench(() => babelRun(src, filename), N);
    const oxcMs = bench(() => oxcRun(src, filename), N);

    const speedup = babelMs / oxcMs;

    console.log(
      `[perf/styled] babel=${babelMs.toFixed(1)}ms  oxc=${oxcMs.toFixed(1)}ms  speedup=${speedup.toFixed(2)}x  (N=${N})`,
    );

    expect(speedup).toBeGreaterThan(3);
  });

  it('is dramatically faster on non-styled files (the common case in a real build)', () => {
    const src = makeNonStyledFixture();
    const filename = '/src/Plain.tsx';

    const N = 200;
    const babelMs = bench(() => babelRun(src, filename), N);
    const oxcMs = bench(() => oxcRun(src, filename), N);
    const speedup = babelMs / oxcMs;

    console.log(
      `[perf/plain] babel=${babelMs.toFixed(1)}ms  oxc=${oxcMs.toFixed(1)}ms  speedup=${speedup.toFixed(2)}x  (N=${N})`,
    );

    // On files with no `styled` mention we skip the parse — the pre-filter
    // should get us an order of magnitude cheaper than babel.
    expect(speedup).toBeGreaterThan(10);
  });
});
