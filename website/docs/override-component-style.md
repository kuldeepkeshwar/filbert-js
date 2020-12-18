```jsx editor=live
import React from 'react';
import { styled } from '@filbert-js/core';

const Box = styled('div')`
  background: gray;
  color: white;
  border: solid 1px gray;
  padding: 0.5rem;
`;

const BlueBox = styled(Box)`
  background: #1f368f;
`;

const Container = styled('div')`
  display: flex;
  > * + * {
    margin-left: 1rem;
  }
`;

render(
  <Container>
    <Box>I'm gray!!</Box>
    <BlueBox>I'm blue!!</BlueBox>
  </Container>,
);
```
