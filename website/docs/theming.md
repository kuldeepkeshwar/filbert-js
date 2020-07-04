```jsx
// @live

import React from "react"
import { styled, ThemeProvider } from "@filbert-js/core"

const Button = styled.button`
  background: ${({ theme }) => theme.colors.brand};
  border: solid 1px grey;
`
const theme = {
  colors: {
    brand: "hotpink"
  }
}
render(
  <ThemeProvider theme={theme}>
    <Button>This is a Button component.</Button>
  </ThemeProvider>
)
```
