# @filbert-js/macro

A [Babel](https://babeljs.io/) macro for filbert, converts `styled.div` syntax to `styled('div')` calls.

## Install

`npm install --save @filbert-js/macro`

## How to use

```jsx editor=static
import React from 'react';
import { styled } from '@filbert-js/macro';

const Button = styled.button`
  margin: 0;
  padding: 1rem;
  font-size: 1rem;
  background-color: tomato;
`;
```
