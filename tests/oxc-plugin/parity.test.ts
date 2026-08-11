// Parity tests — for each fixture the oxc plugin's output must be
// functionally equivalent to babel-plugin-filbert's. Because babel reprints
// via AST and oxc splices via magic-string, exact string equality is not on
// the table; instead we assert on the semantic payload (label / componentId
// / css / withConfig placement / kebab-cased tag / pure comment / variant
// sidecar).
import { describe, expect, it } from 'vitest';
import { transformSync } from '@babel/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import babelFilbertPlugin from '../../packages/babel-plugin-filbert/index';
import { transform as oxcTransform } from '../../packages/oxc-plugin-filbert/index';

function babel(code: string, filename: string, opts: any = {}) {
  const out = transformSync(code, {
    babelrc: false,
    configFile: false,
    filename,
    presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
    plugins: [[babelFilbertPlugin, opts]],
  });
  if (!out?.code) throw new Error('babel returned no code');
  return out.code;
}

function oxc(code: string, filename: string, opts: any = {}) {
  return oxcTransform(code, filename, opts).code;
}

// Extract every `.withConfig({...})` config object as a normalised JSON blob
// so we can compare babel vs oxc without caring about quote style / spacing.
function withConfigs(code: string): string[] {
  const out: string[] = [];
  // Match the whole `{ … }` after `.withConfig(`; the properties we emit are
  // string-valued so a shallow brace-counter is enough (no nested braces).
  const re = /\.withConfig\(\s*\{([^{}]*)\}\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const body = m[1].trim();
    // normalise: strip trailing commas, collapse whitespace
    const norm = body.replace(/\s+/g, ' ').replace(/,\s*$/, '');
    out.push(norm);
  }
  return out;
}

// Grab the value of a property inside a withConfig payload as a JS string.
function extractProp(configBody: string, prop: string): string | null {
  const re = new RegExp(`${prop}\\s*:\\s*(["'])((?:\\\\.|(?!\\1).)*)\\1`);
  const m = configBody.match(re);
  return m ? m[2] : null;
}

interface Fixture {
  name: string;
  filename: string;
  src: string;
  expect: {
    withConfigs?: Array<{ label?: string; componentId?: RegExp; css?: RegExp | string | null }>;
    contains?: RegExp[];
    doesNotContain?: RegExp[];
    pure?: boolean;
  };
}

