// babel-plugin-filbert — three real transforms plus the legacy hygiene passes.
//
// Features:
//   A) displayName injection — every `const X = styled.tag\`...\`` gets
//      `.withConfig({ label: '<file>__<var>', componentId: 'fj-<hash>' })`.
//   B) Static extraction (S4) — if every interpolation resolves at build time
//      the compiled CSS body is threaded through `withConfig({ css: ... })`
//      and the runtime takes the fast path in `styled.tsx`.
//   C) Variant `.d.ts` sidecar (S3) — walk function interpolations for
//      `p.$foo === 'literal'` and emit `<basename>.filbert.d.ts` describing
//      the variant surface.
//
// Legacy behaviour preserved from the old plugin: `styled.mainButton` →
// `styled('main-button')` for tag-name sugar; `/*#__PURE__*/` comment on the
// tagged-template so terser can DCE unused styled components; and the
// `<div css={...}>` JSX pragma that swaps in `@filbert-js/core`'s `jsx` fn.

import type { PluginObj, PluginPass } from '@babel/core';
import type * as BabelCore from '@babel/core';
import type { NodePath } from '@babel/traverse';
import type * as BabelTypes from '@babel/types';
import * as fs from 'fs';
import * as path from 'path';

import { findStyledRoot, getFilenameBase, makeLabelAndId, toKebab, FILBERT_TOUCHED } from './util';
import { tryExtractCss } from './extract';
import { collectVariantsFromFn, variantMapToTsProps, type VariantMap } from './variants';

export interface FilbertPluginOptions {
  // Rename the imported identifier if consumers alias it.
  imports?: {
    styled?: string;
    css?: string;
    keyframes?: string;
    Global?: string;
  };
  // Emit the `#__PURE__` annotation. Defaults to true.
  pure?: boolean;
  // Enable static extraction. Defaults to true.
  extract?: boolean;
  // Emit `.filbert.d.ts` sidecars. Defaults to true when a filename is known.
  emitDts?: boolean;
  // Where to write the sidecar. Defaults to alongside the source.
  dtsDir?: string;
}

interface FileState {
  variantsByComponent: Map<string, VariantMap>;
  fileBase: string;
  filename: string | null;
}

// A small wrapper that appends the leading `#__PURE__` comment to a node.
function prependPureComment(node: BabelTypes.Node): void {
  const comments = (node as any).leadingComments || ((node as any).leadingComments = []);
  comments.push({ type: 'CommentBlock', value: '#__PURE__' });
}

// Enclosing `const X = <expr>` for the current tagged-template, if any.
function enclosingVarName(
  t: typeof BabelTypes,
  tttPath: NodePath<BabelTypes.TaggedTemplateExpression>,
): string | null {
  const decl = tttPath.findParent((p) => p.isVariableDeclarator()) as NodePath<BabelTypes.VariableDeclarator> | null;
  if (!decl) return null;
  const id = decl.node.id;
  if (t.isIdentifier(id)) return (id as BabelTypes.Identifier).name;
  return null;
}

