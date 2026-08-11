// Tests for babel-plugin-filbert.
//
// Each test transforms a source snippet and asserts on the emitted code
// string or on the emitted `.filbert.d.ts` sidecar.
import { describe, expect, it } from 'vitest';
import { transformSync } from '@babel/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import filbertPlugin from '../../packages/babel-plugin-filbert/index';

function transform(
  code: string,
  opts: { filename?: string; pluginOptions?: any } = {},
): string {
  const out = transformSync(code, {
    babelrc: false,
    configFile: false,
    filename: opts.filename || '/virtual/Card.tsx',
    presets: [
      ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
    ],
    plugins: [[filbertPlugin, opts.pluginOptions || {}]],
  });
  if (!out || out.code == null) throw new Error('babel returned no code');
  return out.code;
}

describe('A. displayName / componentId injection', () => {
  it('adds withConfig({label,componentId}) to `const X = styled.tag\\`...\\``', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const PrimaryButton = styled.button\`color: red;\`;
    `;
    const out = transform(src, { filename: '/src/Button.tsx' });
    expect(out).toContain(".withConfig({");
    expect(out).toContain("label: \"Button__PrimaryButton\"");
    expect(out).toMatch(/componentId:\s*"fj-[a-z0-9]+"/);
  });

  it('rewrites styled.button → styled("button")', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const X = styled.button\`color: red;\`;
    `;
    const out = transform(src, { filename: '/src/X.tsx' });
    expect(out).toMatch(/styled\("button"\)/);
    expect(out).not.toMatch(/styled\.button/);
  });

  it('kebab-cases camelCase tag sugar (styled.mainButton → styled("main-button"))', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const X = styled.mainButton\`color: red;\`;
    `;
    const out = transform(src, { filename: '/src/X.tsx' });
    expect(out).toContain('styled("main-button")');
  });

  it('handles styled(Component) form', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const Inner = () => null;
      const Wrap = styled(Inner)\`color: red;\`;
    `;
    const out = transform(src, { filename: '/src/Wrap.tsx' });
    expect(out).toContain('label: "Wrap__Wrap"');
    expect(out).toContain('styled(Inner).withConfig');
  });

  it('leaves unassigned styled(...) templates alone (no varName)', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      function foo() {
        return styled.div\`color: red;\`;
      }
    `;
    const out = transform(src, { filename: '/src/foo.tsx' });
    // No withConfig injection because there is no enclosing VariableDeclarator
    // giving us a component name.
    expect(out).not.toContain('.withConfig');
  });

  it('adds a /*#__PURE__*/ comment to the tagged template', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const X = styled.button\`color: red;\`;
    `;
    const out = transform(src);
    expect(out).toContain('#__PURE__');
  });
});

describe('B. Static extraction (S4)', () => {
  it('extracts CSS from a template with only literals', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const X = styled.button\`
        color: red;
        padding: 8px;
      \`;
    `;
    const out = transform(src, { filename: '/src/X.tsx' });
    expect(out).toMatch(/css:\s*"[^"]*color: red[^"]*padding: 8px/);
  });

  it('resolves const identifiers to their literal value', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const RED = '#ff0000';
      const X = styled.button\`color: \${RED};\`;
    `;
    const out = transform(src, { filename: '/src/X.tsx' });
    expect(out).toMatch(/css:\s*"color: #ff0000/);
  });

  it('resolves member chains on const objects (theme.colors.primary)', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const theme = { colors: { primary: 'tomato' } };
      const X = styled.button\`color: \${theme.colors.primary};\`;
    `;
    const out = transform(src, { filename: '/src/X.tsx' });
    expect(out).toMatch(/css:\s*"color: tomato/);
  });

  it('does NOT extract when there is a function interpolation (live template)', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const X = styled.button\`color: \${(p) => p.$active ? 'red' : 'blue'};\`;
    `;
    const out = transform(src, { filename: '/src/X.tsx' });
    // withConfig gets label/componentId but NOT css.
    expect(out).toContain('.withConfig');
    expect(out).not.toContain('css:');
  });

  it('does NOT extract when an unknown identifier is referenced', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      import { external } from 'somewhere';
      const X = styled.button\`color: \${external};\`;
    `;
    const out = transform(src, { filename: '/src/X.tsx' });
    expect(out).not.toContain('css:');
  });

  it('extract can be disabled via plugin options', () => {
    const src = `
      import { styled } from '@filbert-js/core';
      const X = styled.button\`color: red;\`;
    `;
    const out = transform(src, { filename: '/src/X.tsx', pluginOptions: { extract: false } });
    expect(out).toContain('.withConfig');
    expect(out).not.toContain('css:');
  });
});

