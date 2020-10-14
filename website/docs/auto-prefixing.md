```js editor=static
import React from 'react';
import ReactDOM from 'react-dom';
import { StyleSheetProvider } from '@filbert-js/style-sheet-context';
import { createParser } from '@filbert-js/css-parser';
import { createStylesheet } from '@filbert-js/browser-stylesheet';
import { prefix } from '@filbert-js/autoprefixer';
import { App } from './App';
import ReactDOM from 'react-dom';

const cssParser = createParser({ prefix });
const stylesheet = createStylesheet({ cssParser });

ReactDOM.render(
  <React.StrictMode>
    <StyleSheetProvider stylesheet={stylesheet}>
      <App />
    </StyleSheetProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);
```
