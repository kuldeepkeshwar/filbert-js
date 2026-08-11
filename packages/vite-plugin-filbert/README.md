# vite-plugin-filbert

Vite plugin for [filbert-js](https://github.com/kuldeepkeshwar/filbert-js).

Runs `babel-plugin-filbert` on every source file (so you get `displayName` / `componentId`
injection and static CSS extraction for free) and then **hoists the extracted CSS out of the JS
bundle** into a linked stylesheet. Fully-static styled components ship as plain class references —
the runtime never touches the CSSOM for them.

## Install

```sh
pnpm add -D vite-plugin-filbert babel-plugin-filbert
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import filbert from 'vite-plugin-filbert';

export default defineConfig({
  plugins: [filbert()],
});
```

## Options

```ts
filbert({
  include: /\.(t|j)sx?$/,     // files to process
  exclude: /node_modules/,    // files to skip
  emitCssFile: true,          // extract css: '...' → virtual stylesheet
  babelPluginOptions: {},     // forwarded to babel-plugin-filbert
});
```

Set `emitCssFile: false` if you want babel's `withConfig({ css: '...' })` output to stay in the
JS bundle (the runtime already handles that case with a fast path — no CSSOM parsing, but the CSS
bytes remain in your JS chunks).

## How it works

1. `transform(code, id)` — runs babel with `babel-plugin-filbert`.
2. Walks the resulting AST for `.withConfig({ ..., css: '<body>' })` calls.
3. Extracts every `css: '<body>'`, computes `className = fj-<djb2(body)>`, and rewrites the
   property as `preInjected: true, className: 'fj-<hash>'`.
4. Concatenates the extracted rules into a virtual CSS module
   (`virtual:filbert.css?id=<hash>`) and prepends a side-effect import so Vite links it as a
   real stylesheet chunk.
5. At runtime the styled component sees `preInjected: true`, uses the pre-hashed class and
   skips `__sheet.createStyles` — the class is already served by the linked file.

The djb2 hash matches `packages/core/src/hash.ts` and `babel-plugin-filbert/src/util.ts` so
build-time and runtime derive the same class name.

## Compatibility

Requires the runtime addition landed alongside this plugin — `WithConfig.preInjected` +
`WithConfig.className` fields on `@filbert-js/core`. Older versions of the runtime silently
ignore both fields, which reverts to the babel-only fast path (correct output, CSS bytes stay
in JS).
