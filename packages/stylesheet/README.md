# @filbert-js/stylesheet

> A StyleSheet for css-in-js libraries

## Install

```bash
yarn add @filbert-js/stylesheet
```

## Usage

```jsx editor=static
import React from 'react';
import { StyleSheet } from '@filbert-js/stylesheet';
import { StyleSheetProvider } from '@filbert-js/style-sheet-context';

const stylesheet = new StyleSheet({
  getRoot,
  createElement,
  findElementByStyleId,
  cssParser,
});
render(
  <StyleSheetProvider stylesheet={stylesheet}>
    <App />
  </StyleSheetProvider>,
);
```

More documentation is available at https://filbert-js.vercel.app.
