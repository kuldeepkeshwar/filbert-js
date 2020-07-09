# babel-plugin-filbert

A [Babel](https://babeljs.io/) plugin for filbert, converts `styled.div` syntax to `styled('div')` calls.

## Install

`npm install --save babel-plugin-filbert`

## How to use

Edit `.babelrc.json`

```json
// @editor
{
  "presets": [...],
  "plugins": ["babel-plugin-filbert"]
}
```

And now you can create your components using `styled.*` syntax:

```jsx
// @editor

import React from 'react';
import { styled } from 'filbert';

const Button = styled.button`
  margin: 0;
  padding: 1rem;
  font-size: 1rem;
  background-color: tomato;
`;
```
