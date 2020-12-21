import { TYPES_CSS, TYPES_GLOBAL, TYPES_KEYFRAMES } from '@filbert-js/types';

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
  el.isBeforeChild = function (node1, node2) {
    const children = this.children;
    let a = -1,
      b = -1;
    for (let index = 0; index < children.length; index++) {
      const element = children[index];
      if (element === node1) {
        b = index;
      }
      if (element === node2) {
        a = index;
      }
    }
    return a < b;
  };
  return el;
}
const init = () => {
  const root = isBrowser() ? overrides(document.head) : undefined;
  const css = {
    [TYPES_GLOBAL]: {},
    [TYPES_CSS]: {},
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
