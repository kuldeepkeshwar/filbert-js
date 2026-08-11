// Runs once before each test. Clears <head> so tests see a clean stylesheet
// surface. Filbert's `__sheet` is a module-scope singleton — we can't reset the
// JS-side map without re-importing, but for behavior tests the DOM state is
// what matters, and the `createStyles` guard is a `!_css[...][id]` check that
// re-adds any missing tags when a class is re-rendered.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  // Some tests run in the node environment (bundler-plugin tests need real
  // esbuild, which trips jsdom's TextEncoder shim). Skip the DOM cleanup when
  // there is no document.
  if (typeof document === 'undefined') return;
  cleanup();
  document.head.innerHTML = '';
});
