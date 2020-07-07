import { Global, styled } from '@filbert-js/core';

import CloseIcon from './../images/icons/close.svg';
import HamburgerIcon from './../images/icons/hamburger.svg';
import { Header } from './Header';
import React from 'react';
import { Sidebar } from './Sidebar';
import { ThemeProvider } from '@filbert-js/theming';
import { colors } from './../themes/utils';
import { tokens as lightTheme } from '../themes/light';

const Screen = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 25%) 1fr;
  grid-template-rows: 40px auto;
  grid-column-gap: 1rem;
  margin: 0 auto;
  padding: 1rem 2rem;
  width: 100%;
  max-width: 64em;
  color: ${colors(`text.body`)};
  @media screen and (max-width: 52em) {
    grid-template-columns: 1fr;
  }
`;
const Top = styled.div`
  grid-area: 1 / 1 / 2 / 3;
  @media screen and (max-width: 52em) {
    grid-area: 1 / 1 / 2 /2;
  }
`;
const Side = styled.div`
  grid-area: 2 / 1 / 3 / 1;
  @media screen and (max-width: 52em) {
    display: ${({ toggle }) => (toggle ? 'none' : 'block')};
  }
`;

const Main = styled.div`
  grid-area: 2 / 2 / 3 / 3;
  @media screen and (max-width: 52em) {
    grid-area: 2 / 1 / 2 /2;
    display: ${({ toggle }) => (toggle ? 'block' : 'none')};
  }
  background: ${colors(`app.background-color`)};
  color: ${colors(`app.color`)};
  border-color: ${colors(`app.border-color`)};
`;
const ToggleButton = styled.button`
  display: none;
  @media screen and (max-width: 52em) {
    display: block;
    position: fixed;
    bottom: 0;
    right: 0;
    border-radius: 50%;
    background-color: #3793e0;
    padding: 1rem;
    margin: 2rem;
    animation: 0.25s ease-in animation-1m49nxd;
    transition: 150ms ease-in-out background-color;
    border: 0;
  }
`;
const globalStyles = `
  @import url('https://fonts.googleapis.com/css?family=Roboto+Mono&display=swap');

  body {
    font-family: 'Inter', sans-serif;
    margin: 0;
  }
  
  * {
    box-sizing: border-box;
  }
`;
export function Layout({ children }) {
  const [toggle, setToggle] = React.useState(true);

  return (
    <ThemeProvider theme={lightTheme}>
      <Global styles={globalStyles} />
      <Screen>
        <Top>
          <Header />
        </Top>

        <Side toggle={toggle}>
          <Sidebar />
        </Side>

        <Main toggle={toggle}>{children}</Main>
      </Screen>
      <ToggleButton onClick={() => setToggle(!toggle)}>
        {toggle ? <HamburgerIcon /> : <CloseIcon />}
      </ToggleButton>
    </ThemeProvider>
  );
}
