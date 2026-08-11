// Filbert's css-parser vs stylis — the parser styled-components v6 and emotion
// ship. Same fixture set, same namespace, same output shape (individual rules
// via `rulesheet` for stylis so the comparison is apples-to-apples).
//
// Fresh createParser() per bench so filbert's per-instance cache does NOT
// contaminate the numbers. The "cache-hit surface" bench below deliberately
// reuses ONE parser to show what the Map lookup buys you.
import { bench, describe } from 'vitest';
import { createParser } from '@filbert-js/css-parser';
import { compile, serialize, stringify, middleware, rulesheet } from 'stylis';

const NS = '.abc';

const FIXTURES = {
  flat: `
    color: red;
    background: #f5f5f5;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    letter-spacing: -0.01em;
  `,

  simple_nested: `
    color: #333;
    padding: 8px 16px;
    border: 1px solid #e0e0e0;
    &:hover { background: #f5f5f5; }
    &:focus { outline: 2px solid #4a90e2; }
    &:disabled { opacity: 0.5; }
    &::before { content: ""; display: block; }
  `,

  media: `
    color: #333;
    padding: 8px;
    @media (min-width: 600px) {
      padding: 16px;
    }
    @media (min-width: 900px) {
      padding: 24px;
      font-size: 16px;
    }
  `,

  general: `
    color: #333;
    padding: 8px 16px;
    background: linear-gradient(180deg, #fff, #f5f5f5);
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    & > .icon { margin-right: 4px; }
    & > .label { flex: 1 1 auto; }
    &:hover {
      background: linear-gradient(180deg, #fafafa, #f0f0f0);
      &::before { opacity: 0.8; }
    }
    @media (min-width: 600px) {
      padding: 12px 20px;
      & > .icon { margin-right: 8px; }
    }
  `,
};

// Stylis pipeline that matches how styled-components / emotion actually call
// it — compile + serialize with a rulesheet middleware collecting individual
// rules, then join. Prefixing is off (parity with filbert's default).
function stylisCompile(css: string, namespace: string): string {
  const rules: string[] = [];
  const collect = rulesheet((rule) => rules.push(rule));
  serialize(
    compile(`${namespace}{${css}}`),
    middleware([stringify, collect]),
  );
  return rules.join('');
}

// FRESH parser per iteration — no cache contamination.
function filbertColdCompile(css: string, namespace: string): string {
  const p = createParser();
  return p({ css, namespace });
}

describe('flat body — declarations only (~60% of real templates)', () => {
  bench('filbert (fast path)', () => {
    filbertColdCompile(FIXTURES.flat, NS);
  });
  bench('stylis', () => {
    stylisCompile(FIXTURES.flat, NS);
  });
});

describe('one-level nesting (&:hover, &::before)', () => {
  bench('filbert', () => {
    filbertColdCompile(FIXTURES.simple_nested, NS);
  });
  bench('stylis', () => {
    stylisCompile(FIXTURES.simple_nested, NS);
  });
});

describe('with @media queries', () => {
  bench('filbert', () => {
    filbertColdCompile(FIXTURES.media, NS);
  });
  bench('stylis', () => {
    stylisCompile(FIXTURES.media, NS);
  });
});

describe('general (nested + gradients + rgba + @media)', () => {
  bench('filbert', () => {
    filbertColdCompile(FIXTURES.general, NS);
  });
  bench('stylis', () => {
    stylisCompile(FIXTURES.general, NS);
  });
});

// Cache-hit surface: the same createParser() instance sees the same input
// many times — filbert's Map cache makes this a lookup, stylis has no
// equivalent so it re-parses every call.
describe('repeat 100× same input (real-world hot path)', () => {
  const filbertParser = createParser();
  bench('filbert (per-instance cache)', () => {
    for (let i = 0; i < 100; i++) filbertParser({ css: FIXTURES.flat, namespace: NS });
  });
  bench('stylis (no cache — every call re-parses)', () => {
    for (let i = 0; i < 100; i++) stylisCompile(FIXTURES.flat, NS);
  });
});
