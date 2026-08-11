// Runtime shim for the `styled.div` sugar that filbert's babel plugin normally
// rewrites to `styled('div')`. The tests run through vitest without the babel
// plugin, so we install a small Proxy that does the same rewrite at property
// access time. Also converts camelCase members (styled.mainButton) to
// kebab-case like the plugin's MemberExpression visitor does.
import { styled as _styled } from '@filbert-js/core';

const toKebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

function callable(fn) {
  return fn;
}

export const styled = new Proxy(callable(_styled), {
  get(target, prop, receiver) {
    if (typeof prop !== 'string') return Reflect.get(target, prop, receiver);
    // Anything already on the function (name/length/etc) passes through.
    if (prop in target) return Reflect.get(target, prop, receiver);
    // `styled.div` → `styled('div')`; `styled.MainButton` → `styled('main-button')`
    return _styled(/[A-Z]/.test(prop) ? toKebab(prop) : prop);
  },
  apply(target, thisArg, args) {
    return Reflect.apply(target, thisArg, args);
  },
});
