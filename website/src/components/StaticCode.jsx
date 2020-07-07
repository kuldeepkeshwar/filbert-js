import { LiveError, LivePreview, LiveProvider } from 'react-live';

import { Editor } from './Editor';
import React from 'react';
import { Stack } from './Stack';

export default ({ code, compiled }) => {
  return (
    <Stack direction="vertical" gap="1rem">
      <Editor code={code} />
    </Stack>
  );
};
