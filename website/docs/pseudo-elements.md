```jsx editor=live
import React from 'react';
import { styled } from '@filbert-js/core';

const Card = styled('div')`
  border: solid 2px gray;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.5rem;
  &:hover {
    background: gray;
  }
  &::before {
    content: '';
    display: block;
    height: 1rem;
    width: 1rem;
    border-radius: 50%;
    background: hotpink;
  }
`;

render(<Card>Hover over me!!</Card>);
```
