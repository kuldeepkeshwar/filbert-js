/**
 * Implement Gatsby's SSR (Server Side Rendering) APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/ssr-apis/
 */

// You can delete this file if you're not using it

import { createParser } from '@filbert-js/css-parser';
import { createStylesheet } from '@filbert-js/server-stylesheet';
import { prefix } from '@filbert-js/autoprefixer';

const cssParser = createParser({ prefix });
const sheetByPathname = new Map();

export const wrapRootElement = ({ element, pathname }) => {
  const sheet = createStylesheet({ cssParser });
  sheetByPathname.set(pathname, sheet);
  return sheet.collectStyles(element);
};

export const onRenderBody = ({ setHeadComponents, pathname }) => {
  const sheet = sheetByPathname.get(pathname);
  if (sheet) {
    const styleTags = sheet.getReactElements();
    setHeadComponents(styleTags);
    sheetByPathname.delete(pathname);
  }
};
