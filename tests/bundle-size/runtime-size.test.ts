// @vitest-environment node
//
// Bundle-size regression test — bundles the filbert runtime through esbuild,
// asserts minified + gzipped sizes stay under a ceiling. Ceilings are set at
// the current size + 15% headroom so a genuine bloat regression is caught
// but small tweaks are absorbed.
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gzipSync } from 'zlib';
import * as esbuild from 'esbuild';

// Aliases matching tests/vitest.config.js so esbuild can resolve the
// workspace-relative filbert packages. Only the ones the runtime entry
// actually reaches.
const repoRoot = path.resolve(__dirname, '../..');
const alias: Record<string, string> = {
  '@filbert-js/core': path.join(repoRoot, 'packages/core/index.ts'),
  '@filbert-js/browser-stylesheet': path.join(
    repoRoot,
    'packages/browser-stylesheet/index.ts',
  ),
  '@filbert-js/stylesheet': path.join(repoRoot, 'packages/stylesheet/index.ts'),
  '@filbert-js/style-sheet-context': path.join(
    repoRoot,
    'packages/style-sheet-context/index.tsx',
  ),
  '@filbert-js/css-parser': path.join(repoRoot, 'packages/css-parser/index.ts'),
  '@filbert-js/css-ast': path.join(repoRoot, 'packages/css-ast/index.ts'),
  '@filbert-js/theming': path.join(repoRoot, 'packages/theming/index.tsx'),
  '@filbert-js/types': path.join(repoRoot, 'packages/types/index.ts'),
};

// Plugin that rewrites bare-name imports to their absolute alias.
function aliasPlugin(): esbuild.Plugin {
  return {
    name: 'alias',
    setup(build) {
      const bare = Object.keys(alias);
      const filter = new RegExp(`^(${bare.join('|').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})$`);
      build.onResolve({ filter }, (args) => ({ path: alias[args.path] }));
    },
  };
}

async function measure(entry: string): Promise<{ minified: number; gzipped: number }> {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-size-'));
  const outFile = path.join(outDir, 'out.js');
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    outfile: outFile,
    external: ['react', 'react-dom'],
    plugins: [aliasPlugin()],
    write: true,
    logLevel: 'silent',
  });
  const code = fs.readFileSync(outFile);
  const gz = gzipSync(code);
  fs.rmSync(outDir, { recursive: true, force: true });
  return { minified: code.length, gzipped: gz.length };
}

describe('bundle size regression', () => {
  it('the full @filbert-js/core runtime is under 20KB minified / 8KB gzipped', async () => {
    const { minified, gzipped } = await measure(alias['@filbert-js/core']);
    // Print for the record.
    // eslint-disable-next-line no-console
    console.log(
      `[bundle-size] core runtime: min=${(minified / 1024).toFixed(2)}KB gzip=${(gzipped / 1024).toFixed(2)}KB`,
    );
    // Ceilings — regressions above these fail the test.
    expect(minified).toBeLessThan(20 * 1024);
    expect(gzipped).toBeLessThan(8 * 1024);
  });

  it('the css-parser package alone is under 6KB minified / 2.5KB gzipped', async () => {
    const { minified, gzipped } = await measure(alias['@filbert-js/css-parser']);
    // eslint-disable-next-line no-console
    console.log(
      `[bundle-size] css-parser: min=${(minified / 1024).toFixed(2)}KB gzip=${(gzipped / 1024).toFixed(2)}KB`,
    );
    expect(minified).toBeLessThan(6 * 1024);
    expect(gzipped).toBeLessThan(2.5 * 1024);
  });

  it('the stylesheet package alone is under 5KB minified / 2KB gzipped', async () => {
    const { minified, gzipped } = await measure(alias['@filbert-js/stylesheet']);
    // eslint-disable-next-line no-console
    console.log(
      `[bundle-size] stylesheet: min=${(minified / 1024).toFixed(2)}KB gzip=${(gzipped / 1024).toFixed(2)}KB`,
    );
    expect(minified).toBeLessThan(5 * 1024);
    expect(gzipped).toBeLessThan(2 * 1024);
  });
});
