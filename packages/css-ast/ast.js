import {
  CLOSE_BRACKET,
  OPEN_BRACKET,
  RULE_END,
  RULE_SEPARATOR,
} from './constants';

function Node({
  children = [],
  rules = [],
  start = -1,
  end = -1,
  raw,
  parent,
}) {
  this.children = children;
  this.rules = rules;
  this.start = start;
  this.end = end;
  this.raw = raw;
  this.raw_selector = undefined;
  this.parent = parent;
}
const holeRegex = /(url\(|"|').*?(\)|"|')/g;
// put holes for urls/string-with-quotes
function handleCSSValues(str) {
  let a;
  const holes = {};
  let i = 0;
  while ((a = holeRegex.exec(str)) !== null) {
    const hole = `_${++i}_`;
    const [val] = a;
    str = str.replace(val, hole);
    holes[hole] = val.toString();
  }
  return [str, holes];
}
export function toAST(raw) {
  const root = new Node({
    start: 0,
    end: raw.length - 1,
    raw: raw,
  });

  let current = root;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === OPEN_BRACKET) {
      const b = new Node({ start: i, parent: current });
      current.children.push(b);
      current = b;
    }
    if (raw[i] === CLOSE_BRACKET) {
      const b = current;
      b.end = i;
      b.raw = raw.substring(b.start + 1, b.end);
      current = b.parent;
      buildRules(b, raw);
    }
  }
  buildRules(current, raw);
  return root;
}

function buildRules(block, raw) {
  const childSeparator = `$_${Date.now()}`;
  let blockStr = block.raw;
  let holes;
  // remove sub blocks
  block.children.forEach((child, index) => {
    const childStr = raw.substring(child.start, child.end + 1);
    blockStr = blockStr.replace(
      childStr,
      `${childSeparator}${index}${RULE_END}`,
    );
  });
  [blockStr, holes] = handleCSSValues(blockStr);
  // split rules
  const rules = blockStr.split(RULE_END).reduce((agg, ruleStr) => {
    if (!ruleStr.trim()) {
      return agg;
    }
    if (ruleStr.indexOf(childSeparator) === -1) {
      // split only property name, combine back value(s)
      let [name, value] = ruleStr.split(RULE_SEPARATOR);
      name = name.trim();
      value = value.trim();
      agg.push({
        name: name.trim(),
        value: typeof holes[value] != 'undefined' ? holes[value] : value,
      });
    } else {
      const [raw_selector, childIndex] = ruleStr.split(childSeparator);
      block.children[childIndex].raw_selector = raw_selector.trim();
      blockStr = blockStr.replace(`${ruleStr}${RULE_END}`, '');
    }
    return agg;
  }, []);
  block.rules = rules;
}
