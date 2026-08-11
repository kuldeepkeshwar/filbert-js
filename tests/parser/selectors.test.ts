// Selector-side edge cases. Most :is()/:not() variants involve a comma inside
// parentheses, which filbert's current comma-splitter in css-parser doesn't
// respect. These are pinned as red xfail so the improved parser can flip them
// green.
import { describe, expect, it } from 'vitest';
import { createParser } from '@filbert-js/css-parser';

const parse = createParser();
const norm = (s) => s.replace(/\s+/g, ' ').trim();

describe('attribute selectors', () => {
  it('handles &[attr] correctly', () => {
    const out = parse({ css: '&[data-active] { color: red; }', namespace: '.abc' });
    expect(norm(out)).toContain('.abc[data-active]{color:red;}');
  });

  it('handles &[attr="value"]', () => {
    const out = parse({
      css: '&[data-role="button"] { color: red; }',
      namespace: '.abc',
    });
    expect(norm(out)).toContain('.abc[data-role="button"]{color:red;}');
  });

  it('handles [attr*="a,b"] with a comma in the attribute value', () => {
    // The comma inside the attribute selector value causes the top-level split.
    const out = parse({
      css: '[data-tags*="a,b"] { color: red; }',
      namespace: '.abc',
    });
    expect(norm(out)).toContain('.abc [data-tags*="a,b"]{color:red;}');
  });
});

describe('combinators', () => {
  it('handles child combinator > *', () => {
    const out = parse({ css: '& > * { color: red; }', namespace: '.abc' });
    expect(norm(out)).toContain('.abc > *');
  });

  it('handles adjacent sibling combinator + ', () => {
    const out = parse({ css: '& + p { color: red; }', namespace: '.abc' });
    expect(norm(out)).toContain('.abc + p');
  });

  it('handles general sibling combinator ~', () => {
    const out = parse({ css: '& ~ p { color: red; }', namespace: '.abc' });
    expect(norm(out)).toContain('.abc ~ p');
  });
});

describe('functional pseudo classes with commas', () => {
  it(':is(a, b) is preserved as a single selector', () => {
    // BUG: the comma inside :is() is picked up by the selector splitter in
    // css-parser (`child.raw_selector.split(',')`), which fragments the
    // selector into two invalid halves.
    const out = parse({ css: ':is(a, b) { color: red; }', namespace: '.abc' });
    expect(norm(out)).toContain('.abc :is(a, b){color:red;}');
    // and NOT `.abc :is(a` on one side and `b){color:red}` on the other
    expect(norm(out)).not.toContain('.abc :is(a{');
  });

  it(':not(.a, .b) is preserved as a single selector', () => {
    const out = parse({ css: ':not(.a, .b) { color: red; }', namespace: '.abc' });
    expect(norm(out)).toContain('.abc :not(.a, .b)');
  });

  it(':where(a, b) is preserved as a single selector', () => {
    const out = parse({ css: ':where(a, b) { color: red; }', namespace: '.abc' });
    expect(norm(out)).toContain('.abc :where(a, b)');
  });

  it('nested :is/:not combinations survive', () => {
    const out = parse({
      css: ':is(a:not(.x, .y)) { color: red; }',
      namespace: '.abc',
    });
    expect(norm(out)).toContain('.abc :is(a:not(.x, .y))');
  });
});

describe('nth-child and friends', () => {
  it('handles &:nth-child(2n+1)', () => {
    const out = parse({ css: '&:nth-child(2n+1) { color: red; }', namespace: '.abc' });
    expect(norm(out)).toContain('.abc:nth-child(2n+1)');
  });

  it('handles &:nth-child(2n, 3n)', () => {
    // Modern CSS accepts `,` inside :nth-child; current parser splits on it.
    const out = parse({ css: '&:nth-child(2n, 3n) { color: red; }', namespace: '.abc' });
    expect(norm(out)).toContain('.abc:nth-child(2n, 3n)');
  });
});

describe('descendant with multiple selectors — the safe case', () => {
  it('splits `p, span` and prefixes each independently', () => {
    const out = parse({ css: 'p, span { color: red; }', namespace: '.abc' });
    expect(norm(out)).toMatch(/\.abc p,\s*\.abc span/);
  });
});
