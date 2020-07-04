import React from 'react';
import { Stack } from './Stack';
import logo from './../images/github.svg';
export function Header() {
  return (
    <Stack direction="horizontal" align="end">
      <a
        href="https://github.com/kuldeepkeshwar/filbert-js"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src={logo} alt="Github" />
      </a>
    </Stack>
  );
}
