// Parser throughput — the metric that decides whether we beat stylis.
// Each sample is one representative template shape. Reported as ops/s;
// vitest bench prints a comparison table when there are multiple runners.
import { bench, describe } from 'vitest';
import { createParser } from '@filbert-js/css-parser';
import { toAST } from '@filbert-js/css-ast';

const parse = createParser();

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

describe('toAST — raw parser', () => {
  bench('flat body', () => {
    toAST(FIXTURES.flat);
  });
  bench('one-level nesting', () => {
    toAST(FIXTURES.simple_nested);
  });
  bench('with @media', () => {
    toAST(FIXTURES.media);
  });
  bench('general (nested + gradients + media)', () => {
    toAST(FIXTURES.general);
  });
});

describe('createParser — full pipeline (AST + namespace emit)', () => {
  bench('flat body', () => {
    parse({ css: FIXTURES.flat, namespace: '.abc' });
  });
  bench('one-level nesting', () => {
    parse({ css: FIXTURES.simple_nested, namespace: '.abc' });
  });
  bench('with @media', () => {
    parse({ css: FIXTURES.media, namespace: '.abc' });
  });
  bench('general (nested + gradients + media)', () => {
    parse({ css: FIXTURES.general, namespace: '.abc' });
  });
});

describe('createParser — repeated calls (cache-hit surface)', () => {
  // The improved parser will hash-cache by the resolved body. This benchmark
  // measures the CURRENT re-parse-every-time cost; post-refactor it should
  // drop to a Map lookup.
  bench('same input 100x — flat', () => {
    for (let i = 0; i < 100; i++) parse({ css: FIXTURES.flat, namespace: '.abc' });
  });

  bench('same input 100x — nested', () => {
    for (let i = 0; i < 100; i++) parse({ css: FIXTURES.simple_nested, namespace: '.abc' });
  });
});
