// End-to-end streaming SSR: React 18's `renderToPipeableStream` + the server
// sheet's `flushStyles()` incremental API.
//
// Two shapes covered:
//   1. Manual pipeline — a `Transform` we own reads `sheet.flushStyles()` on
//      every chunk boundary and prepends the new styles. This is the loop a
//      framework author writes by hand.
//   2. `createStyleFlusher` — the packaged helper (same behavior + a
//      `<head>` splice on the first chunk that carries one).
//
// A `<Suspense>` boundary with a `React.lazy` child forces at least two
// output chunks: the shell, then the resolved lazy segment. That's what
// makes the "second chunk contains only the new rules" assertion meaningful.

import React, { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough, Transform, Writable } from 'stream';
import { styled } from '../helpers/styled';
import {
  createStylesheet as createServerSheet,
  createStyleFlusher,
  type ServerStyleSheetAPI,
} from '@filbert-js/server-stylesheet';

// ---------- test scaffolding ----------

interface Boundary {
  html: string;
  styles: string;
}

// A Transform that records each chunk as `{ html, styles }`, snapshotting the
// pending style buffer at the exact moment the chunk goes through. Passes the
// chunk on unchanged so the downstream collector sees the raw HTML — the
// style-injection variant is tested via `createStyleFlusher` separately.
function recordingSplitter(sheet: ServerStyleSheetAPI, out: Boundary[]): Transform {
  return new Transform({
    transform(chunk, _enc, cb) {
      const html = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      const styles = sheet.flushStyles();
      out.push({ html, styles });
      cb(null, chunk);
    },
  });
}

function collectFinal(): { dest: Writable; done: Promise<string> } {
  const bufs: Buffer[] = [];
  let resolve!: (v: string) => void;
  const done = new Promise<string>((r) => (resolve = r));
  const dest = new Writable({
    write(chunk, _enc, cb) {
      bufs.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      cb();
    },
  });
  dest.on('finish', () => resolve(Buffer.concat(bufs).toString('utf8')));
  return { dest, done };
}

// A `React.lazy` you can hold open. `resolve()` unblocks it and returns the
// promise so the caller can `await` React actually flushing the resolved
// segment.
function makeGate<T extends React.ComponentType<any>>(Component: T) {
  let resolveModule!: () => void;
  const promise = new Promise<{ default: T }>((r) => {
    resolveModule = () => r({ default: Component });
  });
  const Lazy = React.lazy(() => promise);
  return { Lazy, open: () => (resolveModule(), promise) };
}

// ---------- Test A: manual pipeline (splitter records per-chunk styles) ----------

describe('renderToPipeableStream — manual flushStyles per chunk', () => {
  it('emits shell styles in the first chunk, lazy styles only in the next', async () => {
    const Shell = styled.div`
      color: red;
    `;
    const LazyBody = styled.span`
      color: blue;
    `;
    const gate = makeGate(function LazyContent() {
      return <LazyBody>blue</LazyBody>;
    });

    const sheet = createServerSheet();
    const boundaries: Boundary[] = [];
    const splitter = recordingSplitter(sheet, boundaries);
    const { dest, done } = collectFinal();
    splitter.pipe(dest);

    const app = sheet.collectStyles(
      <html>
        <head />
        <body>
          <Shell>shell</Shell>
          <Suspense fallback={<span>loading</span>}>
            <gate.Lazy />
          </Suspense>
        </body>
      </html>,
    );

    const shellReady = new Promise<void>((r) => {
      const stream = renderToPipeableStream(app, {
        onShellReady() {
          stream.pipe(splitter);
          r();
        },
        onAllReady() {
          // No-op — we rely on the pipeline's natural end via the last chunk.
        },
        onError(err) {
          throw err;
        },
      });
    });

    await shellReady;
    // Give React a microtask to flush the shell chunk into the pipeline.
    await new Promise((r) => setImmediate(r));

    // Now unblock the lazy child and wait for the tail chunk.
    await gate.open();
    const finalHtml = await done;

    // At least one shell boundary + at least one lazy boundary.
    expect(boundaries.length).toBeGreaterThanOrEqual(2);

    const shellBoundaries = boundaries.slice(
      0,
      boundaries.findIndex((b) => b.styles.includes('blue')) === -1
        ? 1
        : boundaries.findIndex((b) => b.styles.includes('blue')),
    );
    const shellStyles = shellBoundaries.map((b) => b.styles).join('');
    const lazyStyles = boundaries
      .slice(shellBoundaries.length)
      .map((b) => b.styles)
      .join('');

    // Shell chunks carry the red rule (styled-css bucket).
    expect(shellStyles).toMatch(/color\s*:\s*red/);
    expect(shellStyles).toMatch(/<style[^>]*data-type="styled-css"/);
    // Shell chunks do NOT contain the not-yet-registered blue rule.
    expect(shellStyles).not.toMatch(/color\s*:\s*blue/);

    // Lazy boundary carries the blue rule and does NOT re-emit red.
    expect(lazyStyles).toMatch(/color\s*:\s*blue/);
    expect(lazyStyles).not.toMatch(/color\s*:\s*red/);

    // Final HTML from the collector: shell markup is present.
    expect(finalHtml).toContain('shell');
    // The concatenated per-boundary style stream has each rule exactly once.
    const allStyles = boundaries.map((b) => b.styles).join('');
    const redCount = (allStyles.match(/color\s*:\s*red/g) || []).length;
    const blueCount = (allStyles.match(/color\s*:\s*blue/g) || []).length;
    expect(redCount).toBe(1);
    expect(blueCount).toBe(1);

    // Nothing left to flush after the stream ends.
    expect(sheet.hasPendingStyles()).toBe(false);
    expect(sheet.flushStyles()).toBe('');
  });
});

