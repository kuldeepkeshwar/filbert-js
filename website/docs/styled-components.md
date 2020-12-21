---
title: 'Styled Components'
---

`styled` is a way to create React components that have styles attached to them

```jsx editor=live
import React from 'react';
import { styled } from '@filbert-js/core';

const Button = styled('button')`
  background: pink;
  border: solid 1px gray;
`;

render(<Button>This is a Button component.</Button>);
```
