import {
  IS_STYLED_COMPONENT,
  LABEL_PREFIX,
  RAW,
  SOURCE_ORDER,
} from '@filbert-js/types';

import React from 'react';
import { ThemeContext } from '@filbert-js/theming';
import { factory } from './factory';
import { useStylesheet } from './hooks';

let id = 1;
export function styled(Component, options = {}) {
  return function f() {
    const args = arguments;
    function S(props, ref) {
      const theme = React.useContext(ThemeContext);
      const obj = factory(undefined, options.label, {
        ...props,
        theme,
      }).apply(null, args);

      const [styles, keyframes] = obj[RAW];

      const className = obj.toString();

      useStylesheet(keyframes, className, styles, props[SOURCE_ORDER], S.label);
      const {
        className: passedClassName = '',
        [SOURCE_ORDER]: sourceOrder,
        as,
        children,
        ..._props
      } = props;

      const finalProps = Object.assign(
        {
          className: [S.label, className, passedClassName].join(' ').trim(),
          [SOURCE_ORDER]: Component[IS_STYLED_COMPONENT]
            ? className
            : undefined,
          ref,
        },
        _props,
      );
      return React.createElement(as || Component, finalProps, children);
    }
    S[IS_STYLED_COMPONENT] = true;
    S.label = options.label ? options.label : `${LABEL_PREFIX}${id}`;

    id++;
    return React.forwardRef(S);
  };
}
