const themes = ['theme-light', 'theme-dark'];
export function getThemeName() {
  if (typeof window === 'undefined') {
    return themes[0];
  }
  const localTheme = window.localStorage.getItem('theme');
  return window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches &&
    !localTheme
    ? themes[1]
    : localTheme
    ? localTheme
    : themes[0];
}
export function toggleTheme() {
  const themeRoot = document.body;
  const currentTheme = themeRoot.classList.toString();
  let result;
  if (themes[0] === currentTheme) {
    result = themes[1];
  } else {
    result = themes[0];
  }
  themeRoot.classList.add(result);
  themeRoot.classList.remove(currentTheme);
  window.localStorage.setItem('theme', result);
}