// ---------- Test B: createStyleFlusher inline injection ----------

describe('renderToPipeableStream — createStyleFlusher helper', () => {
  it('splices styles into the outgoing HTML at chunk boundaries', async () => {
    const Card = styled.div`
      color: green;
    `;
    const LazyBody = styled.p`
      color: purple;
    `;
    const gate = makeGate(function LazyContent() {
      return <LazyBody>tail</LazyBody>;
    });

    const sheet = createServerSheet();
    const flusher = createStyleFlusher(sheet);
    const { dest, done } = collectFinal();
    flusher.pipe(dest);

    const app = sheet.collectStyles(
      <html>
        <head>
          <title>t</title>
        </head>
        <body>
          <Card>card</Card>
          <Suspense fallback={<span>loading</span>}>
            <gate.Lazy />
          </Suspense>
        </body>
      </html>,
    );

    const shellReady = new Promise<void>((r) => {
      const stream = renderToPipeableStream(app, {
        onShellReady() {
          stream.pipe(flusher);
          r();
        },
        onError(err) {
          throw err;
        },
      });
    });

    await shellReady;
    await new Promise((r) => setImmediate(r));
    await gate.open();
    const html = await done;

    // Both rules are present in the final assembled document.
    expect(html).toMatch(/color\s*:\s*green/);
    expect(html).toMatch(/color\s*:\s*purple/);

    // First chunk has a <head>, so the flusher spliced green INSIDE it —
    // the green <style> block should appear before </head>.
    const headOpen = html.indexOf('<head');
    const headClose = html.indexOf('</head>');
    expect(headOpen).toBeGreaterThan(-1);
    expect(headClose).toBeGreaterThan(headOpen);
    const headSlice = html.slice(headOpen, headClose);
    expect(headSlice).toMatch(/color\s*:\s*green/);
    // Purple registered LATER; it lands outside the (already-closed) head.
    expect(headSlice).not.toMatch(/color\s*:\s*purple/);

    // No duplicated rules — flushStyles cleared the buffer per chunk.
    expect((html.match(/color\s*:\s*green/g) || []).length).toBe(1);
    expect((html.match(/color\s*:\s*purple/g) || []).length).toBe(1);

    expect(sheet.hasPendingStyles()).toBe(false);
  });

  it('passes chunks through untouched when nothing new was registered', async () => {
    const sheet = createServerSheet();
    const flusher = createStyleFlusher(sheet);
    const seen: string[] = [];
    const sink = new Writable({
      write(chunk, _e, cb) {
        seen.push(chunk.toString('utf8'));
        cb();
      },
    });
    flusher.pipe(sink);

    await new Promise<void>((resolve) => {
      sink.on('finish', () => resolve());
      const src = new PassThrough();
      src.pipe(flusher);
      src.end('<div>hi</div>');
    });

    expect(seen.join('')).toBe('<div>hi</div>');
    expect(sheet.hasPendingStyles()).toBe(false);
  });
});
