const { createMacro } = require('babel-plugin-macros');
const { addNamed } = require('@babel/helper-module-imports');

const babelPlugin = require('babel-plugin-filbert');

const source = '@filbert-js/core';

function filbertMacro({ references, babel, state }) {
  const program = state.file.path;

  const imports = {};

  Object.keys(references).forEach((refName) => {
    const id = addNamed(program, refName, source, { nameHint: refName });

    imports[refName] = id.name;
    references[refName].forEach((referencePath) => {
      referencePath.node.name = id.name;
    });
  });

  babel.traverse(
    program.parent,
    babelPlugin(babel, { imports }).visitor,
    undefined,
    state,
  );
}
module.exports = createMacro(filbertMacro);
