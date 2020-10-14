```jsx editor=live
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

Or you can use `@filbert-js/macro`

```jsx editor=static
import React from 'react';
import { css } from '@filbert-js/macro';

const styles = css`
  background: pink;
  border: solid 1px grey;
`;

render(<button css={styles}>This is a Button component.</button>);
```

Or you can use `@filbert-js/core` along with `babel-plugin-filbert`

```jsx editor=static
import React from 'react';
import { css } from '@filbert-js/core';

const styles = css`
  background: pink;
  border: solid 1px grey;
`;

render(<button css={styles}>This is a Button component.</button>);
```

> Pragma annotation (`/*@jsx jsx*/`) is not required when using `babel-plugin-filbert` or `@filbert-js/macro`

Check out example

[![Edit kuldeepkeshwar/filbert-js-examples-with-cra](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/kuldeepkeshwar/filbert-js-examples-with-cra/tree/master/?fontsize=14&hidenavigation=1&theme=dark)
