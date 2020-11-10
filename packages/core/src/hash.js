//https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript

const cache = {};
export function hash(str) {
  let hash = cache[str] || 0;
  if (!hash) {
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
    }
    cache[str] = hash;
  }
  return hash;
}
