// vite-plugin-filbert
//
// Runs babel-plugin-filbert on every project source file, then walks the
// output for `.withConfig({ ..., css: '<body>' })` calls, hoists each css
// string into a virtual CSS module (so Vite links it as a static stylesheet)
// and replaces the property with `preInjected: true, className: 'fj-<hash>'`
// so the runtime skips createStyles for those rules.
//
// The className scheme mirrors the runtime fast-path in styled.tsx:
//   className = `fj-${(hash(cssBody) >>> 0).toString(36)}`
// where `hash` is the djb2 in packages/core/src/hash.ts. That keeps the
// build-time and runtime hashes in lock-step even for a fallback render.

import type { Plugin, ResolvedConfig } from 'vite';
import * as babel from '@babel/core';
import filbertPlugin, { type FilbertPluginOptions } from 'babel-plugin-filbert';

export interface FilbertViteOptions {
  // File filter. Defaults match tsx/ts/jsx/js and skip node_modules.
  include?: RegExp;
  exclude?: RegExp;
  // Set false to skip the CSS-hoisting step (still runs babel-plugin-filbert).
  // Useful when a downstream toolchain wants the raw `css:` string intact.
  emitCssFile?: boolean;
  // Forwarded to babel-plugin-filbert.
  babelPluginOptions?: FilbertPluginOptions;
}

// Djb2, matches packages/core/src/hash.ts and babel-plugin-filbert's hash32.
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

// Virtual-module bookkeeping. Vite/Rollup resolves modules by string id, so
// we use a stable `?id=<hash>` query and keep the CSS body in a plain Map.
const VIRTUAL_PREFIX = 'virtual:filbert.css';
const RESOLVED_PREFIX = '\0' + VIRTUAL_PREFIX;

interface ExtractionResult {
  code: string;
  map: babel.BabelFileResult['map'];
  cssBody: string;
  didRewrite: boolean;
}

interface ExtractionOptions {
  inputSourceMap?: any;
  sourceMaps?: boolean;
  // Return false to skip emitting the rule for a class (cross-module dedup)
  // while still rewriting the JS to `preInjected` + `className`.
  shouldEmitRule?: (cls: string) => boolean;
}

// Post-babel pass: for each `.withConfig({ ..., css: '<body>' })`, replace
// the `css` property with `preInjected` + `className` and collect the body.
// Runs as a self-contained babel plugin so we get real AST walking rather
// than regex over generated source.
function extractCssFromWithConfig(
  code: string,
  filename: string,
  opts: ExtractionOptions = {},
): ExtractionResult {
  const rules: string[] = [];
  let didRewrite = false;

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
        didRewrite = true;
        if (!opts.shouldEmitRule || opts.shouldEmitRule(cls)) {
          rules.push(`.${cls} { ${cssStr} }`);
        }

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
  if (!out || !out.code) {
    return { code, map: null, cssBody: '', didRewrite: false };
  }
  return {
    code: out.code,
    map: out.map,
    cssBody: rules.join('\n'),
    didRewrite,
  };
}

export default function filbert(options: FilbertViteOptions = {}): Plugin {
  const include = options.include ?? /\.(t|j)sx?$/;
  const exclude = options.exclude ?? /node_modules/;
  const emitCssFile = options.emitCssFile !== false;
  const babelOpts = options.babelPluginOptions ?? {};

  // Per-module CSS body, keyed by hash. resolveId/load serve it back.
  const cssByHash = new Map<string, string>();
  // Class → owning module. Identical templates in different modules hash to
  // the same class, so only the first module emits the rule; later modules
  // still get the JS rewrite but skip the duplicate CSS. Ownership (rather
  // than a bare Set) keeps a dev-server re-transform of the owner from
  // dropping its own rules.
  const ruleOwner = new Map<string, string>();
  let config: ResolvedConfig | undefined;

  return {
    name: 'vite-plugin-filbert',
    enforce: 'pre',

    configResolved(c) {
      config = c;
    },

    resolveId(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) return '\0' + id;
      return null;
    },

    load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return null;
      const real = id.slice(1);
      const q = real.indexOf('?id=');
      if (q === -1) return '';
      const key = real.slice(q + 4);
      return cssByHash.get(key) ?? '';
    },

    async transform(code, id) {
      const cleanId = id.split('?')[0];
      if (!include.test(cleanId)) return null;
      if (exclude.test(cleanId)) return null;

      // Cheap skip when the file clearly has no filbert templates. `styled` is
      // the identifier the plugin looks for; if it isn't referenced at all,
      // babel would be a no-op — bail with the source unchanged.
      if (!code.includes('styled') && !code.includes('css') && !code.includes('keyframes')) {
        return null;
      }

      const isTsx = cleanId.endsWith('.tsx') || cleanId.endsWith('.jsx');
      let babelOut: babel.BabelFileResult | null;
      try {
        babelOut = await babel.transformAsync(code, {
          filename: cleanId,
          babelrc: false,
          configFile: false,
          // Always produce a map — Vite composes plugin maps and drops them
          // itself when sourcemaps are disabled for the build.
          sourceMaps: true,
          ast: false,
          presets: [
            ['@babel/preset-typescript', { isTSX: isTsx, allExtensions: true }],
          ],
          plugins: [[filbertPlugin, babelOpts]],
          parserOpts: { sourceType: 'module' },
        });
      } catch (e) {
        this.error?.((e as Error).message);
        return null;
      }
      if (!babelOut || babelOut.code == null) return null;

      if (!emitCssFile) {
        return { code: babelOut.code, map: babelOut.map as any };
      }

      const { code: strippedCode, map, cssBody, didRewrite } = extractCssFromWithConfig(
        babelOut.code,
        cleanId,
        {
          inputSourceMap: babelOut.map,
          sourceMaps: true,
          shouldEmitRule: (cls) => {
            const owner = ruleOwner.get(cls);
            if (owner && owner !== cleanId) return false;
            ruleOwner.set(cls, cleanId);
            return true;
          },
        },
      );
      if (!didRewrite) {
        return { code: babelOut.code, map: babelOut.map as any };
      }
      if (!cssBody) {
        // Every rule in this module is owned elsewhere — JS rewrite only.
        return { code: strippedCode, map: map as any };
      }

      const key = shortHash(cleanId + '::' + cssBody);
      cssByHash.set(key, cssBody);

      // Appended (not prepended) so the extraction map's line numbers stay
      // valid; ES import position is irrelevant to module linking.
      const importLine = `\nimport ${JSON.stringify(`${VIRTUAL_PREFIX}?id=${key}`)};\n`;
      return { code: strippedCode + importLine, map: map as any };
    },
  };
}

// Named export mirrors the default so both `import filbert from …` and
// `import { filbert } from …` resolve.
export { filbert };
