import { Global, ThemeProvider, styled } from '@filbert-js/core';

import { Header } from './Header';
import { Helmet } from 'react-helmet';
import React from 'react';
import { Sidebar } from './Sidebar';
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
`;
const Side = styled.div`
  grid-area: 2 / 1 / 3 / 1;
`;
const Top = styled.div`
  grid-area: 1 / 1 / 2 / 3;
`;
const Main = styled.div`
  grid-area: 2 / 2 / 3 / 3;
  background: ${colors(`app.background-color`)};
  color: ${colors(`app.color`)};
  border-color: ${colors(`app.border-color`)};
`;
const globalStyles = `
  @import url('https://rsms.me/inter/inter.css');
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
  return (
    <ThemeProvider theme={lightTheme}>
      <Helmet>
        <meta charSet="utf-8" />
        <title>Filbert js</title>
        <link rel="canonical" href="https://filbert-js.vercel.app" />
      </Helmet>
      <Global styles={globalStyles} />
      <Screen>
        <Top>
          <Header />
        </Top>
        <Side>
          <Sidebar />
        </Side>
        <Main>{children}</Main>
      </Screen>
    </ThemeProvider>
  );
}