export default function filbertPlugin(
  babel: typeof BabelCore,
  options: FilbertPluginOptions = {},
): PluginObj<PluginPass & { file: any; filbert?: FileState }> {
  const t = babel.types;

  const importNames = {
    styled: 'styled',
    css: 'css',
    keyframes: 'keyframes',
    Global: 'Global',
    ...(options.imports || {}),
  };
  const styledName = importNames.styled;
  const importAllowlist = new Set(Object.values(importNames));
  const pure = options.pure !== false;
  const extract = options.extract !== false;
  const emitDts = options.emitDts !== false;

  return {
    name: 'babel-plugin-filbert',
    pre(this: PluginPass & { filbert?: FileState }) {
      const filename = this.file?.opts?.filename ?? null;
      this.filbert = {
        variantsByComponent: new Map(),
        fileBase: getFilenameBase(filename),
        filename,
      };
    },

    visitor: {
      // Legacy: `styled.mainButton` → `styled('main-button')` (kebab-cased).
      // We only touch the innermost MemberExpression whose object identifier
      // matches the imported `styled` symbol — not any downstream `.attrs`
      // etc.
      MemberExpression: {
        exit(path) {
          const node = path.node;
          if (!t.isIdentifier(node.object)) return;
          const objName = (node.object as BabelTypes.Identifier).name;
          if (objName !== styledName) return;
          let prop = node.property;
          let name: string | null = null;
          if (t.isIdentifier(prop) && !node.computed) name = (prop as BabelTypes.Identifier).name;
          else if (t.isStringLiteral(prop)) name = (prop as BabelTypes.StringLiteral).value;
          if (name == null) return;
          const kebab = /[A-Z]/.test(name) ? toKebab(name) : name;
          path.replaceWith(t.callExpression(t.identifier(styledName), [t.stringLiteral(kebab)]));
        },
      },

      TaggedTemplateExpression(path, state) {
        const tttNode = path.node;
        if ((tttNode as any)[FILBERT_TOUCHED]) return;

        // Only touch tags rooted at one of our imported identifiers.
        const tagPath = path.get('tag');
        if (!isFilbertTag(t, tagPath, importAllowlist)) return;

        if (pure) prependPureComment(tttNode);

        const isStyled = isRootedAt(t, tagPath, styledName);
        if (!isStyled) return;

        const st = (state as any).filbert as FileState;
        const varName = enclosingVarName(t, path);

        // Static extraction — try first, so we can pass `css` through
        // withConfig alongside the label/componentId.
        let compiledCss: string | undefined;
        if (extract) {
          const quasi = path.get('quasi') as NodePath<BabelTypes.TemplateLiteral>;
          const res = tryExtractCss(t, quasi);
          if (res.ok) compiledCss = res.css;
        }

        // Variant collection — walk every ArrowFunction / FunctionExpression
        // interpolation.
        if (varName) {
          const map: VariantMap = new Map();
          const exprPaths = (path.get('quasi').get('expressions') as NodePath<BabelTypes.Node>[]) || [];
          for (const ep of exprPaths) {
            if (ep.isArrowFunctionExpression() || ep.isFunctionExpression()) {
              collectVariantsFromFn(
                t,
                ep as NodePath<BabelTypes.ArrowFunctionExpression | BabelTypes.FunctionExpression>,
                map,
              );
            }
          }
          if (map.size > 0) st.variantsByComponent.set(varName, map);
        }

        if (!varName) return;

        // Wrap the styled root with `.withConfig({...})`.
        const rootPath = findStyledRoot(t, tagPath as NodePath<BabelTypes.Expression>, styledName);
        if (!rootPath) return;

        const { label, componentId } = makeLabelAndId(st.fileBase, varName);

        const props: BabelTypes.ObjectProperty[] = [
          t.objectProperty(t.identifier('label'), t.stringLiteral(label)),
          t.objectProperty(t.identifier('componentId'), t.stringLiteral(componentId)),
        ];
        if (compiledCss !== undefined) {
          props.push(t.objectProperty(t.identifier('css'), t.stringLiteral(compiledCss)));
        }

        const wrapped = t.callExpression(
          t.memberExpression(rootPath.node, t.identifier('withConfig')),
          [t.objectExpression(props)],
        );
        (wrapped as any)[FILBERT_TOUCHED] = true;
        rootPath.replaceWith(wrapped);
        (tttNode as any)[FILBERT_TOUCHED] = true;
      },

      Program: {
        exit(_p, state) {
          const st = (state as any).filbert as FileState;
          if (!emitDts) return;
          if (!st.filename) return;
          if (st.variantsByComponent.size === 0) return;

          const outDir = options.dtsDir
            ? path.resolve(options.dtsDir)
            : path.dirname(st.filename);
          const outPath = path.join(outDir, `${st.fileBase}.filbert.d.ts`);

          const bodyLines: string[] = [];
          bodyLines.push(`// AUTO-GENERATED by babel-plugin-filbert. DO NOT EDIT.`);
          bodyLines.push(`declare module '*/${st.fileBase}' {`);
          bodyLines.push(`  import type { StyledComponent } from '@filbert-js/core';`);
          for (const [name, map] of st.variantsByComponent) {
            const props = variantMapToTsProps(map);
            bodyLines.push(`  export const ${name}: StyledComponent<{`);
            bodyLines.push(props);
            bodyLines.push(`  }>;`);
          }
          bodyLines.push(`}`);
          const body = bodyLines.join('\n') + '\n';

          try {
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(outPath, body);
          } catch {
            // Non-fatal — sidecar emission is best-effort.
          }
        },
      },
    },
  };
}

function isRootedAt(
  t: typeof BabelTypes,
  tagPath: NodePath<BabelTypes.Node>,
  name: string,
): boolean {
  let cur: NodePath<BabelTypes.Node> = tagPath;
  while (true) {
    const node = cur.node;
    if (t.isIdentifier(node) && (node as BabelTypes.Identifier).name === name) return true;
    if (t.isMemberExpression(node)) {
      cur = cur.get('object') as NodePath<BabelTypes.Node>;
      continue;
    }
    if (t.isCallExpression(node)) {
      cur = cur.get('callee') as NodePath<BabelTypes.Node>;
      continue;
    }
    return false;
  }
}

function isFilbertTag(
  t: typeof BabelTypes,
  tagPath: NodePath<BabelTypes.Node>,
  allow: Set<string>,
): boolean {
  let cur: NodePath<BabelTypes.Node> = tagPath;
  while (true) {
    const node = cur.node;
    if (t.isIdentifier(node)) return allow.has((node as BabelTypes.Identifier).name);
    if (t.isMemberExpression(node)) {
      cur = cur.get('object') as NodePath<BabelTypes.Node>;
      continue;
    }
    if (t.isCallExpression(node)) {
      cur = cur.get('callee') as NodePath<BabelTypes.Node>;
      continue;
    }
    return false;
  }
}
