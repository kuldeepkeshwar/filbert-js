import {
  IS_STYLED_COMPONENT,
  LABEL_PREFIX,
  RAW,
  SOURCE_ORDER,
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
      const sheet = React.useContext(StyleSheetContext);
      const obj = factory(null, options.label, {
        ...props,
        theme,
      })(styleTemplates, ...variables);

      const [styles, keyframes] = obj[RAW];
      keyframes.forEach((frame) => sheet.createKeyframes(frame));
      const className = obj.toString();

      useStylesheet(
        className,
        styles,
        props[SOURCE_ORDER],
        StyledComponent.label,
      );
      const {
        className: passedClassName = '',
        [SOURCE_ORDER]: sourceOrder,
        ..._props
      } = props;

      const finalProps = Object.assign(
        {
          className: [StyledComponent.label, className, passedClassName]
            .join(' ')
            .trim(),
          [SOURCE_ORDER]: Component[IS_STYLED_COMPONENT]
            ? className
            : undefined,
        },
        _props,
      );
      return <Component {...finalProps} />;
    }
    StyledComponent[IS_STYLED_COMPONENT] = true;
    StyledComponent.label = options.label
      ? options.label
      : `${LABEL_PREFIX}${id}`;

    id++;
    return StyledComponent;
  };
}
