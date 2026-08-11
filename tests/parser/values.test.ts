// Value-side edge cases: url() with commas, quoted strings, calc(), gradients,
// custom properties, !important, escapes. These are where filbert's current
// parser is most brittle (handleCSSValues only covers url + quoted strings).
import { describe, expect, it } from 'vitest';
import { createParser } from '@filbert-js/css-parser';
import { toAST } from '@filbert-js/css-ast';

const parse = createParser();
const norm = (s) => s.replace(/\s+/g, ' ').trim();

describe('url() values', () => {
  it('preserves url() with a plain path', () => {
    const ast = toAST('background: url(/logo.png);');
    expect(ast.rules[0]).toEqual({ name: 'background', value: 'url(/logo.png)' });
  });

  it('preserves url() with quotes', () => {
    const ast = toAST('background: url("/logo.png");');
    expect(ast.rules[0].value).toBe('url("/logo.png")');
  });

  it('preserves url() containing a comma in a data URI', () => {
    const dataUri = 'url("data:image/svg+xml;utf8,<svg xmlns=%27x%27/>")';
    const ast = toAST(`background: ${dataUri};`);
    expect(ast.rules[0].value).toBe(dataUri);
  });
});

describe('quoted string values', () => {
  it('preserves double-quoted content', () => {
    const ast = toAST('content: "hello";');
    expect(ast.rules[0]).toEqual({ name: 'content', value: '"hello"' });
  });

  it('preserves single-quoted content', () => {
    const ast = toAST("content: 'hello';");
    expect(ast.rules[0]).toEqual({ name: 'content', value: "'hello'" });
  });

  it('preserves a quoted string containing a closing brace', () => {
    const ast = toAST('content: "}";');
    expect(ast.rules).toEqual([{ name: 'content', value: '"}"' }]);
    expect(ast.children).toHaveLength(0);
  });

  it('preserves a quoted string containing a colon', () => {
    // Works today via the handleCSSValues hole-punch (the whole quoted string
    // is replaced with a token before the `:` split runs, then restored).
    const ast = toAST('content: "a:b";');
    expect(ast.rules).toEqual([{ name: 'content', value: '"a:b"' }]);
  });

  it('preserves a quoted string containing a semicolon', () => {
    // Same hole-punch save.
    const ast = toAST('content: "a;b";');
    expect(ast.rules).toEqual([{ name: 'content', value: '"a;b"' }]);
  });
});

describe('function values with commas', () => {
  it('preserves rgb() with commas', () => {
    const ast = toAST('color: rgb(255, 128, 0);');
    expect(ast.rules[0].value).toBe('rgb(255, 128, 0)');
  });

  it('preserves calc() with operators', () => {
    const ast = toAST('width: calc(100% - 8px);');
    expect(ast.rules[0].value).toBe('calc(100% - 8px)');
  });

  it('preserves linear-gradient() with multiple stops', () => {
    const ast = toAST('background: linear-gradient(red, blue);');
    expect(ast.rules[0].value).toBe('linear-gradient(red, blue)');
  });
});

describe('CSS custom properties', () => {
  it('captures --foo custom property declarations', () => {
    const ast = toAST('--brand: #e9679c;');
    expect(ast.rules[0]).toEqual({ name: '--brand', value: '#e9679c' });
  });

  it('preserves var() references in values', () => {
    const ast = toAST('color: var(--brand);');
    expect(ast.rules[0].value).toBe('var(--brand)');
  });

  it('preserves var() with fallback', () => {
    const ast = toAST('color: var(--brand, #f00);');
    expect(ast.rules[0].value).toBe('var(--brand, #f00)');
  });
});

describe('!important', () => {
  it('keeps !important as part of the value', () => {
    const ast = toAST('color: red !important;');
    expect(ast.rules[0].value).toBe('red !important');
  });
});

describe('numeric values and units', () => {
  it('preserves decimal numbers', () => {
    const ast = toAST('opacity: 0.5;');
    expect(ast.rules[0].value).toBe('0.5');
  });

  it('preserves negative values', () => {
    const ast = toAST('margin-top: -8px;');
    expect(ast.rules[0].value).toBe('-8px');
  });

  it('preserves multi-value shorthand (padding: 8px 16px)', () => {
    const ast = toAST('padding: 8px 16px 8px 16px;');
    expect(ast.rules[0].value).toBe('8px 16px 8px 16px');
  });
});

describe('parser output for values', () => {
  it('preserves function values through the full parse+emit', () => {
    const out = parse({
      css: 'background: linear-gradient(red, blue);',
      namespace: '.abc',
    });
    expect(norm(out)).toContain('linear-gradient(red, blue)');
  });

  it('preserves url() through the full parse+emit', () => {
    const out = parse({ css: 'background: url(/x.png);', namespace: '.abc' });
    expect(norm(out)).toContain('url(/x.png)');
  });
});
