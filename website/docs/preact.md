To use `filbert-js` with `preact`, all you need is `@filbert-js/macro`

```jsx
// @editor
// app.js
import { styled } from '@filbert-js/macro';

import { h } from 'preact';

const Box = styled.div`
  color: red;
`;
export default function App() {
  return <Box>Preact is awesome</Box>;
}
```

👉 Checkout [starter kit](https://github.com/kuldeepkeshwar/filbert-js-examples-with-preact)
