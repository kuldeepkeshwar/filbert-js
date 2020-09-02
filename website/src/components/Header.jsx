import LogoIcon from './../images/icons/github.svg';
import React from 'react';
import { Stack } from 'layout-ui';
import TwitterIcon from './../images/icons/twitter.svg';
export function Header() {
  return (
    <Stack direction="horizontal" align="end">
      <a
        href="https://github.com/kuldeepkeshwar/filbert-js"
        target="_blank"
        rel="noopener noreferrer"
      >
        <LogoIcon />
      </a>
      <a
        href="https://twitter.com/filbert_js"
        target="_blank"
        rel="noopener noreferrer"
      >
        <TwitterIcon />
      </a>
    </Stack>
  );
}
