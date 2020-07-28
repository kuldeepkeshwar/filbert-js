import { LiveError, LivePreview, LiveProvider } from 'react-live';

import { Editor } from './Editor';
import React from 'react';
import { Stack } from 'layout-ui';
import { styled } from '@filbert-js/core';

export const scope = {
  process: {
    env: {
      NODE_ENV: process.env.NODE_ENV,
    },
  },
  require(moduleName) {
    switch (moduleName) {
      case 'react':
        return React;
      case '@filbert-js/core':
        return require('@filbert-js/core');
      case '@filbert-js/theming':
        return require('@filbert-js/theming');

      default:
        // eslint-disable-next-line no-throw-literal
        throw `Module "${moduleName}" not found`;
    }
  },
};

const Preview = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;
export default ({ code, compiled }) => {
  return (
    <Stack direction="vertical" gap="1rem">
      <Preview>
        <LiveProvider code={compiled} scope={scope} noInline>
          <LivePreview />
          <LiveError />
        </LiveProvider>
      </Preview>
      <Editor code={code} />
    </Stack>
  );
};
