// @vitest-environment node
//
// Real-browser smoke test — everything else in this suite runs in jsdom,
// which never computes styles. Here we bundle a tiny React 18 + filbert app
// with esbuild, serve it over a local http server, load it in REAL Chromium
// via Playwright, and assert with getComputedStyle:
//
//   * a static template actually paints (`color: red` → rgb(255, 0, 0))
//   * the S1 var-inversion mechanism cascades in a real engine — the rule
//     ships `var(--fj-N)` and the inline custom property drives the final
//     computed color (jsdom cannot validate this)
//   * `&:hover` responds to a real mouse hover
//   * exactly ONE styled-css tag of type "c" exists in <head>
//
// Guarded: if playwright or its chromium binary is missing on this machine,
// the whole suite is skipped with a warning instead of failing.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const testsDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../..');

// Same workspace aliases as bundle-size/runtime-size.test.ts, plus react —
// the repo root has no node_modules, so bare `react` imports inside
// packages/ must be pinned to tests/node_modules. React is bundled IN.
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

function aliasPlugin(): esbuild.Plugin {
  return {
    name: 'alias',
    setup(build) {
      const bare = Object.keys(alias).map((n) =>
        n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      );
      const filter = new RegExp(`^(${bare.join('|')})$`);
      build.onResolve({ filter }, (args) => ({ path: alias[args.path] }));
      // react / react-dom / their subpath imports resolve from
      // tests/node_modules regardless of the importing file's location.
      build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => ({
        path: require.resolve(args.path, { paths: [testsDir] }),
      }));
    },
  };
}

const DYNAMIC_COLOR = 'rgb(30, 60, 90)';

const APP_SOURCE = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { styled } from '@filbert-js/core';

const StaticBtn = styled('button')\`
  color: red;
  padding: 8px;
\`;

const DynamicSpan = styled('span')\`
  color: \${(p: any) => p.$c};
\`;

const HoverLink = styled('a')\`
  color: rgb(0, 128, 0);
  &:hover {
    color: rgb(0, 0, 255);
  }
\`;

const e = React.createElement;
createRoot(document.getElementById('root')!).render(
  e(
    React.Fragment,
    null,
    e(StaticBtn, { 'data-testid': 'static' }, 'static'),
    e(DynamicSpan, { 'data-testid': 'dynamic', $c: '${DYNAMIC_COLOR}' }, 'dynamic'),
    e(HoverLink, { 'data-testid': 'hover', href: '#' }, 'hover'),
  ),
);
`;

const INDEX_HTML = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>filbert smoke</title></head>
  <body><div id="root"></div><script src="/bundle.js"></script></body>
</html>`;

// Detect availability up front so the suite skips (not fails) on machines
// without playwright or a downloaded chromium binary.
let chromium: typeof import('playwright').chromium | null = null;
try {
  chromium = (await import('playwright')).chromium;
  const exe = chromium.executablePath();
  if (!exe || !fs.existsSync(exe)) {
    // eslint-disable-next-line no-console
    console.warn('[real-browser] chromium binary not installed — skipping suite');
    chromium = null;
  }
} catch {
  // eslint-disable-next-line no-console
  console.warn('[real-browser] playwright not installed — skipping suite');
}

describe.skipIf(!chromium)('real Chromium smoke test', () => {
  let server: http.Server;
  let browser: import('playwright').Browser;
  let page: import('playwright').Page;

  beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-browser-'));
    const entry = path.join(dir, 'app.ts');
    fs.writeFileSync(entry, APP_SOURCE);
    const { outputFiles } = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      format: 'iife',
      target: 'es2020',
      loader: { '.ts': 'ts' },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [aliasPlugin()],
      write: false,
      logLevel: 'silent',
    });
    const bundle = outputFiles[0].text;
    fs.rmSync(dir, { recursive: true, force: true });

    server = http.createServer((req, res) => {
      if (req.url === '/bundle.js') {
        res.writeHead(200, { 'content-type': 'text/javascript' });
        res.end(bundle);
      } else {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(INDEX_HTML);
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as import('net').AddressInfo;

    browser = await chromium!.launch();
    page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForSelector('[data-testid="static"]');
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const computedColor = (testid: string) =>
    page.$eval(
      `[data-testid="${testid}"]`,
      (el) => getComputedStyle(el).color,
    );

  it('static template computes color: red → rgb(255, 0, 0)', async () => {
    expect(await computedColor('static')).toBe('rgb(255, 0, 0)');
  });

  it('dynamic prop cascades through the CSS variable to the computed color', async () => {
    // The sheet rule is `color: var(--fj-N)`; the element's inline style sets
    // the variable. Only a real engine resolves that chain.
    expect(await computedColor('dynamic')).toBe(DYNAMIC_COLOR);
    const inline = await page.$eval(
      '[data-testid="dynamic"]',
      (el) => el.getAttribute('style') || '',
    );
    expect(inline).toMatch(/--fj-[\w-]+:/);
  });

  it('&:hover rule applies on a real mouse hover', async () => {
    expect(await computedColor('hover')).toBe('rgb(0, 128, 0)');
    await page.hover('[data-testid="hover"]');
    expect(await computedColor('hover')).toBe('rgb(0, 0, 255)');
  });

  it('exactly one styled-css tag of type "c" is in <head>', async () => {
    const count = await page.evaluate(
      () =>
        document.head.querySelectorAll(
          'style[data-type="styled-css"][styled-type="c"]',
        ).length,
    );
    expect(count).toBe(1);
  });
}, 30_000);
