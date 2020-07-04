```jsx
// @live
import React from "react"
import { Global } from "@filbert-js/core"

render(
  <React.Fragment>
    <Global
      styles={`
          .text {
            background: hotpink;
            padding: 1rem;
          }
        `}
    />
    <div className="text">I'm pink</div>
  </React.Fragment>
)
```
