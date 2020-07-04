import { get } from 'lodash-es';

const system = (scale) => (value) => ({ theme }) => {
  return get(theme[scale], value);
};

export const colors = (value) => ({ theme }) => {
  const val = get(theme.colors, value);
  if (!isValidColor(val)) {
    return get(theme.colors, val);
  }
  return val;
};
export const space = system('space');
export const fontSizes = system('fontSizes');
function isValidColor(color) {
  return color.startsWith('#') || color.startsWith('rgb');
}
