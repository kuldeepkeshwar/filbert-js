'use client';

import React from 'react';

// A theme can be any user-defined shape. `{}` is the safe default so
// `p => p.theme.brand` returns undefined (dropped by the interpolation layer)
// instead of throwing when no ThemeProvider is present.
export type Theme = Record<string, unknown>;

export const ThemeContext = React.createContext<Theme>({});

export interface ThemeProviderProps {
  theme: Theme;
  children?: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ theme, children }) => {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};
