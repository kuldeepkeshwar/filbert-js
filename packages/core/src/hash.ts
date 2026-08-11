// djb2-ish string hash — the one filbert has always used. 32-bit range,
// signed. Cached per-string so repeat calls with identical input are a
// Map.get() shape (though `cache[str]` uses an object, close enough).
const cache: Record<string, number> = {};

export function hash(str: string): number {
  let h = cache[str] || 0;
  if (!h) {
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      h = (h << 5) - h + chr;
      h |= 0; // convert to 32-bit int
    }
    cache[str] = h;
  }
  return h;
}
