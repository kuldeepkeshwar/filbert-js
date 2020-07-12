```jsx
// @live
/* This comment tells babel to convert jsx to calls 
to a function called jsx instead of React.createElement*/
/** @jsx jsx */
import React from 'react';
import { css, jsx } from '@filbert-js/core';

const styles = css`
  background: pink;
  border: solid 1px grey;
`;

render(<button css={styles}>This is a Button component.</button>);
```
