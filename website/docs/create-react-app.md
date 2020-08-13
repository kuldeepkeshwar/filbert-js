To use `filbert-js` with `Create React App(CRA)`, all you need is `@filbert-js/macro`

```jsx
// @editor
// app.js
import { styled } from '@filbert-js/macro';

import React from 'react';

const Box = styled.div`
  color: red;
`;
export default function App() {
  return <Box>React JS is awesome</Box>;
}
```

👉 Checkout [starter kit](https://github.com/kuldeepkeshwar/filbert-js-examples-with-cra)
