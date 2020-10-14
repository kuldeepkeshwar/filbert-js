# @filbert-js/theming

> theming for filbert-js

## Install

```bash
yarn add @filbert-js/theming
```

## Usage

```jsx editor=static
import React from 'react';
import { styled } from '@filbert-js/core';
import { ThemeProvider } from '@filbert-js/theming';
const Button = styled('button')`
  background: ${({ theme }) => theme.colors.brand};
  border: solid 1px grey;
`;
const theme = {
  colors: {
    brand: 'hotpink',
  },
};
render(
  <ThemeProvider theme={theme}>
    <Button>This is a Button component.</Button>
  </ThemeProvider>,
);
```

More documentation is available at https://filbert-js.vercel.app.
