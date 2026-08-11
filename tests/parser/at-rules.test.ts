// @-rule coverage: filbert supports @media today; @supports/@font-face/@import
// are marked TODO in the source (css-parser/index.js:23). Pinned as xfail so
// the improved parser flips them.
import { describe, expect, it } from 'vitest';
import { createParser } from '@filbert-js/css-parser';

const parse = createParser();
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('@media (supported today)', () => {
  it('emits the media query surrounding the namespaced rules', () => {
    const out = parse({
      css: '@media (min-width: 600px) { color: red; }',
      namespace: '.abc',
    });
    expect(norm(out)).toContain('@media (min-width: 600px)');
    expect(norm(out)).toContain('.abc{color:red;}');
  });

  it('handles complex media conditions', () => {
    const out = parse({
      css: '@media (min-width: 600px) and (max-width: 1200px) { color: red; }',
      namespace: '.abc',
    });
    expect(norm(out)).toContain('@media (min-width: 600px) and (max-width: 1200px)');
  });

  it('handles a nested @media inside a pseudo-selector rule (correctly hoists to top level)', () => {
    // Filbert DOES produce well-scoped output here — surprising, but nice.
    // Output: `.abc{} .abc:hover{color:red;} @media (min-width: 600px){.abc:hover{color:blue;}}`
    const out = parse({
      css: `
        &:hover {
          color: red;
          @media (min-width: 600px) { color: blue; }
        }
      `,
      namespace: '.abc',
    });
    const flat = norm(out);
    expect(flat).toContain('.abc:hover{color:red;}');
    expect(flat).toMatch(
      /@media\s+\(min-width:\s*600px\)\s*\{\s*\.abc:hover\s*\{[^}]*color:\s*blue/,
    );
  });
});

// The rules below fall through the css-parser as if they were descendant
// selectors — the at-rule text happens to survive in the output, but the
// structure is wrong (the query wraps `.abc .query { rules }` instead of
// `.query { .abc { rules } }`). Tightened assertions catch this.

describe('@supports — NOT SUPPORTED TODAY', () => {
  it('emits @supports outside .abc with namespaced rules inside', () => {
    const out = parse({
      css: '@supports (display: grid) { display: grid; }',
      namespace: '.abc',
    });
    // Correct output: `@supports (display: grid) { .abc { display:grid; } }`
    // The `.abc` selector must appear AFTER `@supports (…)` and INSIDE its block.
    expect(norm(out)).toMatch(
      /@supports\s+\(display:\s*grid\)\s*\{\s*\.abc\s*\{[^}]*display:\s*grid/,
    );
  });
});

describe('@container — NOT SUPPORTED TODAY', () => {
  it('emits @container outside .abc with namespaced rules inside', () => {
    const out = parse({
      css: '@container (min-width: 400px) { color: red; }',
      namespace: '.abc',
    });
    expect(norm(out)).toMatch(
      /@container\s+\(min-width:\s*400px\)\s*\{\s*\.abc\s*\{[^}]*color:\s*red/,
    );
  });
});

describe('@font-face — NOT SUPPORTED TODAY', () => {
  it('emits @font-face as a top-level rule (NOT `.abc @font-face`)', () => {
    // CURRENT BUG: filbert emits `.abc @font-face{...}` which treats @font-face
    // as a descendant selector — invalid CSS. It should be hoisted to the top
    // level as `@font-face { ... }`.
    const out = parse({
      css: '@font-face { font-family: "X"; src: url("/x.woff2"); }',
      namespace: '.abc',
    });
    expect(norm(out)).not.toContain('.abc @font-face');
    expect(norm(out)).toMatch(/^\s*@font-face\s*\{|\}\s*@font-face\s*\{/);
  });
});

describe('@layer / @scope — NOT SUPPORTED TODAY (modern CSS)', () => {
  it('emits @layer wrapping the namespaced rule correctly', () => {
    const out = parse({
      css: '@layer utilities { color: red; }',
      namespace: '.abc',
    });
    expect(norm(out)).toMatch(
      /@layer\s+utilities\s*\{\s*\.abc\s*\{[^}]*color:\s*red/,
    );
  });
});
