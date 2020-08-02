```jsx
// @live

import React from 'react';
import { styled } from '@filbert-js/core';

const Button = styled('button')`
  display: inline-block;
  outline: none;
  text-decoration: none;
  font-weight: 300;
  letter-spacing: 1px;
  border: 1px solid;
  transition: all 0.2s ease;
  box-sizing: border-box;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.01);
  border-radius: 3px;
  font-size: 0.8125em;
  padding: 0.4125em 1.25em;
  color: #4682b4;
  border-color: #4682b4;
  &:hover {
    background: #4682b4;
    color: #fff;
    border-color: #4682b4;
  }
`;

render(
  <Button as="a" target="_blank" rel="noreferrer" href="https://google.com">
    Visit Google.
  </Button>,
);
```
