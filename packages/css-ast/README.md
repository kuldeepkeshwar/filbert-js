# @filbert-js/css-ast

> CSS to AST transformer for filbert-js.

## Install

```bash
yarn add @filbert-js/css-ast
```

```js
// @editor
import { toAST } from '@filbert-js/css-ast';

const css = `
color: grey;
button {
    margin: 0 1rem;
    background: #1f368f;
    color: white;
    span {
        color: red;
    }
}
button,span {
    color: pink;
}
`;
const ast = toAST(css);
console.log(ast);
/**  
children: Array[2]
    0: Node
    1: Node
rules: Array[1]
    0: Object
name: "color"
value: "grey"
start: 0
end: 168
raw: "
  color: grey;
  button {
    margin: 0 1rem;
    background: #1f368f;
    color: white;
    span {
      color: red;
    }
  }
  button,
  span {
    color: pink;
  }
"
* */
```

More documentation is available at https://filbert-js.vercel.app.
