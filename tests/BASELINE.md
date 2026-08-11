# Filbert baseline — pre-refactor snapshot

Locked-in behavior + numbers as of the current `master`. Regenerate with
`npm test` / `npm run bench` from `tests/`. Compare against these after each
change to catch regressions.

## Suite

- **17 test files**, **142 passing**, **1 todo**, **0 red on green infra**.
- Every red `it.fails(...)` documents a known bug or improvement target. Grep
  the tree for them to get the machine-readable roadmap.

## Known bugs pinned as `it.fails` (10 total)

| File | Bug |
|---|---|
| `parser/values.test.js` | `url("/logo.png")` — quoted string hole-punch leaves `_1_/logo.png_2_` token in output |
| `parser/values.test.js` | `url("data:...")` with `;` inside crashes buildRules with "cannot read `.trim` of undefined" |
| `parser/selectors.test.js` | `&[attr="value"]` — quoted attribute value stripped by hole-punch |
| `parser/selectors.test.js` | `:is(a, b)` / `:not(.a, .b)` / `:where(a, b)` split on comma inside parens |
| `parser/selectors.test.js` | `[attr*="a,b"]` split on the comma inside the attribute value |
| `parser/selectors.test.js` | `:nth-child(2n, 3n)` split on comma inside parens |
| `parser/at-rules.test.js` | `@supports` / `@container` / `@layer` fall through as descendant selectors instead of hoisting |
| `parser/at-rules.test.js` | `@font-face` emitted as `.abc @font-face { ... }` — invalid CSS |
| `parser/bugs.test.js` | `Date.now()` used as a delimiter substring in `buildRules` |
| `parser/bugs.test.js` | No `/* */` comment support |
| `behavior/interpolations.test.jsx` | `null` / `undefined` / `false` stringify into CSS instead of being dropped |
| `behavior/theming.test.jsx` | Missing `ThemeProvider` → `p.theme.brand` crashes (no `{}` default) |
| `behavior/keyframes.test.jsx` | `@keyframes` rule emits a trailing `,}` from `keyframe[RAW]` array coercion |
| `behavior/css-helper.test.jsx` | `${cssFragment}` in a styled template emits its class-selector string instead of inlining |
| `behavior/css-helper.test.jsx` | Using the same `css` fragment twice crashes `buildRules` |
| `stylesheet/lifecycle.test.jsx` | One `<style>` tag per unique class (target: single merged sheet) |

## Perf baseline (single run, macOS, Node 20)

### Parser throughput (`toAST` — no namespacing)

| shape | ops/sec | ns/op |
|---|---:|---:|
| flat body | **286,501** | 3.5 |
| @media | 217,844 | 4.6 |
| one-level nesting | 139,647 | 7.2 |
| general (nested + gradients + media) | 83,416 | 12.0 |

### Full parser pipeline (`createParser` — AST + namespace emit)

| shape | ops/sec | ns/op |
|---|---:|---:|
| flat body | **253,456** | 3.9 |
| @media | 186,825 | 5.4 |
| one-level nesting | 115,495 | 8.7 |
| general (nested + gradients + media) | 65,590 | 15.2 |

### Repeated calls (cache-hit surface — same input 100×)

| shape | ops/sec | per-parse (µs) |
|---|---:|---:|
| flat × 100 | 2,436 | 4.1 |
| nested × 100 | 1,150 | 8.7 |

Per-parse cost is essentially UNCHANGED across repeat calls — no memoization
today. This is the biggest single lever the refactor unlocks: a Map lookup
should be ~O(100ns), a ~40× speedup on repeat calls.

### React mount + update

| scenario | ops/sec | avg (ms) |
|---|---:|---:|
| Mount 100 simple styled components | 7,027 | 0.14 |
| Mount 1000 simple styled components | 1,142 | 0.88 |
| Mount 1000 dynamic (prop-driven) | 977 | 1.02 |
| Mount 1000 complex (nested + @media + dynamic) | 984 | 1.02 |
| Update 500 mounted with new prop values | 831 | 1.20 |
| Mount 1000 unique styled components (memory harness) | 845 | 1.18 |

## Post-refactor targets

- **Parser**: `flat body` under `createParser` → **≥ 800k ops/sec** (3× — via
  charcode fast path, no allocations).
- **Parser repeated call** (cache hit): **≥ 5M ops/sec** — Map lookup only.
- **Mount 1000 simple**: **≥ 3,000 ops/sec** (2.5×) — via lifted CSS work out
  of render + one merged `<style>` element.
- **Style tag count** for 1000 unique components: **1** (down from 1000).
- **Green all `it.fails` xfails** — every entry in the bug table above.

## How to compare later

```bash
cd tests
npm test 2>&1 | tee AFTER.txt
npm run bench 2>&1 | tee AFTER-bench.txt
diff BASELINE.txt AFTER.txt
# eyeball BASELINE-bench.txt vs AFTER-bench.txt for hz deltas
```
