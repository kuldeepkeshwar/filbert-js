// Streaming SSR helpers on top of the server sheet.
//
// `createStyleFlusher(sheet)` returns a Node `Transform` you can splice
// between `renderToPipeableStream()`'s `pipe(...)` target and the final
// destination (an HTTP response, a memory buffer, etc). On every chunk it
// asks the sheet for any styles registered since the previous flush and
// prepends a `<style>` block before the chunk goes out — or lets the chunk
// through unchanged when nothing new landed. If the first chunk carries an
// opening `<head>`, the styles are injected right after the tag so they
// land inside `<head>`; every subsequent chunk gets its incremental styles
// prepended verbatim (the browser's parser hoists stray `<style>` into head
// order for our purposes).
import { Transform, type TransformCallback } from 'stream';
import type { ServerStyleSheetAPI } from './index';

const HEAD_OPEN = /<head(\s[^>]*)?>/i;

export function createStyleFlusher(sheet: ServerStyleSheetAPI): Transform {
  let sawHead = false;
  return new Transform({
    transform(chunk: Buffer | string, _enc: BufferEncoding, cb: TransformCallback) {
      const styles = sheet.flushStyles();
      if (!styles) {
        cb(null, chunk);
        return;
      }
      const body = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      if (!sawHead) {
        const match = body.match(HEAD_OPEN);
        if (match && match.index !== undefined) {
          sawHead = true;
          const cut = match.index + match[0].length;
          cb(null, body.slice(0, cut) + styles + body.slice(cut));
          return;
        }
      }
      cb(null, styles + body);
    },
  });
}
