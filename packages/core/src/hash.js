//https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
import { CLASS_PREFIX } from '@filbert-js/types';
const cache = {};
export function hash(str, prefix = CLASS_PREFIX) {
  let h = cache[str] || 0;
  if (!h) {
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      h = (h << 5) - h + chr;
      h |= 0; // Convert to 32bit integer
    }
    cache[str] = h;
  }
  return `${prefix}-${h}`;
}
