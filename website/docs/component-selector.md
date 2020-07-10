```jsx
// @live

import React from 'react';
import { styled } from '@filbert-js/core';

const Button = styled('button')`
  margin: 0 1rem;
  background: #1f368f;
  color: white;
  border: none;
  outline: none;
`;
const Paragraph = styled('p')`
  color: grey;
  ${Button} {
    color: #1f368f;
    background: white;
  }
`;

render(
  <React.Fragment>
    <Button>A button</Button>
    <Paragraph>
      I'm grey!!
      <Button>I'm inside paragraph</Button>
    </Paragraph>
  </React.Fragment>,
);
```
