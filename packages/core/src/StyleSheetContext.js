import React from 'react';
import { createStylesheet } from '@filbert-js/browser-stylesheet';
const stylesheet = createStylesheet();
export const StyleSheetContext = React.createContext(stylesheet);

export const StyleSheetProvider = ({ stylesheet, children }) => {
  return (
    <StyleSheetContext.Provider value={stylesheet}>
      {children}
    </StyleSheetContext.Provider>
  );
};
