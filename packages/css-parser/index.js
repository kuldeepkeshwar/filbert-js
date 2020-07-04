export function cssParser(_styleBlock, hash) {
  // const _styleBlock = styleblock.replace(/&:/g, "." + hash);
  const subBlocks = extractSubBlocks(_styleBlock);
  let subBlocksStyles = ``;
  let styleWithoutSubBlocks = subBlocks.reduce((previous, block) => {
    const [before, ...after] = previous.split(block);
    const rules = before.split(';');
    let selector = rules.pop().trim();
    if (selector.startsWith('&:')) {
      // pseudo selector/element case
      selector = selector.replace(/&/g, '.' + hash);
    } else {
      const parts = selector.split(',');
      const _parts = parts.map((part) => {
        if (part.includes('&')) {
          // a case of nested selector(self ref) e.g header & {...} -> header <class-name> {...}
          return part.replace(/&/g, '.' + hash);
        } else {
          // scope the child selector with self e.g p {...} -> <class-name> p {...}
          return `.${hash} ${part}`;
        }
      });
      selector = _parts.join();
    }
    const _before = rules.map((rule) => `${rule};`).join('');
    subBlocksStyles = `${subBlocksStyles} ${selector}${block}`;
    return `${_before}${after.join('')}`;
  }, _styleBlock);
  styleWithoutSubBlocks = styleWithoutSubBlocks.replace(/&/g, '.' + hash);
  const classBlock = `.${hash}{${styleWithoutSubBlocks.trim()}} ${subBlocksStyles}`;
  return classBlock.trim();
}
function extractSubBlocks(styleBlock) {
  const subBlocks = [];
  const rxp = /{([^}]+)}/g;
  let curMatch;
  while ((curMatch = rxp.exec(styleBlock))) {
    subBlocks.push(curMatch[0]);
  }
  return subBlocks;
}
