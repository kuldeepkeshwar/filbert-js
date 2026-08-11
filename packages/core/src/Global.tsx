import React from 'react';
import { TYPES_GLOBAL } from '@filbert-js/types';
import { useGlobalStylesheet } from './hooks';

let counter = 0;

export interface GlobalProps {
  styles: string;
}

export const Global = React.memo<GlobalProps>(function Global({ styles }) {
  const [id] = React.useState(() => {
    counter++;
    return `${TYPES_GLOBAL}-${counter}`;
  });
  useGlobalStylesheet(id, styles);
  return null;
});
