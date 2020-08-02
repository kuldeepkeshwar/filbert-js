```jsx
// @live
import React from 'react';
import { styled, Global, keyframes } from '@filbert-js/core';

// Create the keyframes
const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;
/** Will rotate everything we pass in over one seconds */
const Rotate = styled('span')`
  display: flex;
  justify-content: center;
  font-size: 1.5rem;
  animation: ${rotate} 1s linear infinite;
`;

render(
  <Rotate role="img" aria-label="star">
    ⭐
  </Rotate>,
);
```