describe('C. Variant TypeScript inference (S3)', () => {
  it('emits a .filbert.d.ts sidecar with the variant union', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-dts-'));
    const filename = path.join(dir, 'Button.tsx');

    const src = `
      import { styled } from '@filbert-js/core';
      const Btn = styled.button\`
        color: \${(p) => p.$variant === 'primary' ? 'red' : 'blue'};
        font-size: \${(p) => p.$size === 'sm' ? '12px' : p.$size === 'lg' ? '20px' : '16px'};
      \`;
    `;
    transform(src, { filename });

    const dts = path.join(dir, 'Button.filbert.d.ts');
    expect(fs.existsSync(dts)).toBe(true);
    const contents = fs.readFileSync(dts, 'utf8');
    expect(contents).toContain("declare module '*/Button'");
    expect(contents).toContain('export const Btn: StyledComponent<{');
    expect(contents).toMatch(/\$variant\?\?|"\$variant"\?:\s*"primary" \| "blue"|"\$variant"\?:\s*"primary"/);
    // The relevant literals appear
    expect(contents).toContain('"primary"');
    expect(contents).toContain('"sm"');
    expect(contents).toContain('"lg"');
  });

  it('does not emit a sidecar when no variant comparisons are present', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-dts-'));
    const filename = path.join(dir, 'Plain.tsx');
    const src = `
      import { styled } from '@filbert-js/core';
      const X = styled.button\`color: red;\`;
    `;
    transform(src, { filename });
    expect(fs.existsSync(path.join(dir, 'Plain.filbert.d.ts'))).toBe(false);
  });

  it('does not emit a sidecar when emitDts is false', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-dts-'));
    const filename = path.join(dir, 'Off.tsx');
    const src = `
      import { styled } from '@filbert-js/core';
      const X = styled.button\`color: \${(p) => p.$active === 'yes' ? 'red' : 'blue'};\`;
    `;
    transform(src, { filename, pluginOptions: { emitDts: false } });
    expect(fs.existsSync(path.join(dir, 'Off.filbert.d.ts'))).toBe(false);
  });

  it('collects literals from both `p.$x === L` and `L === p.$x`', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filbert-dts-'));
    const filename = path.join(dir, 'Sw.tsx');
    const src = `
      import { styled } from '@filbert-js/core';
      const S = styled.div\`
        color: \${(p) => 'primary' === p.$variant ? 'red' : (p.$variant === 'secondary' ? 'blue' : 'green')};
      \`;
    `;
    transform(src, { filename });
    const dts = fs.readFileSync(path.join(dir, 'Sw.filbert.d.ts'), 'utf8');
    expect(dts).toContain('"primary"');
    expect(dts).toContain('"secondary"');
  });
});

describe('Non-styled tags are left alone', () => {
  it('does not add withConfig to non-filbert tagged templates', () => {
    const src = `
      const gql = (s) => s;
      const q = gql\`query { foo }\`;
    `;
    const out = transform(src, { filename: '/src/X.tsx' });
    expect(out).not.toContain('.withConfig');
    expect(out).not.toContain('#__PURE__');
  });
});
