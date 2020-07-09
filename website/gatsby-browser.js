/**
 * Implement Gatsby's Browser APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/browser-apis/
 */

import { Layout } from './src/components/Layout';
// You can delete this file if you're not using it
import React from 'react';
import { StyleSheetProvider } from '@filbert-js/style-sheet-context';
import { createParser } from '@filbert-js/css-parser';
import { createStylesheet } from '@filbert-js/browser-stylesheet';
import { prefix } from '@filbert-js/autoprefixer';
const cssParser = createParser({ prefix });
const stylesheet = createStylesheet({ cssParser });
export const wrapRootElement = ({ element, props }) => {
  return (
    <StyleSheetProvider stylesheet={stylesheet}>{element}</StyleSheetProvider>
  );
};
export const wrapPageElement = ({ element, props }) => {
  return <Layout {...props}>{element}</Layout>;
};
