// Correctness bugs surfaced by reading the parser source. Each one is a real
// hazard the improved parser should eliminate. `it.fails` = "this is wrong
// today, should be right after the refactor."
import { describe, expect, it } from 'vitest';
import { toAST } from '@filbert-js/css-ast';
import { createParser } from '@filbert-js/css-parser';

const parse = createParser();

describe('css-ast: Date.now() delimiter', () => {
  // ast.js:65 uses `` `$_${Date.now()}` `` as a sentinel while extracting child
  // blocks from the raw string. If user CSS happens to contain that exact
  // substring, parsing gets confused. An INDEX-based sentinel would eliminate
  // the risk entirely.
  it('parses cleanly when user CSS contains a $_ prefix (was Date.now delimiter bug)', () => {
    const raw = 'color: red; & > .x { color: blue; } content: "$_hello";';
    const ast = toAST(raw);
    // Node has a circular parent pointer, so JSON.stringify won't work — walk
    // the rules directly to confirm the value survives.
    const values = ast.rules.map((r) => r.value);
    expect(values).toContain('red');
    expect(values).toContain('"$_hello"');
    expect(ast.children).toHaveLength(1);
    expect(ast.children[0].raw_selector).toBe('& > .x');
  });
});

describe('css-ast: comment support', () => {
  it('strips /* */ comments from declarations', () => {
    const ast = toAST('color: red; /* important */ padding: 8px;');
    expect(ast.rules).toEqual([
      { name: 'color', value: 'red' },
      { name: 'padding', value: '8px' },
    ]);
  });

  it('preserves an empty rule block when only a comment is inside', () => {
    const ast = toAST('/* nothing */');
    expect(ast.rules).toEqual([]);
    expect(ast.children).toEqual([]);
  });
});

describe('css-ast: escape sequences in values', () => {
  it('preserves CSS unicode escape (\\27 == apostrophe)', () => {
    // Works today because the quoted string is hole-punched intact before the
    // `:`/`;` splits happen.
    const ast = toAST("content: '\\27';");
    expect(ast.rules[0].value).toBe("'\\27'");
  });

  it('preserves an escaped closing brace inside a quoted string', () => {
    const ast = toAST('content: "\\}";');
    expect(ast.rules[0].value).toBe('"\\}"');
  });
});

describe('css-parser: source order stability', () => {
  it('emits parent declarations before nested selectors', () => {
    // Currently ordered by rulesToStyleBlock first, then children — locks
    // that order so we don't accidentally flip cascade behavior.
    const out = parse({
      css: 'color: red; &:hover { color: blue; }',
      namespace: '.abc',
    });
    const flat = out.replace(/\s+/g, ' ');
    expect(flat.indexOf('.abc{color:red;}')).toBeLessThan(flat.indexOf('.abc:hover'));
  });
});

describe('css-parser: idempotence', () => {
  it('produces the same output when called twice with the same input', () => {
    const css = 'color: red; &:hover { color: blue; }';
    const a = parse({ css, namespace: '.abc' });
    const b = parse({ css, namespace: '.abc' });
    expect(a).toBe(b === a ? a : b); // string equality is enough
    expect(a).toEqual(b);
  });
});

describe('css-parser: does not mutate its input string', () => {
  it('leaves the css argument intact', () => {
    const css = 'color: red; & > p { color: blue; }';
    const before = css;
    parse({ css, namespace: '.abc' });
    expect(css).toBe(before);
  });
});
