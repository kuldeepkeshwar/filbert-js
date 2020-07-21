const { createMacro } = require('babel-plugin-macros');
const { addNamed } = require('@babel/helper-module-imports');

const source = '@filbert-js/core';
const name = 'styled';

function filbertMacro({ references, babel, state }) {
  const program = state.file.path;

  Object.keys(references).forEach((refName) => {
    const id = addNamed(program, refName, source);
    references[refName].forEach((referencePath) => {
      referencePath.node.name = id.name;
    });
  });

  const t = babel.types;

  const namedReferences = references[name] || [];

  namedReferences.forEach((referencePath) => {
    const path = referencePath.parentPath;
    const type = path.type;
    const node = path.node;
    if (type === 'MemberExpression') {
      const functionName = node.object.name;
      let elementName = node.property.name;

      // Support custom elements
      if (/[A-Z]/.test(elementName)) {
        elementName = elementName.replace(/[A-Z]/g, '-$&').toLowerCase();
      }

      path.replaceWith(
        t.callExpression(t.identifier(functionName), [
          t.stringLiteral(elementName),
        ]),
      );
    }
  });
}
module.exports = createMacro(filbertMacro);
