# webpack-loader-filbert

Webpack loader for [filbert-js](https://github.com/kuldeepkeshwar/filbert-js).

Same idea as `vite-plugin-filbert`: runs `babel-plugin-filbert` and hoists the extracted static
CSS out of the JS bundle. Emits the compiled rules as a `.filbert.css` sidecar asset and adds it
to `module.buildInfo.filbertCssAsset` so downstream plugins can wire it up.

## Install

```sh
pnpm add -D webpack-loader-filbert babel-plugin-filbert
```

## Usage

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.(t|j)sx?$/,
        exclude: /node_modules/,
        use: [
          { loader: 'webpack-loader-filbert', options: {} },
          // (your existing swc-loader / babel-loader if you have one)
        ],
      },
    ],
  },
};
```

To have the sidecar CSS end up in your bundle, pair with `css-loader` + `MiniCssExtractPlugin`
via a companion plugin that reads `module.buildInfo.filbertCssAsset` and inserts a
`<link rel="stylesheet">` (or an `import` at the entry point) — that wiring stays out of this
loader so you keep full control of your CSS pipeline.

## Options

```ts
{
  emitCssFile?: boolean;               // default true; false = skip hoisting
  sidecarExt?: string;                 // default '.filbert.css'
  babelPluginOptions?: FilbertPluginOptions;
}
```

## How it works

Identical extraction pipeline to the Vite plugin — the class hash is the djb2 in
`packages/core/src/hash.ts`, so build-time and runtime derive the same class name and the
extracted CSS file matches what the runtime would have injected.
