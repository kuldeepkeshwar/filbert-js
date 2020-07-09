import { Global, styled } from '@filbert-js/core';

import React from 'react';

const Text = styled('div')`
  color: hotpink;
`;
export default function Home() {
  return (
    <>
      <Global
        styles={`
          html,
          body {
            padding: 0;
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto,
              Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue,
              sans-serif;
          }
  
          * {
            box-sizing: border-box;
          }
          
        `}
      />
      <h1 className="styled-title">
        Welcome to <a href="https://nextjs.org">Next.js!</a>
      </h1>

      <Text>Next JS is awesome</Text>
      <Global
        styles={`
          .styled-title{
            color:red;
          }
        `}
      />
    </>
  );
}
