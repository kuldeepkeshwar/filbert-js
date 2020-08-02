Use nested selectors to target elements inside the current class or React component. An example with an element selector is shown below.

```jsx
// @live

import React from 'react';
import { styled } from '@filbert-js/core';

const Paragraph = styled('p')`
  color: grey;
  button {
    margin: 0 1rem;
    background: #1f368f;
    color: white;
  }
`;

render(
  <Paragraph>
    I'm grey!!
    <button>A button</button>
  </Paragraph>,
);
```

Use `&` to select the current class nested in another element:

```jsx
// @live

import React from 'react';
import { styled } from '@filbert-js/core';

const Paragraph = styled('p')`
  color: grey;
  header & {
    color: red;
  }
`;

render(
  <div>
    <header>
      <Paragraph>I'm red !!</Paragraph>
    </header>
    <Paragraph>I'm grey !!</Paragraph>
  </div>,
);
```
