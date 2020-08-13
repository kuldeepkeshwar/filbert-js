import { IS_STYLED_COMPONENT, TYPE, TYPES_KEYFRAMES } from '@filbert-js/types';

export function interpolate(styleTemplates, ...variables) {
  const keyframes = [];

  const styleStr = styleTemplates.reduce((previous, current, index) => {
    const variable = variables[index - 1];
    const value = resolveValue(keyframes, this, variable);
    return `${previous}${value}${current}`;
  });
  return [styleStr, keyframes];
}
function resolveValue(keyframes, context, variable) {
  let value = variable;
  if (variable[TYPE] === TYPES_KEYFRAMES) {
    keyframes.push(variable);
    value = variable;
  } else if (variable[IS_STYLED_COMPONENT]) {
    value = `.${variable.label}`;
  } else if (typeof variable === 'function') {
    value = variable(context);
  }
  return value;
}
