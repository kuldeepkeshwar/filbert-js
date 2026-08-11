# oxc-plugin-filbert

Same three build-time transforms as `babel-plugin-filbert`, wired through
[`oxc-parser`](https://github.com/oxc-project/oxc) and applied with
[`magic-string`](https://github.com/rich-harris/magic-string) instead of a
full Babel parse/print cycle.

The reference behaviour (labels, componentIds, static extraction,
`.filbert.d.ts` sidecar) lives in `babel-plugin-filbert` — this package must
produce the same output for the covered subset, and the parity tests under
`tests/oxc-plugin/` prove it.

## Why

Filbert's build-time transforms are pure surgery on tagged templates. Running
them via Babel means paying for a full AST parse, tree walk, and reprint on
every file in the project — even the ones with no `styled` in them. On a
40-component fixture we measure:

| engine                   | per-file | speedup |
| ------------------------ | -------- | ------- |
| `babel-plugin-filbert`   | ~3.6 ms  | 1×      |
| `oxc-plugin-filbert`     | ~0.75 ms | ~4.7×   |
| non-styled file (either) | –        | ~2000×  |

The last row is where the win compounds in a real app: most files never
import `styled`, and `oxc-plugin-filbert` short-circuits with a string
`indexOf` before oxc even sees the file.

## Usage

```ts
import { transform } from 'oxc-plugin-filbert';

const { code, map, bailed, fallback } = transform(source, filename, {
  extract: true,       // static-extraction pass, default true
  emitDts: true,       // write .filbert.d.ts sidecar, default true
  pure: true,          // /*#__PURE__*/ comment, default true
  sourceMap: false,    // hires map from magic-string, default false
  fallbackToBabel: true, // on parse failure fall through to babel plugin
  onFallback: (info) => console.warn('oxc fallback:', info.filename, info.reason),
  imports: { styled: 'styled' }, // rename aliases
});
```

`bailed: true` means nothing changed — the file had no filbert-touchable
patterns, or it doesn't mention `styled` at all. Callers can use that to
skip source-map wiring.

## Bail rules

Anything the plugin can't confidently transform stays untouched — safer than
a subtly-wrong rewrite. Bails on:

- Tag isn't rooted at one of `styled` / `css` / `keyframes` / `Global`.
- Styled root isn't `styled.tag` / `styled('tag')` / `styled(Ident)` / a call/member chain that ends in one of those.
- Tagged template isn't at module scope (`const X = styled…` directly under
  `Program` — nested in a function body, IIFE, etc. bails).
- Static extraction only resolves literals, `const` identifiers bound at
  module scope, member chains into `const` object literals, and template
  literals of the above.

## Fallback

Some files may hit syntax `oxc-parser` doesn't yet handle (early-stage TC39
proposals, novel TS syntax). By default the plugin catches the parse error
and reruns via `babel-plugin-filbert` for that one file. Set
`fallbackToBabel: false` to make the error fatal.

## Not implemented

- The legacy `<div css={...}>` JSX pragma swap from `babel-plugin-filbert` —
  the JSX-pragma work is trivial in a Babel plugin (it emits an import) and
  awkward in a magic-string pipeline. Files that use it will need the babel
  path (either directly or via the fallback).
- Function-scope shadowing of `styled`. If a file locally shadows the
  imported identifier the plugin will not notice and will still rewrite the
  matching MemberExpression. Match `babel-plugin-filbert`'s behaviour — it
  doesn't check either.
