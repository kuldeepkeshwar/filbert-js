To use `filbert-js` with `next.js`, follow below steps

1. use `@filbert-js/macro` in pages
2. use `@filbert-js/server-stylesheet` to support SSR/Client Hydration

```jsx
// @editor
// app.js
import { styled } from '@filbert-js/macro';

import React from 'react';

const Box = styled.div`
  color: red;
`;
export default function App() {
  return <Box>Next.js is awesome</Box>;
}
```

```js
// @editor
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

<iframe src="https://codesandbox.io/embed/github/kuldeepkeshwar/filbert-js-examples-with-nextjs/tree/master/?fontsize=14&hidenavigation=1&theme=dark"
     style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
     title="kuldeepkeshwar/filbert-js-examples-with-nextjs"
     allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
     sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
   ></iframe>

👉 Checkout [starter kit](https://github.com/kuldeepkeshwar/filbert-js-examples-with-nextjs)
