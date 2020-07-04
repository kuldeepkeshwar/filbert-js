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

function gap({ theme: { space = {} } = {}, gap }) {
  return space[gap] || gap || '0px';
}
function size({ theme: { sizes = {} } = {}, widths = [] }) {
  return widths.map((w) => sizes[w] || w).join(' ');
}
const Grid = styled.div`
  display: grid;
  overflow: scroll;
  width: ${({ inline }) => (inline ? 'max-content' : 'auto')};
  column-gap: ${gap};
  grid-template-columns: ${size};
  justify-content: ${({ align }) => align || 'stretch'};
  align-items: ${({ alignY }) => alignY || 'stretch'};
`;
const Cell = styled.div`
  min-width: 0;
`;
export function Columns({ children, gap, align, alignY, inline }) {
  const widths = [];
  const Columns = React.Children.toArray(children).map(
    ({ props: { width, children, ...rest }, type }) => {
      widths.push(width === 'content' ? 'max-content' : width || '1fr');
      return React.createElement(type, { ...rest }, children);
    },
  );
  return (
    <Grid
      gap={gap}
      widths={widths}
      align={align}
      alignY={alignY}
      inline={inline}
    >
      {Columns}
    </Grid>
  );
}
Columns.propTypes = {
  gap: PropTypes.string,
  align: PropTypes.oneOf(alignments),
  alignY: PropTypes.oneOf(alignmentsY),
  inline: PropTypes.bool,
};
function Column({ children }) {
  return <Cell>{children}</Cell>;
}
Column.proppTypes = {
  width: PropTypes.string,
};
Columns.Column = Column;
