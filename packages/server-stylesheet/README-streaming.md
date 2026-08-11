# Streaming SSR with `@filbert-js/server-stylesheet`

`createStylesheet()` returns a `ServerStyleSheetAPI` that supports both the
classic string-based SSR path (`getStyles()` / `getReactElements()`) and
React 18's streaming renderers (`renderToPipeableStream` on Node,
`renderToReadableStream` on the Edge).

The streaming API is two calls:

| method               | returns   | side effect                       |
| -------------------- | --------- | --------------------------------- |
| `flushStyles()`      | `string`  | consumes the pending buffer       |
| `hasPendingStyles()` | `boolean` | none                              |

`flushStyles()` serializes every rule registered **since the previous
`flushStyles()` call** into a ready-to-inject `<style>` block, then clears
the pending marker. Emit it at each chunk boundary and the browser gets
the new rules exactly once — no duplication, no re-emit of the shell's
initial rules on subsequent chunks.

Bucket order in each flushed block is `k` (keyframes) → `g` (globals) → `c`
(component css), matching the invariant that keyframes and globals must
resolve before any rule that references them.

---

## Pattern 1 — manual `renderToPipeableStream`

Call `flushStyles()` at `onShellReady` for the initial paint, then again at
`onAllReady` (or on every chunk if you want tighter granularity).

```ts
import { renderToPipeableStream } from 'react-dom/server';
import { createStylesheet } from '@filbert-js/server-stylesheet';

export function handler(req, res) {
  const sheet = createStylesheet();

  const stream = renderToPipeableStream(sheet.collectStyles(<App />), {
    onShellReady() {
      res.setHeader('content-type', 'text/html');
      // Shell chunk: HTML shell + everything registered so far.
      res.write(sheet.flushStyles());
      stream.pipe(res);
    },
    onAllReady() {
      // After Suspense boundaries resolve, any styles registered while
      // rendering the resolved children are still pending — flush them
      // once more before the response closes.
      if (sheet.hasPendingStyles()) res.write(sheet.flushStyles());
    },
    onError(err) {
      console.error(err);
    },
  });
}
```

Order matters: write `flushStyles()` **before** `pipe(res)` so the initial
styles land ahead of the shell HTML.

## Pattern 2 — `createStyleFlusher` Transform

For a simpler wiring — no manual event bookkeeping — splice the packaged
`Transform` between React's output and your destination. It calls
`flushStyles()` on every chunk and prepends the block; the first chunk
that contains `<head>` gets the styles spliced inside the head element.

```ts
import { renderToPipeableStream } from 'react-dom/server';
import {
  createStylesheet,
  createStyleFlusher,
} from '@filbert-js/server-stylesheet';

export function handler(req, res) {
  const sheet = createStylesheet();
  const flusher = createStyleFlusher(sheet);
  flusher.pipe(res);

  const stream = renderToPipeableStream(sheet.collectStyles(<App />), {
    onShellReady() {
      res.setHeader('content-type', 'text/html');
      stream.pipe(flusher);
    },
    onError(err) {
      console.error(err);
    },
  });
}
```

The Transform is passthrough when nothing is pending, so it's safe to
leave in the pipeline for the whole stream lifetime.

---

## Notes

- `flushStyles()` clears its pending marker even if the returned string is
  empty — call it as often as you like.
- Bucket order (`k`, `g`, `c`) is preserved across incremental flushes.
- The virtual `<style>` tags carry `data-type="styled-css"` and
  `styled-type="k" | "g" | "c"` attributes so the browser runtime can
  reuse them for rehydration without re-inserting duplicate rules.
- All filbert public entries that ship to the client
  (`@filbert-js/core`, `@filbert-js/style-sheet-context`,
  `@filbert-js/theming`) declare `'use client'`, so an RSC-aware bundler
  treats them as the client boundary. `@filbert-js/server-stylesheet` is
  server-only and deliberately unmarked.
