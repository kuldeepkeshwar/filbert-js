import {
  IS_STYLED_COMPONENT,
  SOURCE_AFTER,
  TYPES,
  TYPES_KEYFRAMES,
} from '@filbert-js/types';

import React from 'react';
import { StyleSheetContext } from '@filbert-js/style-sheet-context';
import { ThemeContext } from '@filbert-js/theming';
import { hash } from './hash';
import htmlTags from 'html-tags';
import { useStylesheet } from './hooks';

function interpolate(styleTemplates, variables, context) {
  const keyframes = [];
  const values = variables.map((variable) => {
    if (variable[TYPES] === TYPES_KEYFRAMES) {
      keyframes.push(variable);
      return variable;
    }
    if (typeof variable === 'function') {
      return variable(context);
    }
    return variable;
  });
  const styleStr = styleTemplates.reduce((previous, current, index) => {
    return `${previous}${values[index - 1]}${current}`;
  });
  return [styleStr, keyframes];
}
let id = 1;
function componentFactory({
  Component,
  options = {},
  styleTemplates,
  variables,
}) {
  function StyledComponent(props) {
    const theme = React.useContext(ThemeContext);
    const stylesheet = React.useContext(StyleSheetContext);

    const [styles, keyframes] = interpolate(styleTemplates, variables, {
      ...props,
      theme,
    });
    keyframes.forEach((frame) => stylesheet.createKeyframes(frame));
    const id = hash(styles, options.label);

    useStylesheet({
      hash: id,
      styles: styles,
      sourceAfter: props[SOURCE_AFTER],
      label: StyledComponent.label,
    });
    const { className, [SOURCE_AFTER]: sourceAfter, ..._props } = props;
    const _className = [className, id].join(' ').trim();
    const extraProps = {
      className: _className,
      [SOURCE_AFTER]: Component[IS_STYLED_COMPONENT] ? id : undefined,
    };

    return <Component {...extraProps} {..._props} />;
  }
  StyledComponent[IS_STYLED_COMPONENT] = true;
  if (options.label) {
    StyledComponent.label = options.label;
  } else {
    StyledComponent.label = id;
  }
  id++;
  return StyledComponent;
}
export function styled(Component, options = {}) {
  return (styleTemplates, ...variables) =>
    componentFactory({ Component, options, styleTemplates, variables });
}

htmlTags.forEach((Component) => {
  styled[Component] = (styleTemplates, ...variables) =>
    componentFactory({ Component, styleTemplates, variables });
});
