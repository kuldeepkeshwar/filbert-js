import { TYPES_GLOBAL, TYPES_KEYFRAMES, TYPES_STYLES } from '@filbert-js/types';

import { StyleSheet } from '@filbert-js/stylesheet';
import { cssParser } from '@filbert-js/css-parser';

const isBrowser = () => ![typeof window, typeof document].includes('undefined');
class Tag {
  constructor(type, native) {
    this._el = native || document.createElement(type);
  }
  remove() {
    return this._el.remove();
  }
  setAttribute(name, value) {
    return this._el.setAttribute(name, value);
  }
  getAttribute(name) {
    return this._el.getAttribute(name);
  }
  getChildById(id) {
    return new Tag(null, document.getElementById(id));
  }
  insertBefore(el, after) {
    const _el = el instanceof Tag ? el._el : el;
    const _after = after instanceof Tag ? after._el : after;
    return this._el.insertBefore(_el, _after);
  }
  append(child) {
    if (typeof child === 'string') {
      // text node
      this._el.textContent = child;
    } else if (child instanceof Tag) {
      this._el.append(child._el);
    } else {
      this._el.append(child);
    }
  }
}
const init = () => {
  const root = isBrowser() ? new Tag(null, document.head) : null;
  const css = {
    [TYPES_GLOBAL]: {},
    [TYPES_STYLES]: {},
    [TYPES_KEYFRAMES]: {},
  };
  if (isBrowser()) {
    Array.from(document.querySelectorAll('[data-type="styled-css"]')).reduce(
      (agg, el) => {
        const id = el.getAttribute('id');
        const type = el.getAttribute('styled-type');
        agg[type][id] = el.textContent;
        return agg;
      },
      css,
    );
  }

  function getRoot() {
    return root;
  }
  function createElement(type) {
    return new Tag(type);
  }
  function findElementByStyleId(cls) {
    return document.querySelector('.' + cls);
  }
  return { getRoot, createElement, findElementByStyleId, css };
};

export const createStylesheet = () => {
  const { getRoot, createElement, findElementByStyleId, css } = init();
  return new StyleSheet({
    getRoot,
    createElement,
    findElementByStyleId,
    cssParser,
    css,
  });
};
