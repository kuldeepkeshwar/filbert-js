import LogoIcon from './../images/icons/github.svg';
import React from 'react';
import { Stack } from './Stack';
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
    </Stack>
  );
}
