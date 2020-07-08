import { TYPES, TYPES_KEYFRAMES } from '@filbert-js/types';

export function interpolate(styleTemplates, variables, context) {
  const keyframes = [];
  const styleStr = styleTemplates.reduce((previous, current, index) => {
    const variable = variables[index - 1];
    let value = variable;
    if (variable[TYPES] === TYPES_KEYFRAMES) {
      keyframes.push(variable);
      value = variable;
    }
    if (typeof variable === 'function') {
      value = variable(context);
    }
    return `${previous}${value}${current}`;
  });
  return [styleStr, keyframes];
}
