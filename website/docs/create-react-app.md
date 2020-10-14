To use `filbert-js` with `Create React App(CRA)`, all you need is `@filbert-js/macro`

```jsx editor=static
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

<iframe src="https://codesandbox.io/embed/github/kuldeepkeshwar/filbert-js-examples-with-cra/tree/master/?fontsize=14&hidenavigation=1&theme=dark"
     style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
     title="kuldeepkeshwar/filbert-js-examples-with-cra"
     allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
     sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
   ></iframe>

👉 Checkout [starter kit](https://github.com/kuldeepkeshwar/filbert-js-examples-with-cra)
