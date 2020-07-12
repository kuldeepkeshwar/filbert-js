import React from 'react';
import { useGlobalStylesheet } from './hooks';

let counter = 0;
export function Global({ styles }) {
  const [id] = React.useState(() => {
    counter++;
    return 'global-' + counter;
  });
  useGlobalStylesheet(id, styles);
  return null;
}
