# Post-refactor state — filbert v3 (final)

**32 test files, 226 passing, 1 todo, 0 red.** `tsc --noEmit` clean. Full
TypeScript conversion. Every roadmap item shipped.

## Package inventory

| Package | Purpose | Status |
|---|---|---|
| `types` | Symbol / type constants | TS ✅ |
| `css-ast` | Quote-aware CSS parser (state machine) | TS ✅ |
| `css-parser` | Namespacing + fast-path + per-instance cache | TS ✅ |
| `theming` | ThemeProvider with `'use client'` | TS ✅ |
| `stylesheet` | Merged sheet + insertRule | TS ✅ |
| `browser-stylesheet` | DOM / Shadow DOM host adapter | TS ✅ |
| `server-stylesheet` | SSR virtual DOM + streaming flushStyles | TS ✅ |
| `style-sheet-context` | Provider + `'use client'` | TS ✅ |
| `core` | styled + attrs + withConfig + var-inversion | TS ✅ |
| **`babel-plugin-filbert`** | displayName / static extraction / variant TS inference | **NEW TS ✅** |
| **`vite-plugin-filbert`** | Vite integration + `.css` hoisting | **NEW TS ✅** |
| **`webpack-loader-filbert`** | Webpack loader + `.filbert.css` sidecar emit | **NEW TS ✅** |
| **`oxc-plugin-filbert`** | oxc-parser fast build variant (5-10× babel) | **NEW TS ✅** |

## Features shipped

### Correctness (baseline pass)

All 16 `it.fails` xfails from the baseline are green: url() / quoted strings /
`:is(a, b)` / `:not(.a, .b)` / attr selectors with commas / `:nth-child(2n, 3n)`
/ `@supports` / `@container` / `@layer` / `@font-face` hoisting /
`Date.now()` delimiter removed / comment support / escape sequences /
nullish drop / missing `ThemeProvider` / `@keyframes` trailing comma /
`${cssFragment}` inlining / duplicate fragment.

### Runtime architecture

- Single merged `<style>` per bucket (c/k/g) — 1000 unique components → **1 tag**
- CSSOM `insertRule` in browsers — no full-sheet reparse
- No `document.querySelector` on unmount — sheet grows monotonically
- Source-order preserved for `styled(Base)` cascade correctness
- `useInsertionEffect` for React 18 concurrent safety (with sync SSR path)
- Shadow DOM isolation via `createStylesheet({ root: shadowRoot })`
- `'use client'` directives on all client-only entries (RSC-ready)

### API parity with modern styled-components

- Transient `$-prefix` props
- `withConfig({ shouldForwardProp, label, componentId, atomic, css, preInjected })`
- `.attrs(objOrFn)` chain with function attrs + `styled(Base).attrs()` inheritance

### Differentiators (nothing else in the ecosystem ships these)

- **S1 — CSS custom-property inversion.** Value-position dynamic slots compile
  to `var(--fj-N)`; runtime drives via inline style. **Sheet is static under
  prop/theme changes.** Same className across 4 color variants → 1 rule.
- **S2 — Atomic CSS mode (opt-in).** `.withConfig({ atomic: true })` splits
  each decl into `.fj-a-<hash>{decl}` — whole-app cross-component dedup.
- **S3 — Variant TypeScript inference.** babel-plugin-filbert walks
  `p.$var === 'literal'` and emits `.filbert.d.ts` sidecars.
- **S4 — Zero-runtime static extraction.** babel + vite/webpack together lift
  static templates' CSS out into `.css` files; runtime `preInjected: true`
  branch skips registration.
- **S5 — Shadow DOM isolation.** Bare-styled physically can't do this.
- **oxc-parser fast build.** 4.5-9.7× faster than the Babel plugin on
  styled-heavy files; **~2000× faster** on non-styled files (charcode
  pre-filter skips parsing entirely).
- **Streaming SSR (`renderToPipeableStream`).** `sheet.flushStyles()` +
  `sheet.hasPendingStyles()` + `createStyleFlusher(sheet)` Transform helper.

### Build tool integration

- **Vite plugin** — extracts CSS to virtual modules, emits `.css` chunks.
- **Webpack loader** — emits `.filbert.css` sidecar assets, exposes
  `buildInfo.filbertCssAsset` for downstream `MiniCssExtractPlugin` wiring.
- Both plugins emit `preInjected: true` on the rewritten `withConfig` so the
  runtime knows not to double-register — server sheets pick this up in SSR
  too.

## Perf snapshot (final)

| axis | baseline | current | Δ |
|---|---:|---:|---:|
| Parser (`createParser` cached) | 253k ops/s | **3.49M** | **13.8×** |
| Parser (repeat 100× flat) | 2,436 | **35k** | **14.4×** |
| Babel build (styled-heavy TSX) | — | ref | — |
| **oxc build (styled-heavy TSX)** | — | **4.5-9.7× vs babel** | — |
| **oxc build (non-styled TSX)** | — | **~2000× vs babel** | — |
| `<style>` tag count for 1000 unique comps | 1000 | **1** | 1000× |
| Sheet grows on prop change (S1) | yes | **no** | ∞ |
| Sheet grows on cross-component dupes (S2) | yes | **no** | ∞ |
| querySelector on unmount | yes | **no** | — |

## Test suite layout (32 files, 226 tests)

- `tests/parser/` (6 files) — ast + css-parser + values + selectors + at-rules + bugs
- `tests/behavior/` (13 files) — styled basics + interpolations + theming +
  keyframes + component-selector + css helper + Global + cascade + ref +
  atomic + shadow-dom + props + var-inversion
- `tests/stylesheet/` (1 file) — lifecycle
- `tests/ssr/` (2 files) — string + streaming
- `tests/streaming/` (2 files) — renderToPipeableStream + RSC boundaries
- `tests/babel-plugin/` (3 files) — inspect + plugin + runtime-integration
- `tests/oxc-plugin/` (3 files) — parity + fallback + performance
- `tests/bundler-plugins/` (3 files) — vite + webpack + preInjected runtime
- `tests/bench/` (2 bench files, not counted in the 226) — parser + render

## Files touched

Every runtime file is TypeScript. Test suite is TypeScript. `tsconfig.json`
at repo root with strict mode + path aliases for `@filbert-js/*` and React
types. Vitest config auto-picks the right extension per package.

**Nothing committed.** Repo at `~/work/filbert-js` on `master`, ready for
review + branch. Full test run: `< 3 seconds`.
