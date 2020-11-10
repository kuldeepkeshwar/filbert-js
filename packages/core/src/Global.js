import React from 'react';
import { TYPES_GLOBAL } from '@filbert-js/types';
import { useGlobalStylesheet } from './hooks';
let counter = 0;
export const Global = React.memo(function ({ styles }) {
  const [id] = React.useState(() => {
    counter++;
    return `${TYPES_GLOBAL}-${counter}`;
  });
  useGlobalStylesheet(id, styles);
  return null;
});
