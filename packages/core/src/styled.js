import {
  IS_STYLED_COMPONENT,
  LABEL_PREFIX,
  RAW,
  SOURCE_AFTER,
} from '@filbert-js/types';

import React from 'react';
import { StyleSheetContext } from '@filbert-js/style-sheet-context';
import { ThemeContext } from '@filbert-js/theming';
import { factory } from './factory';
import { useStylesheet } from './hooks';

let id = 1;
export function styled(Component, options = {}) {
  return (styleTemplates, ...variables) => {
    function StyledComponent(props) {
      const theme = React.useContext(ThemeContext);
      const stylesheet = React.useContext(StyleSheetContext);
      const obj = factory({
        label: options.label,
        context: {
          ...props,
          theme,
        },
      })(styleTemplates, ...variables);

      const [styles, keyframes] = obj[RAW];
      keyframes.forEach((frame) => stylesheet.createKeyframes(frame));
      const className = obj.toString();

      useStylesheet({
        className,
        styles: styles,
        sourceAfter: props[SOURCE_AFTER],
        label: StyledComponent.label,
      });
      const { [SOURCE_AFTER]: sourceAfter, ..._props } = props;

      const extraProps = Object.assign(
        {
          className: [StyledComponent.label, className, props.className || '']
            .map((value) => value.trim())
            .join(' ')
            .trim(),
          [SOURCE_AFTER]: Component[IS_STYLED_COMPONENT]
            ? className
            : undefined,
        },
        _props,
      );
      return <Component {...extraProps} />;
    }
    StyledComponent[IS_STYLED_COMPONENT] = true;
    if (options.label) {
      StyledComponent.label = options.label;
    } else {
      StyledComponent.label = `${LABEL_PREFIX}${id}`;
    }
    id++;
    return StyledComponent;
  };
}
