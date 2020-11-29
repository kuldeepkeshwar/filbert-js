import React from 'react';
import { createStylesheet } from '@filbert-js/browser-stylesheet';

// for css API
export let __sheet = createStylesheet();

export const StyleSheetContext = React.createContext(__sheet);

export const StyleSheetProvider = ({ stylesheet, children }) => {
  __sheet = stylesheet;
  return (
    <StyleSheetContext.Provider value={stylesheet}>
      {children}
    </StyleSheetContext.Provider>
  );
};
