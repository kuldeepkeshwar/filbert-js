# @filbert-js/browser-stylesheet

> Browser StyleSheet for filbert-js

## Install

```bash
yarn add @filbert-js/browser-stylesheet
```

## Usage

```jsx
import { createStylesheet } from '@filbert-js/browser-stylesheet';
import { StyleSheetProvider } from '@filbert-js/core';
import App from './App';

const stylesheet = createStylesheet();

<StyleSheetProvider stylesheet={stylesheet}>
  <App />
</StyleSheetProvider>;
```

More documentation is available at https://filbert-js-js.sh.
