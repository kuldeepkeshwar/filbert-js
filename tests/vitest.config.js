// Vitest config for the filbert suite.
//
// The tests/ folder is a standalone npm project — its own package.json
// isolates vitest + React 18 + testing-library from the monorepo (which pins
// React 16 in `resolutions` and runs microbundle on every install). Aliases
// point every `@filbert-js/*` import at the package source (whichever
// extension is present: .ts / .tsx / .js / .jsx) so we don't need to build.
//
// Source files can freely mix .ts and .js during the TS conversion — the
// resolver picks the first extension that exists per package.

import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

const repoRoot = path.resolve(__dirname, '..');

const pkgs = [
  'core',
  'browser-stylesheet',
  'server-stylesheet',
  'stylesheet',
  'style-sheet-context',
  'css-parser',
  'css-ast',
  'theming',
  'types',
];

function resolvePackageEntry(pkgName) {
  const base = path.join(repoRoot, 'packages', pkgName, 'index');
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  throw new Error(`No entry found for @filbert-js/${pkgName}`);
}

const alias = Object.fromEntries(pkgs.map((p) => [`@filbert-js/${p}`, resolvePackageEntry(p)]));

// Bare-name aliases for the bundler plugins so tests can
// `import filbert from 'vite-plugin-filbert'` without a node_modules install.
alias['vite-plugin-filbert'] = path.join(repoRoot, 'packages/vite-plugin-filbert/index.ts');
alias['webpack-loader-filbert'] = path.join(repoRoot, 'packages/webpack-loader-filbert/index.ts');

// The packages/ source imports `react` — but there's no node_modules at the
// repo root (never yarn-installed). Pin react/react-dom to tests/node_modules
// so vitest resolves them from OUR project.
alias['react'] = path.join(__dirname, 'node_modules/react');
alias['react-dom'] = path.join(__dirname, 'node_modules/react-dom');
alias['react-dom/server'] = path.join(__dirname, 'node_modules/react-dom/server.js');
alias['react-dom/client'] = path.join(__dirname, 'node_modules/react-dom/client.js');
alias['react/jsx-runtime'] = path.join(__dirname, 'node_modules/react/jsx-runtime.js');
alias['react/jsx-dev-runtime'] = path.join(__dirname, 'node_modules/react/jsx-dev-runtime.js');

// Optional babel fallback path — babel-plugin-filbert lives in the workspace.
alias['babel-plugin-filbert'] = path.join(repoRoot, 'packages/babel-plugin-filbert/index.ts');
// @filbert-js/autoprefixer is a legacy JS module used only by gatsby-plugin-filbert.
alias['@filbert-js/autoprefixer'] = path.join(repoRoot, 'packages/autoprefixer/index.js');
// Under pnpm each workspace package gets its own symlinked node_modules so
// transitive deps (magic-string / oxc-parser / stylis / babel-plugin-macros /
// style-vendorizer / @babel/core) resolve naturally from their consumer's
// directory. No manual aliases needed — vitest walks the parent chain.

export default defineConfig({
  resolve: {
    alias,
    dedupe: ['react', 'react-dom'],
    // TS/TSX first so a mid-conversion state (some packages TS, some JS) does
    // not accidentally resolve to a stale .js file.
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
  },
  esbuild: {
    jsx: 'automatic',
    loader: 'tsx',
    // Any .js / .jsx / .ts / .tsx under packages/ or tests/ gets TSX-loaded so
    // JSX inside .js files (legacy) and .ts files (transitional) both work.
    include: /\.(js|jsx|ts|tsx)$/,
    exclude: [],
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./helpers/setup.ts'],
    include: ['**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['bench/**', 'node_modules/**'],
    restoreMocks: true,
    benchmark: {
      include: ['bench/**/*.bench.{js,jsx,ts,tsx}'],
    },
  },
});
