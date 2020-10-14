const visit = require('unist-util-visit');
const escapeGoat = require('escape-goat');
const Babel = require('babel-standalone');
const livePattern = /editor=live/;

module.exports = (options) => {
  function transformer(tree) {
    visit(tree, `code`, (node, index, parent) => {
      if (node.lang === 'jsx' || node.lang === 'js') {
        if (livePattern.test(node.meta)) {
          const code = node.value;
          const compiled = Babel.transform(code, {
            presets: ['es2015', 'react', 'stage-1'],
          }).code;
          node.meta = `${node.meta} compiled=${compiled}`;
          node.value = code;
        }
      }
    });
  }
  return transformer;
};
