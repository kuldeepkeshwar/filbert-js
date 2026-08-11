// @vitest-environment node
// Real HTTP streaming SSR: a `node:http` server renders with
// `renderToPipeableStream`, pipes through `createStyleFlusher(sheet)` into the
// response, and the test fetches the URL like a browser would. Complements
// renderToPipeableStream.test.tsx (in-memory Transforms) by covering the full
// socket round-trip.
import React, { Suspense } from 'react';
import { afterAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { renderToPipeableStream } from 'react-dom/server';
import { styled } from '../helpers/styled';
import {
  createStylesheet as createServerSheet,
  createStyleFlusher,
} from '@filbert-js/server-stylesheet';

const Shell = styled.div`
  color: red;
`;
const LazyBody = styled.span`
  color: blue;
`;

// Resolves on a timer so the shell flushes first and the lazy segment arrives
// as a later chunk — the flusher must emit its rule in that later chunk.
const LazyContent = React.lazy(
  () =>
    new Promise<{ default: React.ComponentType }>((resolve) =>
      setTimeout(() => resolve({ default: () => <LazyBody>lazy-tail</LazyBody> }), 20),
    ),
);

let server: Server;

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
    }),
);

describe('streaming SSR over a real node:http server', () => {
  it('serves styled markup with each rule emitted exactly once across chunks', async () => {
    server = createServer((_req, res) => {
      const sheet = createServerSheet();
      const app = sheet.collectStyles(
        <html>
          <head>
            <title>t</title>
          </head>
          <body>
            <Shell>shell-content</Shell>
            <Suspense fallback={<span>loading</span>}>
              <LazyContent />
            </Suspense>
          </body>
        </html>,
      );
      const stream = renderToPipeableStream(app, {
        onShellReady() {
          res.statusCode = 200;
          res.setHeader('content-type', 'text/html');
          const flusher = createStyleFlusher(sheet);
          flusher.pipe(res);
          stream.pipe(flusher);
        },
        onShellError(err) {
          res.statusCode = 500;
          res.end(String(err));
        },
      });
    });

    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}/`);
    const body = await response.text();

    // 1. HTTP status
    expect(response.status).toBe(200);

    // 2. Styled markup — both components rendered with a generated class.
    const shellMatch = body.match(/<div class="([^"]+)"[^>]*>shell-content/);
    const lazyMatch = body.match(/<span class="([^"]+)"[^>]*>lazy-tail/);
    expect(shellMatch).not.toBeNull();
    expect(lazyMatch).not.toBeNull();
    // class="" carries a stable label class + the hashed rule class (last).
    const shellClass = shellMatch![1].split(' ').pop()!;
    const lazyClass = lazyMatch![1].split(' ').pop()!;

    // 3. Style rules for shell AND lazy component, keyed by their class.
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
    expect(body).toMatch(new RegExp(`\\.${esc(shellClass)}[^{]*\\{[^}]*color\\s*:\\s*red`));
    expect(body).toMatch(new RegExp(`\\.${esc(lazyClass)}[^{]*\\{[^}]*color\\s*:\\s*blue`));

    // 4. Each rule exactly once — no duplicate emission across chunks.
    expect((body.match(/color\s*:\s*red/g) || []).length).toBe(1);
    expect((body.match(/color\s*:\s*blue/g) || []).length).toBe(1);
  });
});
