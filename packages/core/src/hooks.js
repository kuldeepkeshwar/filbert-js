import { TYPES_GLOBAL, TYPES_STYLES } from '@filbert-js/types';

import React from 'react';
import { StyleSheetContext } from '@filbert-js/style-sheet-context';

// invoke callback if value changes b/w render cycles

export function useGlobalStylesheet(id, styles) {
  const stylesheet = React.useContext(StyleSheetContext);
  const stylesheetRef = React.useRef();
  stylesheetRef.current = stylesheet;
  stylesheetRef.current.createGlobalStyles(id, styles);

  React.useEffect(
    () => {
      stylesheetRef.current.createGlobalStyles(id, styles);
    },
    [styles, id],
  );

  React.useEffect(
    () => {
      return () => stylesheetRef.current.removeStyles(id, TYPES_GLOBAL);
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
  const sheet = React.useContext(StyleSheetContext);
  const latestRef = React.useRef();

  const stylesheetRef = React.useRef();
  stylesheetRef.current = sheet;
  keyframes.forEach((frame) => sheet.createKeyframes(frame));
  stylesheetRef.current.createStyles(className, styles, sourceOrder, label);

  latestRef.current = className;

  React.useEffect(
    () => {
      const previous = className;
      return () => {
        const latest = latestRef.current;
        if (previous !== latest) {
          stylesheetRef.current.removeStyles(previous, TYPES_STYLES);
        }
      };
    },
    [className],
  );

  React.useEffect(() => {
    return () =>
      stylesheetRef.current.removeStyles(latestRef.current, TYPES_STYLES);
  }, []);
}
