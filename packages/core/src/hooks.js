import { TYPES_GLOBAL, TYPES_STYLES } from '@filbert-js/types';

import React from 'react';
import { StyleSheetContext } from '@filbert-js/style-sheet-context';

// invoke callback if value changes b/w render cycles

export function useGlobalStylesheet({ id, styles }) {
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

export function useStylesheet({ hash, styles, sourceAfter, label }) {
  const stylesheet = React.useContext(StyleSheetContext);
  const latestRef = React.useRef();

  const stylesheetRef = React.useRef();
  stylesheetRef.current = stylesheet;

  stylesheetRef.current.createStyles(hash, styles, sourceAfter, label);

  latestRef.current = hash;

  React.useEffect(
    () => {
      const previous = hash;
      return () => {
        const latest = latestRef.current;
        if (previous !== latest) {
          stylesheetRef.current.removeStyles(previous, TYPES_STYLES);
        }
      };
    },
    [hash],
  );

  React.useEffect(() => {
    return () =>
      stylesheetRef.current.removeStyles(latestRef.current, TYPES_STYLES);
  }, []);
}
