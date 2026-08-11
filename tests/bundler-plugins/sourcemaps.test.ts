// @vitest-environment node
//
// Source-map preservation through the CSS-extraction pass.
//
// Both bundler integrations run two babel passes (babel-plugin-filbert, then
// the withConfig stripper). Historically the second pass dropped the map
// (`map: null`); these tests pin that the composed map survives and still
// points at the original source file. Presence + sources is the contract —
// full position accuracy is out of scope here.

import { describe, expect, it } from 'vitest';
import filbert from 'vite-plugin-filbert';
import webpackLoader from 'webpack-loader-filbert';

const FIXTURE = `
  import { styled } from '@filbert-js/core';
  export const Btn = styled.button\`
    color: red;
    padding: 8px;
  \`;
`;

interface TransformResult {
  code: string;
  map: { sources: string[]; mappings: string } | null;
}

describe('vite-plugin-filbert source maps', () => {
  async function runTransform(code: string, id: string): Promise<TransformResult | null> {
    const plugin = filbert();
    const transform = plugin.transform as unknown as (
      this: unknown,
      code: string,
      id: string,
    ) => Promise<TransformResult | null>;
    return transform.call({ error: (m: string) => { throw new Error(m); } }, code, id);
  }

  it('returns a composed map after the extraction rewrite', async () => {
    const res = await runTransform(FIXTURE, '/fixture/Button.tsx');
    expect(res).not.toBeNull();
    // Extraction really happened (map isn't just the babel fast-path's).
    expect(res!.code).toMatch(/preInjected/);
    expect(res!.code).toMatch(/virtual:filbert\.css/);

    expect(res!.map).not.toBeNull();
    expect(res!.map!.mappings.length).toBeGreaterThan(0);
    expect(res!.map!.sources.some((s) => s.includes('Button.tsx'))).toBe(true);
  });

  it('returns a map on the babel fast-path too (emitCssFile: false)', async () => {
    const plugin = filbert({ emitCssFile: false });
    const transform = plugin.transform as unknown as (
      this: unknown,
      code: string,
      id: string,
    ) => Promise<TransformResult | null>;
    const res = await transform.call({}, FIXTURE, '/fixture/Button.tsx');
    expect(res).not.toBeNull();
    expect(res!.map).not.toBeNull();
    expect(res!.map!.sources.some((s) => s.includes('Button.tsx'))).toBe(true);
  });
});

describe('webpack-loader-filbert source maps', () => {
  function runLoader(
    source: string,
    opts: Record<string, unknown> = {},
  ): Promise<{ code: string; map: { sources: string[]; mappings: string } | null; emitted: string[] }> {
    return new Promise((resolve, reject) => {
      const emitted: string[] = [];
      const ctx = {
        async: () => (err: Error | null, code?: string, map?: unknown) => {
          if (err) return reject(err);
          resolve({ code: code!, map: (map as any) ?? null, emitted });
        },
        getOptions: () => opts,
        resourcePath: '/fixture/Button.tsx',
        sourceMap: true,
        emitFile: (name: string) => emitted.push(name),
        _module: {},
      };
      (webpackLoader as unknown as (this: unknown, source: string) => void).call(ctx, source);
    });
  }

  it('returns a composed map after the extraction rewrite', async () => {
    const res = await runLoader(FIXTURE);
    // Extraction really happened — sidecar emitted, css stripped from JS.
    expect(res.emitted.some((n) => n.endsWith('.filbert.css'))).toBe(true);
    expect(res.code).toMatch(/preInjected/);

    expect(res.map).not.toBeNull();
    expect(res.map!.mappings.length).toBeGreaterThan(0);
    expect(res.map!.sources.some((s) => s.includes('Button.tsx'))).toBe(true);
  });
});
