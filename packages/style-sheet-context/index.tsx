'use client';

import React from 'react';
import { createStylesheet } from '@filbert-js/browser-stylesheet';
import type { StyleSheetAPI } from '@filbert-js/stylesheet';

// Module-level singleton used by hooks that need to reach the sheet without
// props threading. `StyleSheetProvider` mutates this so each React tree can
// have its own sheet (necessary for SSR / multi-root / Shadow DOM).
export let __sheet: StyleSheetAPI = createStylesheet();

export const StyleSheetContext = React.createContext<StyleSheetAPI>(__sheet);

export interface StyleSheetProviderProps {
  stylesheet: StyleSheetAPI;
  children?: React.ReactNode;
}

export const StyleSheetProvider: React.FC<StyleSheetProviderProps> = ({
  stylesheet,
  children,
}) => {
  __sheet = stylesheet;
  return (
    <StyleSheetContext.Provider value={stylesheet}>
      {children}
    </StyleSheetContext.Provider>
  );
};
