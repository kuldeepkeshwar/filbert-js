// css-ast basics: node shape, rule extraction, nesting depth.
// Locks the AST's PUBLIC output shape so we can swap in a faster implementation
// and confirm parity.
import { describe, expect, it } from 'vitest';
import { toAST } from '@filbert-js/css-ast';

describe('toAST — root shape', () => {
  it('returns a root node with rules[] and children[]', () => {
    const ast = toAST('color: red;');
    expect(ast).toBeTruthy();
    expect(Array.isArray(ast.rules)).toBe(true);
    expect(Array.isArray(ast.children)).toBe(true);
  });

  it('extracts flat rules with name and value', () => {
    const ast = toAST('color: red; padding: 8px;');
    expect(ast.rules).toEqual([
      { name: 'color', value: 'red' },
      { name: 'padding', value: '8px' },
    ]);
    expect(ast.children).toHaveLength(0);
  });

  it('trims whitespace from names and values', () => {
    const ast = toAST('   color   :    red   ;   padding: 8px;');
    expect(ast.rules[0]).toEqual({ name: 'color', value: 'red' });
    expect(ast.rules[1]).toEqual({ name: 'padding', value: '8px' });
  });

  it('handles an empty string', () => {
    const ast = toAST('');
    expect(ast.rules).toEqual([]);
    expect(ast.children).toEqual([]);
  });

  it('handles a rule without a trailing semicolon', () => {
    const ast = toAST('color: red');
    expect(ast.rules).toEqual([{ name: 'color', value: 'red' }]);
  });

  it('handles multiple newlines and tabs between rules', () => {
    const ast = toAST('color: red;\n\n\tpadding: 8px;\n');
    expect(ast.rules).toEqual([
      { name: 'color', value: 'red' },
      { name: 'padding', value: '8px' },
    ]);
  });
});

describe('toAST — one level of nesting', () => {
  it('extracts a nested selector as a child node with raw_selector', () => {
    const ast = toAST('color: red; &:hover { color: blue; }');
    expect(ast.rules).toEqual([{ name: 'color', value: 'red' }]);
    expect(ast.children).toHaveLength(1);
    const hover = ast.children[0];
    expect(hover.raw_selector).toBe('&:hover');
    expect(hover.rules).toEqual([{ name: 'color', value: 'blue' }]);
  });

  it('extracts sibling nested selectors', () => {
    const ast = toAST('&:hover { color: blue; } &:focus { color: green; }');
    expect(ast.children).toHaveLength(2);
    expect(ast.children[0].raw_selector).toBe('&:hover');
    expect(ast.children[1].raw_selector).toBe('&:focus');
  });

  it('sets a parent pointer on children', () => {
    const ast = toAST('&:hover { color: blue; }');
    expect(ast.children[0].parent).toBe(ast);
  });
});

describe('toAST — deep nesting', () => {
  it('recurses two levels deep', () => {
    const ast = toAST(`
      color: red;
      & > .child {
        color: blue;
        &:hover { color: green; }
      }
    `);
    expect(ast.children).toHaveLength(1);
    const child = ast.children[0];
    expect(child.raw_selector).toBe('& > .child');
    expect(child.rules).toEqual([{ name: 'color', value: 'blue' }]);
    expect(child.children).toHaveLength(1);
    expect(child.children[0].raw_selector).toBe('&:hover');
    expect(child.children[0].rules).toEqual([{ name: 'color', value: 'green' }]);
  });
});

describe('toAST — media queries', () => {
  it('captures @media as a child node preserving the query', () => {
    const ast = toAST('@media (min-width: 600px) { color: red; }');
    expect(ast.children).toHaveLength(1);
    expect(ast.children[0].raw_selector).toBe('@media (min-width: 600px)');
    expect(ast.children[0].rules).toEqual([{ name: 'color', value: 'red' }]);
  });

  it('handles pseudo selectors nested inside @media', () => {
    const ast = toAST(`
      @media (min-width: 600px) {
        color: red;
        &:hover { color: blue; }
      }
    `);
    const media = ast.children[0];
    expect(media.rules).toEqual([{ name: 'color', value: 'red' }]);
    expect(media.children).toHaveLength(1);
    expect(media.children[0].raw_selector).toBe('&:hover');
  });
});
