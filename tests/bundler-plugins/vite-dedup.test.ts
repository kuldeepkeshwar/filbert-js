// @vitest-environment node
//
// Cross-module CSS dedup in vite-plugin-filbert.
//
// The fj-<hash> class is content-hashed from the css body, so byte-identical
// templates in two different source files compile to the same class. The
// plugin must emit that rule ONCE across all CSS output while still rewriting
// both JS modules to `preInjected: true, className: 'fj-<hash>'`.

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

async function buildFixture(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-vite-dedup-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents);
  }
  const result = (await build({
    root: dir,
    configFile: false,
    logLevel: 'silent',
    plugins: [filbert()],
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
  return (Array.isArray(result) ? result[0] : result).output as OutputEntry[];
}

function readSource(e: OutputEntry): string {
  if (typeof e.source === 'string') return e.source;
  if (e.source) return new TextDecoder().decode(e.source as Uint8Array);
  return e.code || '';
}

// Byte-identical static template shared by both fixture modules.
const SHARED_TEMPLATE = `
  import { styled } from '@filbert-js/core';
  export const Shared = styled.button\`
    color: rebeccapurple;
    padding: 12px;
  \`;
`;

describe('vite-plugin-filbert cross-module dedup', () => {
  it('emits an identical rule from two source files exactly once', async () => {
    const output = await buildFixture({
      'a.tsx': SHARED_TEMPLATE,
      'b.tsx': SHARED_TEMPLATE.replace('Shared', 'SharedB'),
      'entry.tsx': `
        export { Shared } from './a';
        export { SharedB } from './b';
      `,
    });

    const allCss = output
      .filter((e) => e.fileName.endsWith('.css'))
      .map(readSource)
      .join('\n');
    expect(allCss).toMatch(/color:\s*rebeccapurple/);

    // The rule body must appear exactly once across ALL emitted CSS.
    const ruleHits = allCss.match(/color:\s*rebeccapurple/g) || [];
    expect(ruleHits.length).toBe(1);
    const classDefs = allCss.match(/\.fj-[a-z0-9]+\s*\{/g) || [];
    expect(classDefs.length).toBe(1);

    // Both modules got the JS rewrite, and they reference the SAME class.
    const js = output.filter((e) => e.type === 'chunk').map((e) => e.code || '').join('\n');
    const classRefs = js.match(/className:\s*"(fj-[a-z0-9]+)"/g) || [];
    expect(classRefs.length).toBe(2);
    expect(new Set(classRefs).size).toBe(1);

    // Closing the loop: the class the JS uses is the class the CSS defines.
    const jsCls = js.match(/className:\s*"(fj-[a-z0-9]+)"/)![1];
    const cssCls = allCss.match(/\.(fj-[a-z0-9]+)\s*\{/)![1];
    expect(cssCls).toBe(jsCls);
  });

  it('keeps distinct rules from different files intact', async () => {
    const output = await buildFixture({
      'a.tsx': `
        import { styled } from '@filbert-js/core';
        export const A = styled.button\`color: red;\`;
      `,
      'b.tsx': `
        import { styled } from '@filbert-js/core';
        export const B = styled.div\`background: blue;\`;
      `,
      'entry.tsx': `
        export { A } from './a';
        export { B } from './b';
      `,
    });

    const allCss = output
      .filter((e) => e.fileName.endsWith('.css'))
      .map(readSource)
      .join('\n');
    expect(allCss).toMatch(/color:\s*red/);
    expect(allCss).toMatch(/background:\s*blue/);
    const classDefs = allCss.match(/\.fj-[a-z0-9]+\s*\{/g) || [];
    expect(classDefs.length).toBe(2);
  });
});
