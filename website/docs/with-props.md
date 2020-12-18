```jsx editor=live
import React from 'react';
import { styled } from '@filbert-js/core';

const Button = styled('button')`
  background: ${({ primary }) => (primary ? '#1f368f' : 'white')};
  color: ${({ primary }) => (primary ? 'white' : '#1f368f')};
  border: solid 1px gray;
`;
const Container = styled('div')`
  display: flex;
  > * + * {
    margin-left: 1rem;
  }
`;

render(
  <Container>
    <Button>This is regular Button.</Button>
    <Button primary={true}>This is Primary Button.</Button>
  </Container>,
);
```
