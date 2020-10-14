```jsx editor=live
import React from 'react';
import { styled } from '@filbert-js/core';

const Text = ({ className }) => <p className={className}>Some text</p>;

const PinkText = styled(Text)`
  color: hotpink;
`;
render(<PinkText />);
```
