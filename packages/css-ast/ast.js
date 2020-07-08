import {
  CLOSE_BRACKET,
  OPEN_BRACKET,
  RULE_END,
  RULE_SEPARATOR,
} from './constants';

const childSeparator = `$_${Date.now()}`;

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
  this.raw_selector = null;
  this.parent = parent;
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
  let blockStr = block.raw;
  block.children.forEach((child, index) => {
    const childStr = raw.substring(child.start, child.end + 1);
    blockStr = blockStr.replace(
      childStr,
      `${childSeparator}${index}${RULE_END}`,
    );
  });
  const rules = blockStr.split(RULE_END).reduce((agg, ruleStr) => {
    if (!ruleStr.trim()) {
      return agg;
    }
    if (ruleStr.indexOf(childSeparator) === -1) {
      const [name, value] = ruleStr.split(RULE_SEPARATOR);
      agg.push({ name: name.trim(), value: value.trim() });
    } else {
      const [raw_selector, childIndex] = ruleStr.split(childSeparator);
      block.children[childIndex].raw_selector = raw_selector.trim();
      blockStr = blockStr.replace(`${ruleStr}${RULE_END}`, '');
    }
    return agg;
  }, []);
  block.rules = rules;
}
