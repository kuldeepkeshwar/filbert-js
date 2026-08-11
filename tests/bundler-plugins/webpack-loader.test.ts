// @vitest-environment node
//
// webpack-loader-filbert integration test.
//
// Runs a real webpack build in-memory via memfs. Assertions mirror the Vite
// test: the compiled JS carries preInjected + className, and a `.filbert.css`
// sidecar asset is emitted with the extracted rule. The runtime-side contract
// lives in preinjected-runtime.test.tsx.

import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import webpack, { type Configuration, type Stats } from 'webpack';
import { createFsFromVolume, Volume } from 'memfs';
import { transformSync } from '@babel/core';

// Webpack does a plain CJS `require()` on the loader module — it cannot parse
// TypeScript. Transpile the source file once, then rewrite the bare-name
// requires (`@babel/core`, `babel-plugin-filbert`) to absolute paths so a
// temp-dir loader can still resolve them without a node_modules install of
// its own.
const loaderJsCache = { path: '' };
function buildLoaderJs(): string {
  if (loaderJsCache.path) return loaderJsCache.path;
  const srcPath = path.resolve(__dirname, '../../packages/webpack-loader-filbert/index.ts');
  const src = fs.readFileSync(srcPath, 'utf8');
  const out = transformSync(src, {
    filename: srcPath,
    babelrc: false,
    configFile: false,
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
      ['@babel/preset-typescript', { isTSX: false, allExtensions: true }],
    ],
  });
  if (!out || !out.code) throw new Error('failed to transpile webpack loader');

  const absoluteBabelCore = path.resolve(__dirname, '../node_modules/@babel/core');
  const absoluteBabelPlugin = path.resolve(__dirname, '../../packages/babel-plugin-filbert/index.ts');
  // Rewrite the bare-name requires to absolute paths so require() succeeds no
  // matter where the loader.js lives. `babel-plugin-filbert/index.ts` is TS —
  // transpile it inline the same way and point to that.
  const pluginJs = transformSync(fs.readFileSync(absoluteBabelPlugin, 'utf8'), {
    filename: absoluteBabelPlugin,
    babelrc: false,
    configFile: false,
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
      ['@babel/preset-typescript', { isTSX: false, allExtensions: true }],
    ],
  });
  if (!pluginJs || !pluginJs.code) throw new Error('failed to transpile babel plugin index');
  // The re-exported `./src` is TS too — inline that path resolution.
  const srcIndex = path.resolve(__dirname, '../../packages/babel-plugin-filbert/src/index.ts');
  const utilPath = path.resolve(__dirname, '../../packages/babel-plugin-filbert/src/util.ts');
  const extractPath = path.resolve(__dirname, '../../packages/babel-plugin-filbert/src/extract.ts');
  const variantsPath = path.resolve(__dirname, '../../packages/babel-plugin-filbert/src/variants.ts');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-loader-'));

  // Transpile the whole babel-plugin-filbert package into the same dir, keeping
  // relative structure so require('./src') and its subimports resolve.
  const pkgDir = path.join(dir, 'babel-plugin-filbert');
  fs.mkdirSync(path.join(pkgDir, 'src'), { recursive: true });
  function writeTranspiled(from: string, to: string) {
    const r = transformSync(fs.readFileSync(from, 'utf8'), {
      filename: from,
      babelrc: false,
      configFile: false,
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        ['@babel/preset-typescript', { isTSX: false, allExtensions: true }],
      ],
    });
    if (!r || !r.code) throw new Error(`failed to transpile ${from}`);
    fs.writeFileSync(to, r.code);
  }
  writeTranspiled(absoluteBabelPlugin, path.join(pkgDir, 'index.js'));
  writeTranspiled(srcIndex, path.join(pkgDir, 'src', 'index.js'));
  writeTranspiled(utilPath, path.join(pkgDir, 'src', 'util.js'));
  writeTranspiled(extractPath, path.join(pkgDir, 'src', 'extract.js'));
  writeTranspiled(variantsPath, path.join(pkgDir, 'src', 'variants.js'));
  fs.writeFileSync(
    path.join(pkgDir, 'package.json'),
    JSON.stringify({ name: 'babel-plugin-filbert', main: 'index.js' }),
  );

  const p = path.join(dir, 'loader.js');
  let loaderCode = out.code
    .replace(/require\(["']@babel\/core["']\)/g, `require(${JSON.stringify(absoluteBabelCore)})`)
    .replace(/require\(["']babel-plugin-filbert["']\)/g, `require(${JSON.stringify(pkgDir)})`);
  // Webpack's loader-runner does NOT interop `exports.default` — it wants
  // `module.exports = fn` directly. The transpiled `export default` produces
  // the former. Bridge it here.
  loaderCode += '\nif (module.exports && module.exports.default) { module.exports = module.exports.default; }\n';
  fs.writeFileSync(p, loaderCode);
  loaderJsCache.path = p;
  return p;
}

interface AssetMap {
  [name: string]: string;
}

async function buildFixture(files: Record<string, string>, opts: { emitCssFile?: boolean } = {}): Promise<AssetMap> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-webpack-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents);
  }

  const loaderPath = buildLoaderJs();

  const config: Configuration = {
    mode: 'development',
    devtool: false,
    entry: path.join(dir, 'entry.tsx'),
    output: {
      path: '/out',
      filename: 'bundle.js',
      library: { type: 'commonjs2' },
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@filbert-js/core': path.resolve(__dirname, '../../packages/core/index.ts'),
      },
    },
    externals: {
      react: 'commonjs react',
      'react-dom': 'commonjs react-dom',
      'react/jsx-runtime': 'commonjs react/jsx-runtime',
      '@filbert-js/core': 'commonjs @filbert-js/core',
    },
    module: {
      rules: [
        {
          test: /\.(t|j)sx?$/,
          exclude: /node_modules/,
          use: [
            {
              // We only need the CSS-extraction behaviour for this test —
              // handing the code straight to webpack works because it strips
              // TypeScript via its own parser? No — webpack does not. Use ts-
              // shape-friendly source only. Our entry.tsx uses plain JS shapes.
              loader: loaderPath,
              options: { emitCssFile: opts.emitCssFile },
            },
          ],
        },
      ],
    },
  };

  const memfs = createFsFromVolume(new Volume());
  const compiler = webpack(config);
  // memfs types don't line up perfectly with webpack's OutputFileSystem — it
  // works at runtime because compiler only uses a subset of the surface.
  (compiler as any).outputFileSystem = Object.assign(memfs as any, { join: path.join });

  const stats: Stats = await new Promise((resolve, reject) => {
    compiler.run((err, s) => {
      if (err) return reject(err);
      if (!s) return reject(new Error('no stats'));
      compiler.close(() => (s.hasErrors() ? reject(new Error(s.toString({ errors: true, all: false }))) : resolve(s)));
    });
  });
  expect(stats.hasErrors()).toBe(false);

  const outDir = '/out';
  const names = memfs.readdirSync(outDir) as string[];
  const out: AssetMap = {};
  for (const n of names) {
    const p = path.join(outDir, n);
    out[n] = memfs.readFileSync(p, 'utf8') as string;
  }
  return out;
}

describe('webpack-loader-filbert', () => {
  it('emits a .filbert.css sidecar and rewrites withConfig with preInjected', async () => {
    // Note: entry.tsx uses only JS-valid syntax (no TS type annotations) so
    // webpack's parser can consume the loader's babel output directly without
    // a downstream ts-loader.
    const assets = await buildFixture({
      'entry.tsx': `
        import { styled } from '@filbert-js/core';
        export const Btn = styled.button\`
          color: red;
          padding: 8px;
        \`;
      `,
    });

    const jsName = Object.keys(assets).find((n) => n.endsWith('.js'))!;
    const js = assets[jsName];
    expect(js).toMatch(/preInjected:\s*(true|!0)/);
    expect(js).toMatch(/className:\s*"fj-[a-z0-9]+"/);
    expect(js).not.toMatch(/css:\s*"[^"]*color:\s*red[^"]*padding:\s*8px/);

    const cssName = Object.keys(assets).find((n) => n.endsWith('.filbert.css'));
    expect(cssName, 'expected a .filbert.css sidecar in webpack output').toBeDefined();
    const cssText = assets[cssName!];
    expect(cssText).toMatch(/\.fj-[a-z0-9]+\s*\{[^}]*color:\s*red/);
    expect(cssText).toMatch(/padding:\s*8px/);

    // Same invariant as the Vite test: JS class == CSS class.
    const jsCls = js.match(/className:\s*"(fj-[a-z0-9]+)"/)![1];
    const cssCls = cssText.match(/\.(fj-[a-z0-9]+)\s*\{/)![1];
    expect(cssCls).toBe(jsCls);
  });

  it('emitCssFile: false leaves the CSS in the JS bundle', async () => {
    const assets = await buildFixture(
      {
        'entry.tsx': `
          import { styled } from '@filbert-js/core';
          export const Btn = styled.button\`color: red;\`;
        `,
      },
      { emitCssFile: false },
    );
    const jsName = Object.keys(assets).find((n) => n.endsWith('.js'))!;
    const js = assets[jsName];
    expect(js).toMatch(/css:\s*"color:\s*red/);
    expect(js).not.toMatch(/preInjected/);
    expect(Object.keys(assets).some((n) => n.endsWith('.filbert.css'))).toBe(false);
  });
});
