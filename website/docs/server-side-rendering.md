### Vanilla: Server-Side Rendering

```js editor=static
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

### Next.js: Server-Side Rendering

In `Next.js` world, create a file `pages/_document.js`

```js editor=static
// pages/_document.js

import Document from 'next/document';
import { createStylesheet } from '@filbert-js/server-stylesheet';

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const sheet = createStylesheet();
    const originalRenderPage = ctx.renderPage;
    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => {
            return (props) => {
              return sheet.collectStyles(<App {...props} />);
            };
          },
        });
      const initialProps = await Document.getInitialProps(ctx);

      const styleTags = sheet.getReactElements();
      return {
        ...initialProps,
        styles: (
          <>
            {styleTags}
            {initialProps.styles}
          </>
        ),
      };
    } finally {
    }
  }
}

export default MyDocument;
```

Check out [official nextjs example](https://github.com/vercel/next.js/tree/canary/examples/with-filbert)

### Gatsby.js: Server-Side Rendering

In `Gatsby.js` world, create a file `gatsby-ssr.js`

```js editor=static
// gatsby-ssr.js
import { createStylesheet } from '@filbert-js/server-stylesheet';

const sheetByPathname = new Map();

export const wrapRootElement = ({ element, pathname }) => {
  const sheet = createStylesheet();
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
```

Or

Directly use [gatsby-plugin-filbert](https://github.com/kuldeepkeshwar/filbert-js/tree/master/packages/gatsby-plugin-filbert)
