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
const tags = ['css', 'keyframes'];
module.exports = function({ types: t }, options = {}) {
  const name = options.name || 'styled';
  // Enable pure by default if it is not set by the user
  const pure = !('pure' in options) ? true : options.pure;
  return {
    name: 'transform-filbert',
    visitor: {
      TaggedTemplateExpression(path, state) {
        if (
          t.isIdentifier(path.node.tag) &&
          tags.includes(path.node.tag.name)
        ) {
          pure && prependPureComment(path.node);
        } else if (
          t.isIdentifier(path.node.tag.callee) &&
          path.node.tag.callee.name === name
        ) {
          pure && prependPureComment(path.node);
        }
      },
      MemberExpression: {
        exit(path) {
          const node = path.node;
          if (!t.isIdentifier(node.object) || node.object.name !== name) {
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
