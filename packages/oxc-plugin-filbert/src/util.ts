// Small helpers shared with babel-plugin-filbert. Copied verbatim so the two
// plugins produce byte-identical labels + componentIds; do NOT diverge these
// without also touching the babel plugin, or your parity tests will trip.

// djb2-ish, matches the runtime `hash()` in packages/core/src/hash.ts.
export function hash32(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    h = (h << 5) - h + chr;
    h |= 0;
  }
  return h;
}

export function shortHash(str: string): string {
  const h = hash32(str);
  return (h >>> 0).toString(36);
}

export function getFilenameBase(filename: string | null | undefined): string {
  if (!filename) return 'anon';
  const noQuery = filename.split('?')[0];
  const parts = noQuery.split(/[\\/]/);
  const last = parts[parts.length - 1] || 'anon';
  return last.replace(/\.[^.]+$/, '') || 'anon';
}

export const toKebab = (s: string): string =>
  s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

export function makeLabelAndId(
  fileBase: string,
  varName: string,
): { label: string; componentId: string } {
  return {
    label: `${fileBase}__${varName}`,
    componentId: `fj-${shortHash(`${fileBase}::${varName}`)}`,
  };
}
