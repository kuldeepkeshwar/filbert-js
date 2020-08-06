const visit = require('unist-util-visit');
const escapeGoat = require('escape-goat');
const Babel = require('babel-standalone');
const livePattern = /^\s*\/\/ @live/;
const editorPattern = /^\s*\/\/ @editor/;

module.exports = ({ markdownAST }) => {
  visit(markdownAST, `code`, (node) => {
    if (node.lang === 'jsx' || node.lang === 'js') {
      if (livePattern.test(node.value)) {
        const cleanValue = node.value.replace('// @live', '').trim();
        node.type = `html`;
        node.value = escapeGoat.escapeTag`<live-code code="${cleanValue}" compiled="${
          Babel.transform(cleanValue, {
            presets: ['es2015', 'react', 'stage-1'],
          }).code
        }"></live-code>`;
      } else if (editorPattern.test(node.value)) {
        node.type = `html`;
        const cleanValue = node.value.replace('// @editor', '').trim();
        node.value = escapeGoat.escapeTag`<static-code code="${cleanValue}"></static-code>`;
      }
    }
  });
};
