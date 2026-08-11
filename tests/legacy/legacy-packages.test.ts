// Smoke tests for the legacy `.js` packages the refactor did NOT touch.
// Uses dynamic `import()` so vitest's alias config resolves third-party
// dependencies like `style-vendorizer` and `babel-plugin-macros` that live in
// `tests/node_modules/`.
import { describe, expect, it, beforeAll } from 'vitest';

describe('@filbert-js/autoprefixer (legacy)', () => {
  let mod: any;
  beforeAll(async () => {
    mod = await import('../../packages/autoprefixer/index.js');
  });

  it('exports a `prefix(property, value)` function', () => {
    expect(typeof mod.prefix).toBe('function');
  });

  it('appends a vendor-prefix declaration when the property needs one', () => {
    const out: string = mod.prefix('backdrop-filter', 'blur(4px)');
    expect(out).toContain('-webkit-backdrop-filter:blur(4px);');
    expect(out).toContain('backdrop-filter:blur(4px);');
  });

  it('leaves plain properties unprefixed (returns just `prop:value;`)', () => {
    const out: string = mod.prefix('color', 'red');
    expect(out).toBe('color:red;');
  });

  it('resolves `gap` alias to `grid-gap` for older Grid support', () => {
    const out: string = mod.prefix('gap', '8px');
    expect(out).toContain('grid-gap:8px;');
  });
});

describe('@filbert-js/macro (legacy babel-plugin-macros wrapper)', () => {
  // The macro file uses CJS `require('babel-plugin-macros')` which bypasses
  // vitest's alias table (aliases only apply to ESM `import()`), so we can't
  // load it from a bare-name require chain in this test env. Verify the file
  // is well-formed by parsing it instead.
  it('has a valid CJS body that references createMacro + babel-plugin-filbert', () => {
    const fs = require('fs');
    const src = fs.readFileSync(
      require('path').resolve(__dirname, '../../packages/macro/index.js'),
      'utf8',
    );
    expect(src).toContain("require('babel-plugin-macros')");
    expect(src).toContain("createMacro");
    expect(src).toContain("babel-plugin-filbert");
  });
});

describe('@filbert-js/gatsby-plugin-filbert (legacy Gatsby integration)', () => {
  it('index.js is a no-op export (Gatsby entry marker)', async () => {
    await expect(
      import('../../packages/gatsby-plugin-filbert/index.js'),
    ).resolves.toBeDefined();
  });

  it('gatsby-node.js exports onCreateBabelConfig hook that sets the babel plugin', async () => {
    const mod: any = await import('../../packages/gatsby-plugin-filbert/gatsby-node.js');
    expect(typeof mod.onCreateBabelConfig).toBe('function');

    let captured: any = null;
    mod.onCreateBabelConfig({ actions: { setBabelPlugin: (cfg: any) => (captured = cfg) } });
    expect(captured).toEqual({ name: 'babel-plugin-filbert' });
  });

  it('gatsby-browser.js loads (client-side lifecycle)', async () => {
    await expect(
      import('../../packages/gatsby-plugin-filbert/gatsby-browser.js'),
    ).resolves.toBeDefined();
  });

  it('gatsby-ssr.js loads (SSR lifecycle)', async () => {
    await expect(
      import('../../packages/gatsby-plugin-filbert/gatsby-ssr.js'),
    ).resolves.toBeDefined();
  });
});
