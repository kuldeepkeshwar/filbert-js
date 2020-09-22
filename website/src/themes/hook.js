import { useCallback, useEffect, useState } from 'react';

import { tokens as darkTheme } from './dark';
import { tokens as lightTheme } from './light';

const themes = { light: lightTheme, dark: darkTheme };
function getThemeName() {
  if (typeof window === 'object') {
    const localTheme = window.localStorage.getItem('theme');
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches &&
      !localTheme
      ? 'dark'
      : localTheme
      ? localTheme
      : 'light';
  } else {
    return 'light';
  }
}
export const useTheme = () => {
  const [theme, setTheme] = useState(getThemeName());

  const setMode = useCallback((mode) => {
    window.localStorage.setItem('theme', mode);
    setTheme(mode);
  }, []);

  const toggleTheme = () => {
    if (theme === 'light') {
      setMode('dark');
    } else {
      setMode('light');
    }
  };

  useEffect(() => {
    setMode(getThemeName());
  }, [setMode]);

  return [themes[theme], toggleTheme];
};
