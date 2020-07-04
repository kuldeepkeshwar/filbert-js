`@filbert-js` generates dynamic class name for the styling. Sometimes, we may want more readable class name.

`@filbert-js` allows labeling components

```jsx
// @live
import React from "react"
import { styled } from "@filbert-js/core"

const Base = ({ className }) => <div className={className}>{className}</div>

const Box = styled(Base)`
  background: grey;
  color: white;
  border: solid 1px gray;
  padding: 0.5rem;
`
const BlueBox = styled(Base, { label: "BlueBox" })`
  background: #1f368f;
  color: white;
  border: solid 1px gray;
  padding: 0.5rem;
`

const Container = styled.div`
  display: flex;
  > * + * {
    margin-left: 1rem;
  }
`

render(
  <Container>
    <Box />
    <BlueBox />
  </Container>
)
```
