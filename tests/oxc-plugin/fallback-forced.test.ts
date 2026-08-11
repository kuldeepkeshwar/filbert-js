// Forces the oxc→babel fallback path by mocking `oxc-parser` to always report
// a parse error. Complements `fallback.test.ts` which probes for real-world
// syntax that oxc-parser might reject — but oxc's coverage has grown so wide
// that the probes rarely fire. This test locks the wiring directly.
import { describe, expect, it, vi } from 'vitest';

vi.mock('oxc-parser', () => ({
  parseSync: () => ({
    errors: [{ message: 'synthetic oxc parse failure' }],
    program: null,
  }),
}));

import { transform } from '../../packages/oxc-plugin-filbert/index';

describe('oxc plugin — fallback wiring (forced via mock)', () => {
  it('when fallbackToBabel is disabled, the OxcParseError propagates', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const X = styled.div\`color: red;\`;
    `;
    let caught: any = null;
    try {
      transform(src, '/src/X.tsx', { fallbackToBabel: false });
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught.name).toBe('OxcParseError');
    expect(caught.message).toContain('synthetic');
  });

  it('gracefully degrades when the babel bridge is unresolvable', () => {
    // In this test environment `require('babel-plugin-filbert')` fails
    // because the plugin lives as `.ts` in the monorepo with no built .js
    // entry that CommonJS can load. `loadBabel()` returns null and the
    // original OxcParseError propagates — proving the fallback wiring does
    // NOT silently swallow errors when the babel side is missing.
    //
    // The "babel bridge works end-to-end" path is covered separately by
    // `tests/babel-plugin/plugin.test.ts` which exercises babel-plugin-filbert
    // directly under an @babel/core pipeline with the babel plugin transpiled
    // to CJS on the fly.
    const src = `
      import { styled } from '@filbert-js/core';
      const Btn = styled.button\`color: red;\`;
    `;
    let caught: any = null;
    try {
      transform(src, '/src/Btn.tsx');
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught.name).toBe('OxcParseError');
    expect(caught.message).toContain('synthetic');
  });

  it('does not call the fallback for files pre-filtered out (no styled import)', () => {
    const onFallback = vi.fn();
    const src = `export const x = 1;`;
    const out = transform(src, '/src/plain.tsx', { onFallback });
    // Pre-filter short-circuits before parse; the mocked parser is never
    // reached. Verifies the source-level indexOf gate.
    expect(out.bailed).toBe(true);
    expect(out.fallback).toBeUndefined();
    expect(onFallback).not.toHaveBeenCalled();
  });
});
