import { TYPES_GLOBAL, TYPES_KEYFRAMES, TYPES_STYLES } from '@filbert-js/types';

import { StyleSheet } from '@filbert-js/stylesheet';
import { createParser } from '@filbert-js/css-parser';

const cssParser = createParser();
const isBrowser = () => ![typeof window, typeof document].includes('undefined');

function overrides(el) {
  const orgAppend = el.append;
  el.append = function append(child) {
    if (typeof child === 'string') {
      // text node
      el.textContent = child;
    } else {
      orgAppend.call(el, child);
    }
  };
  el.getChildById = function getChildById(id) {
    return document.getElementById(id);
  };
  return el;
}
const init = () => {
  const root = isBrowser() ? overrides(document.head) : null;
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
    return overrides(document.createElement(type));
  }
  function findElementByStyleId(cls) {
    return document.querySelector('.' + cls);
  }
  return { getRoot, createElement, findElementByStyleId, css };
};

export const createStylesheet = (options = {}) => {
  const { getRoot, createElement, findElementByStyleId, css } = init();
  return new StyleSheet({
    getRoot,
    createElement,
    findElementByStyleId,
    cssParser,
    css,
    ...options,
  });
};
