import {
  ThemeProvider,
  createGlobalStyle,
  keyframes,
  styled,
} from './css-in-js';

import React from 'react';
import logo from './logo.svg';

// Create the keyframes
const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const AppLogo = styled('img')`
  height: 40vmin;
  pointer-events: none;
  @media (prefers-reduced-motion: no-preference) {
    animation: ${rotate} infinite 20s linear;
  }
`;
const AppHeader = styled('div')`
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: white;
`;
const AppLink = styled('a')`
  color: #61dafb;
`;
const App = styled('span')`
  text-align: center;
`;
const globalCSS = `
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
`;
const Global = createGlobalStyle(globalCSS);
const theme = { font: '16px' };

function Root() {
  return (
    <ThemeProvider theme={theme}>
      <Global styles={globalCSS} />
      <App>
        <AppHeader>
          <AppLogo src={logo} className="App-logo" alt="logo" />
          <p>
            Edit <code>src/App.js</code> and save to reload.
          </p>
          <AppLink
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </AppLink>
        </AppHeader>
      </App>
    </ThemeProvider>
  );
}

export default Root;
