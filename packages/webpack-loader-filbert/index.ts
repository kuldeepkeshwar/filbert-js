// webpack-loader-filbert
//
// Same idea as vite-plugin-filbert but for Webpack. For every JS/TS file it
// runs babel-plugin-filbert, walks the output for `.withConfig({ ..., css:
// '<body>' })` calls, strips the css body and replaces it with `preInjected:
// true, className: 'fj-<hash>'`, then emits a `<name>.filbert.css` sidecar
// asset with the compiled rules.
//
// Downstream, users pipe the sidecar through `css-loader` /
// MiniCssExtractPlugin. This loader does NOT try to auto-import the sidecar
// into the JS module — Webpack's CSS story is user-configured and we should
// not fight it. Consumers who want auto-import can wrap us in a companion
// plugin.

import type { LoaderContext } from 'webpack';
import * as babel from '@babel/core';
import * as path from 'path';
import filbertPlugin, { type FilbertPluginOptions } from 'babel-plugin-filbert';

// oxc-plugin-filbert is loaded lazily — the module is TypeScript ESM and the
// webpack loader itself is transpiled to CJS by consumers; unconditional
// top-level `import` would crash the CJS resolver before the engine option
// is read. `type-only import` gives us the type signature without a runtime
// dependency until we actually use it.
type OxcTransform = typeof import('oxc-plugin-filbert').transform;
let _oxcTransform: OxcTransform | null = null;
function loadOxcTransform(): OxcTransform | null {
  if (_oxcTransform !== null) return _oxcTransform;
  try {


    _oxcTransform = require('oxc-plugin-filbert').transform as OxcTransform;
    return _oxcTransform;
  } catch {
    return null;
  }
}

export interface FilbertWebpackLoaderOptions {
  babelPluginOptions?: FilbertPluginOptions;
  // Which transform engine to use. Defaults to 'oxc' (native-parser,
  // 5-10× faster than babel on styled-heavy files; falls back to babel
  // when oxc can't parse). 'babel' opts out.
  engine?: 'oxc' | 'babel';
  // Set false to skip the CSS-hoisting step (still runs the transform).
  emitCssFile?: boolean;
  // Extension for the sidecar. Defaults to `.filbert.css`.
  sidecarExt?: string;
}

// Djb2, matches packages/core/src/hash.ts and babel-plugin-filbert/src/util.ts.
function hash32(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}
function shortHash(str: string): string {
  return (hash32(str) >>> 0).toString(36);
}

interface ExtractionResult {
  code: string;
  map: babel.BabelFileResult['map'];
  cssBody: string;
  didExtract: boolean;
}

interface ExtractionOptions {
  inputSourceMap?: any;
  sourceMaps?: boolean;
}

function extractCssFromWithConfig(
  code: string,
  filename: string,
  opts: ExtractionOptions = {},
): ExtractionResult {
  const rules: string[] = [];

  const stripper: babel.PluginObj = {
    visitor: {
      CallExpression(path) {
        const callee = path.node.callee;
        if (callee.type !== 'MemberExpression') return;
        if (callee.computed) return;
        if (callee.property.type !== 'Identifier' || callee.property.name !== 'withConfig') return;
        const arg = path.node.arguments[0];
        if (!arg || arg.type !== 'ObjectExpression') return;

        let cssIdx = -1;
        let cssStr: string | null = null;
        for (let i = 0; i < arg.properties.length; i++) {
          const p = arg.properties[i];
          if (p.type !== 'ObjectProperty') continue;
          if (p.computed) continue;
          const key = p.key;
          const keyName =
            key.type === 'Identifier'
              ? key.name
              : key.type === 'StringLiteral'
                ? key.value
                : null;
          if (keyName !== 'css') continue;
          if (p.value.type !== 'StringLiteral') continue;
          cssIdx = i;
          cssStr = p.value.value;
          break;
        }
        if (cssIdx === -1 || cssStr == null) return;

        const cls = `fj-${shortHash(cssStr)}`;
        rules.push(`.${cls} { ${cssStr} }`);

        const t = babel.types;
        arg.properties.splice(cssIdx, 1);
        arg.properties.push(
          t.objectProperty(t.identifier('preInjected'), t.booleanLiteral(true)),
          t.objectProperty(t.identifier('className'), t.stringLiteral(cls)),
        );
      },
    },
  };

  const out = babel.transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: opts.sourceMaps ?? false,
    inputSourceMap: opts.inputSourceMap ?? undefined,
    ast: false,
    plugins: [stripper],
    parserOpts: { sourceType: 'module', allowReturnOutsideFunction: true },
  });
  if (!out || !out.code) return { code, map: null, cssBody: '', didExtract: false };
  return {
    code: out.code,
    map: out.map,
    cssBody: rules.join('\n'),
    didExtract: rules.length > 0,
  };
}

