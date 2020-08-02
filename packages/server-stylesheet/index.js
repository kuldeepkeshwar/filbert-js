import React from 'react';
import { StyleSheet } from '@filbert-js/stylesheet';
import { StyleSheetProvider } from '@filbert-js/style-sheet-context';
import { createParser } from '@filbert-js/css-parser';
const cssParser = createParser();
class Tag {
  constructor(type) {
    this._type = type;
    this._attributes = [];
    this._children = [];
    this._parent = undefined;
  }
  remove() {
    this._parent && this._parent.removeChild(this);
  }
  setAttribute(name, value) {
    const [attr] = this._attributes.filter((attr) => attr.name === name);
    if (attr) {
      attr.value = value;
    } else {
      this._attributes.push({ name, value });
    }
  }
  getAttribute(name) {
    const [attr] = this._attributes.filter((attr) => attr.name === name);
    if (attr) {
      return attr.value;
    }
  }
  getChildById(id) {
    for (let index = 0; index < this._children.length; index++) {
      const tag = this._children[index];
      const value = tag.getAttribute('id');
      if (value === id) {
        return tag;
      }
    }
    return undefined;
  }
  insertBefore(el, after) {
    const index = this._children.findIndex((item) => item === after);
    this._children.splice(index, 0, el);
  }
  append(child) {
    if (typeof child === 'string') {
      // text node
      this._children.push(child);
    } else {
      this._children.push(child);
      child._parent = this;
    }
  }
  removeChild(child) {
    this._children = this._children.filter((c) => c !== child);
  }
  toString() {
    if (this._type === 'root') {
      return this.toInnerHTML();
    }
    return `<${this._type} ${this._attributes
      .map((attr) => `${attr.name}="${attr.value}"`)
      .join(' ')}>
    ${this.toInnerHTML()}
    </${this._type}>`;
  }
  toInnerHTML() {
    return this._children.map((child) => child.toString()).join('');
  }
  toReactElements() {
    return this._children.map(
      ({ _type: Type, _children, _attributes }, index) => (
        <Type {...toMap(_attributes)} key={index}>
          {_children.map((c) => (c instanceof Tag ? c.toReactElements() : c))}
        </Type>
      ),
    );
  }
}
function toMap(array) {
  return array.reduce((previous, current) => {
    previous[current.name] = current.value;
    return previous;
  }, {});
}
const init = () => {
  const root = new Tag('root');
  function getRoot() {
    return root;
  }
  function createElement(type) {
    return new Tag(type);
  }
  function findElementByStyleId(cls) {
    return undefined;
  }
  return { getRoot, createElement, findElementByStyleId };
};
function collectStyles(stylesheet) {
  return (app) => (
    <StyleSheetProvider stylesheet={stylesheet}>{app}</StyleSheetProvider>
  );
}
export const createStylesheet = (options = {}) => {
  const { getRoot, createElement, findElementByStyleId } = init();
  const sheet = new StyleSheet({
    getRoot,
    createElement,
    findElementByStyleId,
    cssParser,
    ...options,
  });
  const _getStyles = sheet.getStyles;
  sheet.getStyles = function() {
    const { root } = _getStyles.call(this);
    return root.toString();
  };

  sheet.getReactElements = function() {
    const { root } = _getStyles.call(this);
    return root.toReactElements();
  };
  sheet.collectStyles = collectStyles(sheet);
  return sheet;
};