const fixtures: Fixture[] = [
  {
    name: 'styled.button — static template',
    filename: '/src/Button.tsx',
    src: `
      import { styled } from '@filbert-js/core';
      const PrimaryButton = styled.button\`color: red; padding: 8px;\`;
    `,
    expect: {
      withConfigs: [{
        label: 'Button__PrimaryButton',
        componentId: /^fj-[a-z0-9]+$/,
        css: /color: red; padding: 8px;/,
      }],
      contains: [/styled\(["']button["']\)/],
      pure: true,
    },
  },

  {
    name: 'styled(Component) — composition',
    filename: '/src/Wrap.tsx',
    src: `
      import { styled } from '@filbert-js/core';
      const Inner = () => null;
      const Wrap = styled(Inner)\`color: blue;\`;
    `,
    expect: {
      withConfigs: [{
        label: 'Wrap__Wrap',
        componentId: /^fj-[a-z0-9]+$/,
        css: /color: blue;/,
      }],
      contains: [/styled\(Inner\)\.withConfig/],
      pure: true,
    },
  },

  {
    name: '.attrs chain — withConfig lands before .attrs',
    filename: '/src/Attrs.tsx',
    src: `
      import { styled } from '@filbert-js/core';
      const Btn = styled.button.attrs({ type: 'button' })\`color: green;\`;
    `,
    expect: {
      withConfigs: [{
        label: 'Attrs__Btn',
        componentId: /^fj-[a-z0-9]+$/,
        // static extraction won't fire because .attrs() call sits between root
        // and quasi — that doesn't matter, but the tag body is still static.
        css: /color: green;/,
      }],
      // The rewrite should preserve the .attrs() call.
      contains: [/\.attrs\(\s*\{\s*type/],
      pure: true,
    },
  },

  {
    name: 'static extraction — RED const',
    filename: '/src/Colored.tsx',
    src: `
      import { styled } from '@filbert-js/core';
      const RED = '#ff0000';
      const X = styled.button\`color: \${RED};\`;
    `,
    expect: {
      withConfigs: [{
        label: 'Colored__X',
        componentId: /^fj-[a-z0-9]+$/,
        css: /color: #ff0000;/,
      }],
    },
  },

  {
    name: 'static extraction — nested member chain',
    filename: '/src/Theme.tsx',
    src: `
      import { styled } from '@filbert-js/core';
      const theme = { colors: { primary: 'tomato' } };
      const X = styled.button\`color: \${theme.colors.primary};\`;
    `,
    expect: {
      withConfigs: [{
        css: /color: tomato/,
      }],
    },
  },

  {
    name: 'dynamic function interpolation — stays untouched',
    filename: '/src/Dyn.tsx',
    src: `
      import { styled } from '@filbert-js/core';
      const X = styled.button\`color: \${(p) => p.$active ? 'red' : 'blue'};\`;
    `,
    expect: {
      withConfigs: [{
        label: 'Dyn__X',
        componentId: /^fj-[a-z0-9]+$/,
        css: null, // no css:
      }],
    },
  },

  {
    name: 'non-styled tag — no rewrites at all',
    filename: '/src/gql.tsx',
    src: `
      const gql = (s) => s;
      const q = gql\`query { foo }\`;
    `,
    expect: {
      doesNotContain: [/\.withConfig/, /#__PURE__/],
    },
  },
];

describe('oxc plugin — parity with babel plugin', () => {
  for (const f of fixtures) {
    it(f.name, () => {
      const bOut = babel(f.src, f.filename);
      const oOut = oxc(f.src, f.filename);

      // Both outputs must contain the same set of withConfig payloads.
      const bConfigs = withConfigs(bOut);
      const oConfigs = withConfigs(oOut);
      expect(oConfigs.length).toBe(bConfigs.length);

      if (f.expect.withConfigs) {
        for (let i = 0; i < f.expect.withConfigs.length; i++) {
          const want = f.expect.withConfigs[i];
          const bc = bConfigs[i];
          const oc = oConfigs[i];
          if (want.label !== undefined) {
            expect(extractProp(bc, 'label')).toBe(want.label);
            expect(extractProp(oc, 'label')).toBe(want.label);
          }
          if (want.componentId !== undefined) {
            expect(extractProp(bc, 'componentId')).toMatch(want.componentId);
            expect(extractProp(oc, 'componentId')).toMatch(want.componentId);
          }
          if (want.css === null) {
            expect(extractProp(bc, 'css')).toBeNull();
            expect(extractProp(oc, 'css')).toBeNull();
          } else if (want.css instanceof RegExp) {
            expect(extractProp(bc, 'css')).toMatch(want.css);
            expect(extractProp(oc, 'css')).toMatch(want.css);
          }
        }
      }

      if (f.expect.contains) {
        for (const re of f.expect.contains) {
          expect(bOut).toMatch(re);
          expect(oOut).toMatch(re);
        }
      }
      if (f.expect.doesNotContain) {
        for (const re of f.expect.doesNotContain) {
          expect(bOut).not.toMatch(re);
          expect(oOut).not.toMatch(re);
        }
      }
      if (f.expect.pure) {
        expect(bOut).toContain('#__PURE__');
        expect(oOut).toContain('#__PURE__');
      }

      // Labels and componentIds must be byte-identical across engines even
      // when the surrounding syntax differs.
      for (let i = 0; i < bConfigs.length; i++) {
        expect(extractProp(oConfigs[i], 'label')).toBe(extractProp(bConfigs[i], 'label'));
        expect(extractProp(oConfigs[i], 'componentId')).toBe(extractProp(bConfigs[i], 'componentId'));
      }
    });
  }
});

describe('oxc plugin — variant .filbert.d.ts parity', () => {
  it('emits identical sidecars for a variant-heavy component', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const Btn = styled.button\`
        color: \${(p) => p.$variant === 'primary' ? 'red' : 'blue'};
        font-size: \${(p) => p.$size === 'sm' ? '12px' : p.$size === 'lg' ? '20px' : '16px'};
      \`;
    `;

    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-b-'));
    const dirO = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-o-'));
    const fnameB = path.join(dirB, 'Button.tsx');
    const fnameO = path.join(dirO, 'Button.tsx');

    babel(src, fnameB);
    oxc(src, fnameO);

    const bDts = fs.readFileSync(path.join(dirB, 'Button.filbert.d.ts'), 'utf8');
    const oDts = fs.readFileSync(path.join(dirO, 'Button.filbert.d.ts'), 'utf8');

    // The first line names the emitter — that's the only intentional
    // difference. Strip it and compare the rest.
    const bBody = bDts.split('\n').slice(1).join('\n');
    const oBody = oDts.split('\n').slice(1).join('\n');
    expect(oBody).toBe(bBody);
  });

  it('does not emit a sidecar when no variant comparisons are present', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-o-'));
    const filename = path.join(dir, 'Plain.tsx');
    oxc(
      `
        import { styled } from '@filbert-js/core';
        const X = styled.button\`color: red;\`;
      `,
      filename,
    );
    expect(fs.existsSync(path.join(dir, 'Plain.filbert.d.ts'))).toBe(false);
  });
});