function filbertLoader(
  this: LoaderContext<FilbertWebpackLoaderOptions>,
  source: string,
  inputMap?: any,
) {
  const callback = this.async();
  if (!callback) throw new Error('webpack-loader-filbert requires this.async()');

  const opts = (this.getOptions?.() ?? {}) as FilbertWebpackLoaderOptions;
  const emitCssFile = opts.emitCssFile !== false;
  const engine = opts.engine ?? 'oxc';
  const babelOpts = opts.babelPluginOptions ?? {};
  const sidecarExt = opts.sidecarExt ?? '.filbert.css';
  const filename = this.resourcePath;
  const isTsx = filename.endsWith('.tsx') || filename.endsWith('.jsx');

  (async () => {
    let transformedCode: string;
    let transformedMap: any = null;

    const oxcTransform = engine === 'oxc' ? loadOxcTransform() : null;
    if (oxcTransform) {
      try {
        const oxcOut = oxcTransform(source, filename, {
          ...babelOpts,
          fallbackToBabel: true,
          sourceMap: !!this.sourceMap,
        });
        if (oxcOut.bailed) return callback(null, source);
        transformedCode = oxcOut.code;
        transformedMap = oxcOut.map ?? null;
      } catch (e) {
        return callback(e as Error);
      }
    } else {
      let babelOut: babel.BabelFileResult | null;
      try {
        babelOut = await babel.transformAsync(source, {
          filename,
          babelrc: false,
          configFile: false,
          sourceMaps: this.sourceMap,
          inputSourceMap: inputMap ?? undefined,
          ast: false,
          presets: [
            ['@babel/preset-typescript', { isTSX: isTsx, allExtensions: true }],
          ],
          plugins: [[filbertPlugin, babelOpts]],
          parserOpts: { sourceType: 'module' },
        });
      } catch (e) {
        return callback(e as Error);
      }
      if (!babelOut || babelOut.code == null) return callback(null, source);
      transformedCode = babelOut.code;
      transformedMap = babelOut.map ?? null;
    }

    if (!emitCssFile) {
      return callback(null, transformedCode, transformedMap);
    }

    const { code: strippedCode, map: strippedMap, cssBody, didExtract } = extractCssFromWithConfig(
      transformedCode,
      filename,
      { inputSourceMap: transformedMap ?? undefined, sourceMaps: this.sourceMap },
    );
    if (!didExtract) {
      return callback(null, transformedCode, transformedMap);
    }

    const base = path.basename(filename).replace(/\.[^.]+$/, '');
    const key = shortHash(filename + '::' + cssBody);
    const assetName = `${base}.${key}${sidecarExt}`;

    // `emitFile` on the loader context adds the sidecar to Webpack's output —
    // downstream CSS pipeline picks it up when the user wires the sidecar into
    // an entry (or a companion plugin injects a `<link>`).
    if (typeof this.emitFile === 'function') {
      this.emitFile(assetName, cssBody, undefined as any);
    }

    // Expose the sidecar name to downstream tooling. buildInfo is Webpack's
    // official metadata channel; MiniCssExtractPlugin uses the same pattern.
    const mod: any = (this as any)._module;
    if (mod) {
      mod.buildInfo = mod.buildInfo || {};
      mod.buildInfo.filbertCssAsset = assetName;
      mod.buildInfo.filbertCssBody = cssBody;
    }

    // The composed map (filbert babel pass + extraction rewrite), not the
    // first pass's map — the first pass doesn't describe the stripped code.
    callback(null, strippedCode, (strippedMap ?? transformedMap) as any);
  })();
}

export default filbertLoader;
export { filbertLoader };
