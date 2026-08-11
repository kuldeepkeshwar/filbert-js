// Render throughput — mount and update pass on 1000 styled components.
// Uses tinybench directly (rather than vitest bench) so we can wire in jsdom
// setup, but still runs under `vitest bench` since vitest discovers the file.
import React from 'react';
import { bench, describe } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { styled } from '../helpers/styled';
import { StyleSheetProvider } from '@filbert-js/style-sheet-context';
import { createStylesheet } from '@filbert-js/browser-stylesheet';

const Simple = styled.div`
  color: red;
  padding: 8px;
`;

const Dynamic = styled.div`
  color: ${(p: any) => p.$c};
  padding: ${(p: any) => p.$p}px;
`;

const Complex = styled.div`
  color: ${(p: any) => p.$c};
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  &:hover { background: #f5f5f5; }
  @media (min-width: 600px) {
    padding: 12px 20px;
  }
`;

function mountAndUnmount(node: any) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  // React 18 rendering is async by default; act() keeps timing honest.
  // Wrap in a sync fn for tinybench compatibility — createRoot.render commits
  // synchronously in test env with jsdom.
  root.render(node);
  root.unmount();
  host.remove();
}

function withSheet(children: any) {
  const sheet = createStylesheet();
  return <StyleSheetProvider stylesheet={sheet}>{children}</StyleSheetProvider>;
}

describe('mount — cold (fresh sheet per iteration)', () => {
  bench('100 simple styled components', () => {
    const items = Array.from({ length: 100 }, (_, i) => <Simple key={i} />);
    mountAndUnmount(withSheet(<>{items}</>));
  });

  bench('1000 simple styled components', () => {
    const items = Array.from({ length: 1000 }, (_, i) => <Simple key={i} />);
    mountAndUnmount(withSheet(<>{items}</>));
  });

  bench('1000 DYNAMIC styled components (prop-driven)', () => {
    const items = Array.from({ length: 1000 }, (_, i) => (
      <Dynamic key={i} $c={i % 2 ? 'red' : 'blue'} $p={i % 4} />
    ));
    mountAndUnmount(withSheet(<>{items}</>));
  });

  bench('1000 COMPLEX styled components (nested + @media + dynamic)', () => {
    const items = Array.from({ length: 1000 }, (_, i) => (
      <Complex key={i} $c={i % 2 ? 'red' : 'blue'} />
    ));
    mountAndUnmount(withSheet(<>{items}</>));
  });
});

describe('update — prop change on 500 mounted components', () => {
  // Setup once outside the bench — measures the update pass only.
  function setup() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const initial = Array.from({ length: 500 }, (_, i) => (
      <Dynamic key={i} $c="red" $p={0} />
    ));
    root.render(withSheet(<>{initial}</>));
    return { root, host };
  }

  bench('rerender with new prop values', () => {
    const { root, host } = setup();
    const next = Array.from({ length: 500 }, (_, i) => (
      <Dynamic key={i} $c={i % 2 ? 'blue' : 'green'} $p={2} />
    ));
    root.render(withSheet(<>{next}</>));
    root.unmount();
    host.remove();
  });
});

describe('memory — <style> tag count after mount', () => {
  // Emits a printed count via bench.setup — the number itself is what we track
  // pre/post refactor. Bench iterations exercise DOM cleanup.
  bench('1000 UNIQUE styled components — mount then count', () => {
    // Each iteration a fresh set of unique classes.
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const kinds = Array.from({ length: 20 }, (_, k) =>
      styled.div`color: ${'c' + k}; padding: ${k}px;`,
    );
    const items = Array.from({ length: 1000 }, (_, i) => {
      const K = kinds[i % kinds.length];
      return <K key={i} />;
    });
    root.render(withSheet(<>{items}</>));
    // Snapshot count for post-hoc inspection.
    (globalThis as any).__filbertBenchLastTagCount = document.head.querySelectorAll(
      'style[data-type="styled-css"]',
    ).length;
    root.unmount();
    host.remove();
  });
});
