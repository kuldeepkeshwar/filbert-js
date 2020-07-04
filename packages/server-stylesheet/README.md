# @filbert-js/server-stylesheet

> A StyleSheet for server-side rendering

## Install

```bash
yarn add @filbert-js/server-stylesheet
```

## Usage

```jsx
import { renderToString } from 'react-dom/server';
import { createStylesheet } from '@filbert-js/server-stylesheet';
import App from './App';

const sheet = createStylesheet();
const app = renderToString(sheet.collectStyles(<App />));
const styleHTML = sheet.getStyles();
// Or
// const styleTags = sheet.getReactElements(); // give React elements

const html = `
<html>
  <head>${styleHTML}</head>
  <body>
    <div id="app">${app}</div>
  </body>
</html>
`;
```

More documentation is available at https://filbert-js.vercel.app.
