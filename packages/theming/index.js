import React from 'react';

export const ThemeContext = React.createContext();

export const ThemeProvider = ({ theme, children }) => {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};
