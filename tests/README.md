# filbert-js baseline test suite

Vitest + React 18 + jsdom. Lives inside `tests/` so it can run against a modern
React without touching the outer lerna monorepo (which pins React 16 in
`resolutions` and runs `microbundle` on install).

## Run

```bash
cd tests
npm install       # installs vitest, react 18, testing-library, jsdom, tinybench
npm test          # unit + behavior + parser + ssr
npm run bench     # perf benchmarks (parser + mount + update + memory)
```

Aliases in `vitest.config.js` point every `@filbert-js/*` import at the package
source (`packages/*/index.js`). No build step needed.

## Layout

```
tests/
  helpers/
    setup.js               # afterEach cleanup — resets DOM
    render.jsx             # renderWithSheet — wraps every render in a fresh StyleSheetProvider
  parser/
    ast.test.js            # toAST() shape + rules + nesting + @media
    css-parser.test.js     # createParser() — namespacing, pseudos, descendants
    values.test.js         # url() / quoted strings / calc / gradients / custom props
    selectors.test.js      # combinators, :is/:not, [attr], nth-child
    at-rules.test.js       # @media (works) + @supports/@container/@font-face/@layer (xfail)
    bugs.test.js           # correctness bugs pinned as xfail
  behavior/
    styled-basic.test.jsx  # styled.tag / styled(tag) / styled(Component)
    interpolations.test.jsx
    theming.test.jsx       # ThemeProvider, nested, missing-provider
    keyframes.test.jsx     # dedup across components
    component-selector.test.jsx
    css-helper.test.jsx
    global.test.jsx        # <Global> insertion + removal
    cascade-and-as.test.jsx
    ref-forwarding.test.jsx
  stylesheet/
    lifecycle.test.jsx     # style-tag count, dedup, unmount cleanup
  ssr/
    ssr.test.jsx           # renderToString + getStyles + getReactElements + rehydration parity
  bench/
    parser.bench.js        # toAST + createParser throughput on flat/nested/media/general
    render.bench.jsx       # 100/1000-component mount, dynamic update, tag-count memory
```

## Reading the results

Every test tagged with `it.fails(...)` documents a **known bug or improvement
target** — it asserts the CORRECT behavior; today it fails; the refactor
flips it to green. Grepping the suite for `it.fails` gives the machine-readable
roadmap.

Concrete xfail categories:

- **Parser correctness bugs** — `Date.now()` delimiter, no comment support,
  escape sequences (`bugs.test.js`)
- **Value edge cases** — quoted strings containing `}` / `:` / `;`, escapes
  (`values.test.js`)
- **Selector edge cases** — `:is(a, b)`, `:not(.a, .b)`, `:where`,
  `[attr*="a,b"]`, `:nth-child(2n, 3n)` (`selectors.test.js`)
- **@-rule coverage** — `@supports`, `@container`, `@font-face`, `@layer`
  (`at-rules.test.js`)
- **Nullish interpolation drop** — `null` / `undefined` / `false` currently
  stringify into CSS instead of being dropped (`interpolations.test.jsx`)
- **Missing ThemeProvider** — should not crash (`theming.test.jsx`)
- **Merged stylesheet target** — one `<style>` tag instead of one per class
  (`stylesheet/lifecycle.test.jsx`)

## Baseline capture

After `npm install` succeeds, run:

```bash
npm test 2>&1 | tee BASELINE.txt
npm run bench 2>&1 | tee BASELINE-bench.txt
```

Commit those two files as the pre-refactor baseline. Compare after each change
to catch regressions.
