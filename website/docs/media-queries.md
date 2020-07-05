```jsx
// @live

import React from 'react';
import { styled } from '@filbert-js/core';

const Paragraph = styled.p`
  color: red;
  font-size: 1rem;
  @media (min-width: 420px) {
    font-size: 3rem;
  }
`;

render(<Paragraph>I'm red !!</Paragraph>);
```
