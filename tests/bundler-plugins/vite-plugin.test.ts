// @vitest-environment node
//
// vite-plugin-filbert integration test.
//
// Runs a real `vite.build()` against an in-memory fixture app and asserts on
// the emitted chunks. Kept in the node environment because Vite drives esbuild
// under the hood and jsdom's TextEncoder shim breaks it. The runtime-side
// contract (preInjected + className => skip createStyles) is covered in
// `preinjected-runtime.test.tsx` (jsdom).

import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { build, type Rollup } from 'vite';
import filbert from 'vite-plugin-filbert';

interface OutputEntry {
  fileName: string;
  type: 'chunk' | 'asset';
  code?: string;
  source?: string | Uint8Array;
}

async function buildFixture(files: Record<string, string>, opts: { emitCssFile?: boolean } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-vite-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents);
  }
  const result = (await build({
    root: dir,
    configFile: false,
    logLevel: 'silent',
    plugins: [filbert({ emitCssFile: opts.emitCssFile })],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: path.join(dir, 'entry.tsx'),
        formats: ['es'],
        fileName: 'bundle',
      },
      rollupOptions: {
        external: ['react', 'react-dom', 'react/jsx-runtime', '@filbert-js/core'],
      },
    },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];

  const output = (Array.isArray(result) ? result[0] : result).output as OutputEntry[];
  return { dir, output };
}

function findChunk(output: OutputEntry[], predicate: (e: OutputEntry) => boolean): OutputEntry | undefined {
  return output.find(predicate);
}

function readSource(e: OutputEntry): string {
  if (typeof e.source === 'string') return e.source;
  if (e.source) return new TextDecoder().decode(e.source as Uint8Array);
  return e.code || '';
}

describe('vite-plugin-filbert', () => {
  it('extracts static CSS into a CSS chunk and rewrites withConfig with preInjected', async () => {
    const { output } = await buildFixture({
      'entry.tsx': `
        import { styled } from '@filbert-js/core';
        export const Btn = styled.button\`
          color: red;
          padding: 8px;
        \`;
      `,
    });

    const jsChunk = findChunk(output, (e) => e.type === 'chunk')!;
    expect(jsChunk).toBeDefined();
    const js = jsChunk.code!;

    // Minifier may turn `true` into `!0` — accept both.
    expect(js).toMatch(/preInjected:\s*(true|!0)/);
    expect(js).toMatch(/className:\s*"fj-[a-z0-9]+"/);
    // The raw CSS body should no longer sit in JS — it moved to the CSS chunk.
    expect(js).not.toMatch(/css:\s*"[^"]*color:\s*red[^"]*padding:\s*8px/);

    const cssChunk = findChunk(output, (e) => e.fileName.endsWith('.css'));
    expect(cssChunk, 'expected a .css chunk in the vite build output').toBeDefined();
    const cssText = readSource(cssChunk!);
    expect(cssText).toMatch(/\.fj-[a-z0-9]+\s*\{[^}]*color:\s*red/);
    expect(cssText).toMatch(/padding:\s*8px/);

    // Invariant: the class the plugin baked into JS must be the class the CSS
    // chunk defines — this is what lets the pre-linked stylesheet actually
    // style the element the runtime renders.
    const jsCls = js.match(/className:\s*"(fj-[a-z0-9]+)"/)![1];
    const cssCls = cssText.match(/\.(fj-[a-z0-9]+)\s*\{/)![1];
    expect(cssCls).toBe(jsCls);
  });

  it('emitCssFile: false leaves the CSS in the JS bundle (babel fast-path only)', async () => {
    const { output } = await buildFixture(
      {
        'entry.tsx': `
          import { styled } from '@filbert-js/core';
          export const Btn = styled.button\`color: red;\`;
        `,
      },
      { emitCssFile: false },
    );
    const jsChunk = findChunk(output, (e) => e.type === 'chunk')!;
    const js = jsChunk.code!;
    expect(js).toMatch(/css:\s*"color:\s*red/);
    expect(js).not.toMatch(/preInjected/);
    expect(findChunk(output, (e) => e.fileName.endsWith('.css'))).toBeUndefined();
  });

  it('does NOT touch dynamic templates (no css: property to extract)', async () => {
    const { output } = await buildFixture({
      'entry.tsx': `
        import { styled } from '@filbert-js/core';
        export const Dyn = styled.div\`color: \${(p) => p.$c};\`;
      `,
    });
    const jsChunk = findChunk(output, (e) => e.type === 'chunk')!;
    // withConfig still gets label/componentId (babel plugin's job), but no
    // css / preInjected properties.
    expect(jsChunk.code!).toMatch(/withConfig\(/);
    expect(jsChunk.code!).not.toMatch(/preInjected/);
    expect(findChunk(output, (e) => e.fileName.endsWith('.css'))).toBeUndefined();
  });

  it('handles multiple styled components in one module', async () => {
    const { output } = await buildFixture({
      'entry.tsx': `
        import { styled } from '@filbert-js/core';
        export const A = styled.button\`color: red;\`;
        export const B = styled.div\`background: blue;\`;
      `,
    });
    const cssChunk = findChunk(output, (e) => e.fileName.endsWith('.css'))!;
    const cssText = readSource(cssChunk);
    expect(cssText).toMatch(/color:\s*red/);
    expect(cssText).toMatch(/background:\s*blue/);
    const jsChunk = findChunk(output, (e) => e.type === 'chunk')!;
    // Two withConfig calls, two className rewrites.
    const classes = jsChunk.code!.match(/className:\s*"fj-[a-z0-9]+"/g) || [];
    expect(classes.length).toBe(2);
  });
});
