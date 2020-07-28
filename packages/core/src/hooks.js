import { TYPES_GLOBAL, TYPES_STYLES } from '@filbert-js/types';

import React from 'react';
import { __sheet } from '@filbert-js/style-sheet-context';

// invoke callback if value changes b/w render cycles

export function useGlobalStylesheet(id, styles) {
  __sheet.createGlobalStyles(id, styles);

  React.useEffect(
    () => {
      __sheet.createGlobalStyles(id, styles);
    },
    [styles, id],
  );

  React.useEffect(
    () => {
      return () => __sheet.removeStyles(id, TYPES_GLOBAL);
    },
    [id],
  );
}

export function useStylesheet(
  keyframes,
  className,
  styles,
  sourceOrder,
  label,
) {
  const latestRef = React.useRef();

  keyframes.forEach((frame) => __sheet.createKeyframes(frame));
  __sheet.createStyles(className, styles, sourceOrder, label);

  latestRef.current = className;

  React.useEffect(
    () => {
      const previous = className;
      return () => {
        const latest = latestRef.current;
        if (previous !== latest) {
          __sheet.removeStyles(previous, TYPES_STYLES);
        }
      };
    },
    [className],
  );

  React.useEffect(() => {
    return () => __sheet.removeStyles(latestRef.current, TYPES_STYLES);
  }, []);
}
