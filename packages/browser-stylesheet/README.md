# @filbert-js/browser-stylesheet

> Browser StyleSheet for filbert-js

## Install

```bash
yarn add @filbert-js/browser-stylesheet
```

## Usage

```jsx
// @editor

import { createStylesheet } from '@filbert-js/browser-stylesheet';
import { StyleSheetProvider } from '@filbert-js/style-sheet-context';
import App from './App';

const stylesheet = createStylesheet();

<StyleSheetProvider stylesheet={stylesheet}>
  <App />
</StyleSheetProvider>;
```

More documentation is available at https://filbert-js.vercel.app.
