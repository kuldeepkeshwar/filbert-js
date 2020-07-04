# @filbert-js/core

> A light weight(~1KB) css-in-js solution(framework)🎨.

## Install

```bash
yarn add @filbert-js/core
```

## Usage

```jsx
import React from 'react';
import { styled, Global } from '@filbert-js/core';

const Button = styled.button`
  background: pink;
  border: solid 1px grey;
`;

render(
  <>
    <Button>This is a Button component.</Button>
    <Global
      styles={`
          .text {
            background: hotpink;
            padding: 1rem;
          }
        `}
    />
    <div className="text">I'm pink</div>
  </>,
);
```

More documentation is available at https://filbert-js.vercel.app.
