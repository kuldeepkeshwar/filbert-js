import {
  CLOSE_BRACKET,
  OPEN_BRACKET,
  RULE_END,
  RULE_SEPARATOR,
  toAST,
} from '@filbert-js/css-ast';

const isMediaQuery = /@media/;
const isPseudoSelector = /&:/;

export function cssParser(raw, hash) {
  const root = toAST(raw);
  const scope = `.${hash}`;
  return nodeToStyleBlock({
    node: root,
    selector: scope,
    scope,
  });
}
function nodeToStyleBlock({ node, selector, scope }) {
  // build style string for rules
  const ruleBlock = rulesToStyleBlock(node.rules, selector);
  // process children
  const childrenBlock = node.children
    .map((child) => {
      // TODO: add support for @import,@font-face
      if (isMediaQuery.test(child.raw_selector)) {
        // handle media query
        const block = nodeToStyleBlock({ node: child, selector, scope });
        return `${child.raw_selector}${OPEN_BRACKET}${block}${CLOSE_BRACKET}`;
      }
      const selectors = child.raw_selector.split(',');
      const _selectors = selectors
        .map((s) => {
          if (isPseudoSelector.test(s)) {
            // handle pseudo selectors
            return s.replace(/&/g, scope);
          } else if (s.includes('&')) {
            // a case of nested selector(self ref) e.g header & {...} -> header <class-name> {...}
            return s.replace(/&/g, scope);
          } else {
            // scope the child selector with self e.g p {...} -> <class-name> p {...}
            return `${selector} ${s}`;
          }
        })
        .join(',');
      return nodeToStyleBlock({ node: child, selector: _selectors, scope });
    })
    .join(' ');
  return `${ruleBlock} ${childrenBlock}`.trim();
}
function rulesToStyleBlock(rules, selector) {
  const rulesSTR = rules.reduce((agg, rule) => {
    return `${agg}${rule.name}${RULE_SEPARATOR}${rule.value}${RULE_END}`;
  }, '');
  const selectorBlock = `${selector}${OPEN_BRACKET}${rulesSTR}${CLOSE_BRACKET}`;
  return selectorBlock;
}
