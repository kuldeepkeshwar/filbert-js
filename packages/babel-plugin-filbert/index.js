const babelPluginReactJSX = require('@babel/plugin-transform-react-jsx')
  .default;
/**
 * Prepend #__PURE__ comment to help minifiers with
 * dead code elminiation (=DCE)
 * thanks to @marvinhagemeister / @cristianbote
 */
function prependPureComment(node) {
  const comments = node.leadingComments || (node.leadingComments = []);
  comments.push({
    type: 'CommentBlock',
    value: '#__PURE__',
  });
}
const findLast = (arr, predicate) => {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) {
      return arr[i];
    }
  }
};

function addPragmaImport(path, t, pragmaOptions) {
  const importDeclaration = t.importDeclaration(
    [
      t.importSpecifier(
        t.identifier(pragmaOptions.import),
        t.identifier(pragmaOptions.export),
      ),
    ],
    t.stringLiteral(pragmaOptions.module),
  );
  const targetPath = findLast(path.get('body'), (p) => p.isImportDeclaration());

  if (targetPath) {
    targetPath.insertAfter([importDeclaration]);
  } else {
    // Apparently it's now safe to do this even if Program begins with directives.
    path.unshiftContainer('body', importDeclaration);
  }
}
const imports = { styled: 'styled', css: 'css', keyframes: 'keyframes' };
const pragmaOptions = {
  import: 'jsx',
  export: 'jsx',
  module: '@filbert-js/core',
};
function extractPragmaOptions(state) {
  const [reactjsxPlugin] = state.file.opts.plugins.filter(
    (p) => p.key === 'transform-react-jsx',
  );
  if (reactjsxPlugin && reactjsxPlugin.options) {
    return { ...reactjsxPlugin.options, pragma: pragmaOptions.import };
  } else {
    return { pragma: pragmaOptions.import, pragmaFrag: 'React.Fragment' };
  }
}
module.exports = function (babel, options = {}) {
  const { types: t } = babel;
  const _imports = { ...imports, ...options.imports };
  // Enable pure by default if it is not set by the user
  const pure = !('pure' in options) ? true : options.pure;
  const importSpecifiers = Object.values(_imports);
  return {
    name: 'transform-filbert',
    visitor: {
      Program: {
        exit: function (path, state) {
          if (state.pragmaDetected) {
            addPragmaImport(path, t, pragmaOptions);
            babel.traverse(
              path.parent,
              babelPluginReactJSX(babel, extractPragmaOptions(state)).visitor,
              undefined,
              state,
            );
          }
        },
      },
      JSXAttribute: function (path, state) {
        if (path.node.name.name === 'css') {
          state.pragmaDetected = true;
        }
      },
      TaggedTemplateExpression(path, state) {
        if (
          t.isIdentifier(path.node.tag) &&
          importSpecifiers.includes(path.node.tag.name)
        ) {
          pure && prependPureComment(path.node);
        } else if (
          t.isIdentifier(path.node.tag.callee) &&
          importSpecifiers.includes(path.node.tag.callee.name)
        ) {
          pure && prependPureComment(path.node);
        }
      },
      MemberExpression: {
        exit(path) {
          const node = path.node;

          if (
            !t.isIdentifier(node.object) ||
            !importSpecifiers.includes(node.object.name)
          ) {
            return;
          }
          pure && prependPureComment(path.node);
          let property = node.property;
          if (t.isIdentifier(property)) {
            property = t.stringLiteral(property.name);
          }

          if (/[A-Z]/.test(property.value)) {
            property.value = property.value
              .replace(/[A-Z]/g, '-$&')
              .toLowerCase();
          }

          path.replaceWith(t.callExpression(node.object, [property]));
        },
      },
    },
  };
};
