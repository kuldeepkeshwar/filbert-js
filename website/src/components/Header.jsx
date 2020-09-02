import LogoIcon from './../images/icons/github.svg';
import React from 'react';
import { Stack } from 'layout-ui';
import TwitterIcon from './../images/icons/twitter.svg';
import { styled } from '@filbert-js/core';

const Link = styled.a`
  display: inline-flex;
  align-items: center;
`;

export function Header() {
  return (
    <Stack direction="horizontal" align="end" gap="1rem">
      <Link
        href="https://github.com/kuldeepkeshwar/filbert-js"
        target="_blank"
        rel="noopener noreferrer"
      >
        <LogoIcon />
      </Link>
      <Link
        href="https://twitter.com/filbert_js"
        target="_blank"
        rel="noopener noreferrer"
      >
        <TwitterIcon />
      </Link>
    </Stack>
  );
}
