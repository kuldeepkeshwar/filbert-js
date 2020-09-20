import LogoIcon from './../images/icons/github.svg';
import React from 'react';
import { Stack } from 'layout-ui';
import TwitterIcon from './../images/icons/twitter.svg';
import ThemeIcon from './../images/icons/theme.svg';
import { styled } from '@filbert-js/core';
import { colors } from './../themes/utils';

const Link = styled.a`
  display: inline-flex;
  align-items: center;
  color: ${colors(`app.color`)};
`;

export function Header(props) {

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
      <Link
        onClick={props.toggleTheme}
        rel="noopener noreferrer"
      >
        <ThemeIcon />
      </Link>
    </Stack>
  );
}
