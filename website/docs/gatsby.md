To use `filbert-js` with `gatsbyjs`, follow below steps

1. use `@filbert-js/macro` in pages
2. use `@filbert-js/server-stylesheet` to support SSR/Client Hydration

```jsx
// @editor
// pages/app.js
import { styled } from '@filbert-js/macro';

import React from 'react';

const Box = styled.div`
  color: red;
`;
export default function App() {
  return <Box>Gatsby.js is awesome</Box>;
}
```

```js
// @editor

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

<iframe src="https://codesandbox.io/embed/github/kuldeepkeshwar/filbert-js-examples-with-gatsby/tree/master/?fontsize=14&hidenavigation=1&theme=dark"
     style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
     title="kuldeepkeshwar/filbert-js-examples-with-gatsby"
     allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
     sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
   ></iframe>

👉 Checkout [starter kit](https://github.com/kuldeepkeshwar/filbert-js-examples-with-gatsby)
