import PropTypes from 'prop-types';
import React from 'react';
import { styled } from '@filbert-js/core';
const alignments = [
  'start',
  'end',
  'center',
  'stretch',
  'gap-around',
  'gap-between',
  'gap-evenly',
];
const alignmentsY = ['start', 'end', 'center', 'stretch'];

function gridStyles({ direction = 'vertical', gap, children }) {
  if (direction === 'vertical') {
    return `
      grid-row-gap: ${gap || 0};
      grid-template-columns:auto;
      grid-template-rows: repeat(${React.Children.count(
        children,
      )}, min-content);
    `;
  } else {
    return `
      grid-column-gap: ${gap || 0};
      grid-template-rows:auto;
      grid-template-columns: repeat(${React.Children.count(
        children,
      )}, min-content);
      `;
  }
}

export const Stack = styled.div`
  display: grid;
  justify-content: ${({ align }) => align || 'stretch'};
  align-items: ${({ alignY }) => alignY || 'stretch'};
  ${gridStyles};
`;
Stack.propTypes = {
  gap: PropTypes.string,
  align: PropTypes.oneOf(alignments),
  alignY: PropTypes.oneOf(alignmentsY),
  direction: PropTypes.oneOf(['horizontal', 'vertical']),
};
