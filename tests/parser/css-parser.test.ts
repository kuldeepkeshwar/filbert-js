// createParser — the layer above toAST that stringifies rules with a namespace
// applied (& → .cls, descendant selectors prefixed).
import { describe, expect, it } from 'vitest';
import { createParser } from '@filbert-js/css-parser';

const parse = createParser();
const NS = '.abc';

// Whitespace/formatting is not part of the contract — normalize before compare.
const norm = (s) => s.replace(/\s+/g, ' ').trim();

describe('flat declarations', () => {
  it('wraps rules in the namespace selector', () => {
    const out = parse({ css: 'color: red;', namespace: NS });
    expect(norm(out)).toBe('.abc{color:red;}');
  });

  it('emits multiple declarations in source order', () => {
    const out = parse({ css: 'color: red; padding: 8px;', namespace: NS });
    expect(norm(out)).toContain('color:red;');
    expect(norm(out)).toContain('padding:8px;');
    expect(norm(out).indexOf('color')).toBeLessThan(norm(out).indexOf('padding'));
  });

  it('emits an empty selector block for empty css', () => {
    const out = parse({ css: '', namespace: NS });
    expect(norm(out)).toBe('.abc{}');
  });
});

describe('pseudo selectors — the &: form', () => {
  it('replaces & with the namespace class', () => {
    const out = parse({ css: '&:hover { color: blue; }', namespace: NS });
    expect(norm(out)).toContain('.abc:hover{color:blue;}');
  });

  it('supports &::before pseudo elements', () => {
    const out = parse({ css: '&::before { content: "x"; }', namespace: NS });
    expect(norm(out)).toContain('.abc::before');
  });

  it('handles multiple pseudos in the same rule', () => {
    const out = parse({
      css: '&:hover { color: blue; } &:focus { color: green; }',
      namespace: NS,
    });
    expect(norm(out)).toContain('.abc:hover{color:blue;}');
    expect(norm(out)).toContain('.abc:focus{color:green;}');
  });
});

describe('nested self-reference — the & elsewhere', () => {
  it('replaces & when it appears mid-selector', () => {
    const out = parse({ css: 'header & { color: red; }', namespace: NS });
    expect(norm(out)).toContain('header .abc{color:red;}');
  });

  it('handles the sibling combinator & + &', () => {
    const out = parse({ css: '& + & { margin-top: 8px; }', namespace: NS });
    expect(norm(out)).toContain('.abc + .abc{margin-top:8px;}');
  });
});

describe('descendant selectors — bare tag/class inside', () => {
  it('prefixes bare descendant selectors with the namespace', () => {
    const out = parse({ css: 'p { color: red; }', namespace: NS });
    expect(norm(out)).toContain('.abc p{color:red;}');
  });

  it('prefixes multiple descendants independently', () => {
    const out = parse({ css: 'p { color: red; } a { color: blue; }', namespace: NS });
    expect(norm(out)).toContain('.abc p{color:red;}');
    expect(norm(out)).toContain('.abc a{color:blue;}');
  });
});

describe('media queries', () => {
  it('preserves the query and namespaces the rules inside', () => {
    const out = parse({
      css: '@media (min-width: 600px) { color: red; }',
      namespace: NS,
    });
    expect(norm(out)).toContain('@media (min-width: 600px)');
    expect(norm(out)).toContain('.abc{color:red;}');
  });

  it('scopes pseudo selectors inside @media', () => {
    const out = parse({
      css: '@media (min-width: 600px) { &:hover { color: red; } }',
      namespace: NS,
    });
    expect(norm(out)).toContain('.abc:hover{color:red;}');
  });
});

describe('multiple comma-separated selectors — the safe cases', () => {
  it('applies the namespace to each descendant when using a comma', () => {
    const out = parse({ css: 'p, span { color: red; }', namespace: NS });
    expect(norm(out)).toContain('.abc p');
    expect(norm(out)).toContain('.abc span');
  });

  it('applies pseudos correctly when the comma joins pseudo-selectors', () => {
    const out = parse({ css: '&:hover, &:focus { color: red; }', namespace: NS });
    expect(norm(out)).toContain('.abc:hover');
    expect(norm(out)).toContain('.abc:focus');
  });
});
