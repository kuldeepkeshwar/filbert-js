'use client';

export { Global } from './src/Global';
export { styled } from './src/styled';
export { keyframes, css, jsx } from './src/core';

// Public type surface — consumers of `@filbert-js/core` can import these to
// annotate their own styled components / interpolations.
export type {
  StyledComponent,
  StyledFactory,
  ShouldForwardProp,
  AttrsDef,
  WithConfig,
} from './src/styled';
export type { GlobalProps } from './src/Global';
export type { Interpolation, InterpolateContext } from './src/interpolate';
export type { StyledFactoryResult } from './src/factory';
