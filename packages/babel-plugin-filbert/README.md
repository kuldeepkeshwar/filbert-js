# babel-plugin-filbert

A Babel plugin for filbert-js. Three real transforms plus a couple of hygiene passes.

## Install

```
npm install --save-dev babel-plugin-filbert
```

```jsonc
// .babelrc
{ "plugins": ["babel-plugin-filbert"] }
```

## What it does

### A. displayName / componentId injection

Every top-level `const X = styled.tag`...`` (or `styled(Component)`...``) gets
`.withConfig({ label, componentId })` injected on the styled root:

```jsx
// src/Button.tsx
const PrimaryButton = styled.button`color: red;`;

// after:
const PrimaryButton = /*#__PURE__*/ styled('button').withConfig({
  label: 'Button__PrimaryButton',
  componentId: 'fj-abc123',
})`color: red;`;
```

- `label` is `<filename>__<varName>` — matches styled-components' naming.
- `componentId` is a djb2 hash of `<filename>::<varName>` in base36. Deterministic across builds.
- The `.withConfig` we inject sits at the root of the chain, so any user-authored `.withConfig(...)` further out overrides ours (last-write-wins in the runtime).

Only fires when the tag chain is rooted at the imported `styled` identifier and there is an enclosing `VariableDeclarator` with a plain identifier ID. Unassigned templates and non-styled tags are left alone.

The legacy `styled.mainButton` → `styled('main-button')` kebab rewrite is preserved.

### B. Static extraction (S4)

If every template interpolation resolves at build time, the plugin compiles the CSS body and passes it through as `withConfig({ css: '...' })`:

```jsx
const RED = '#ff0000';
const theme = { colors: { primary: 'tomato' } };
const X = styled.button`color: ${RED}; background: ${theme.colors.primary};`;

// after: withConfig gets `css: "color: #ff0000; background: tomato;"`.
```

The runtime (see the `precompiledCss !== undefined` branch in `packages/core/src/styled.tsx`) skips the interpolate pipeline entirely for these components: the CSS body is registered as-is under a stable `fj-<hash>` classname.

**What counts as static:**
- String / numeric / boolean / null literals
- Template literals whose expressions are recursively static
- Identifiers bound to a `const` initialiser that is itself static (via `path.scope.getBinding`)
- Member chains (`a.b.c`) rooted at a static-const object

Anything else — arrow functions, imported identifiers, unknown names, keyframes, nested styled components — marks the template dynamic and the runtime handles it exactly as before.

Disable with `{ extract: false }`.

### C. Variant `.d.ts` sidecar (S3)

The plugin walks every function interpolation for `p.$name === 'literal'` comparisons (both `!==` and switched forms are picked up too) and collects them per component. On `Program:exit` it writes a `<basename>.filbert.d.ts` sidecar:

```jsx
// src/Button.tsx
const Btn = styled.button`
  color: ${(p) => p.$variant === 'primary' ? 'red' : 'blue'};
  font-size: ${(p) => p.$size === 'sm' ? '12px' : '16px'};
`;
```

```ts
// src/Button.filbert.d.ts (auto-generated)
declare module '*/Button' {
  import type { StyledComponent } from '@filbert-js/core';
  export const Btn: StyledComponent<{
    "$size"?: "sm";
    "$variant"?: "primary";
  }>;
}
```

Only records literals seen inside `===` / `!==` comparisons — a variant only used in an early-return branch without a comparison won't appear. Disable with `{ emitDts: false }` or redirect with `{ dtsDir: '...' }`.

**Limitations** (this is the stretch goal):
- Records only the literals actually compared. `p.$size === 'sm' ? … : 'default'` yields `"$size"?: "sm"` — it does not infer `'default'` as a member.
- Only the first parameter form (`(p) => p.$x`) is handled; destructured params (`({ $x }) => …`) are not.
- The sidecar uses `declare module '*/<basename>'` and augments named exports — the styled component needs to be `export`ed for the ambient declaration to match at the callsite.

## Options

```ts
interface FilbertPluginOptions {
  imports?: { styled?: string; css?: string; keyframes?: string; Global?: string };
  pure?: boolean;   // emit /*#__PURE__*/; default true
  extract?: boolean; // static extraction; default true
  emitDts?: boolean; // write .filbert.d.ts sidecars; default true
  dtsDir?: string;   // sidecar directory (default: alongside source)
}
```

## Runtime coupling

The `css` shortcut needs the matching branch in `packages/core/src/styled.tsx` (added in v0.1.0). Older runtimes ignore the `css` field harmlessly, but you lose the fast path.
