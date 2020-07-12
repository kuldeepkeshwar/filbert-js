import {
  RAW,
  TYPES_GLOBAL,
  TYPES_KEYFRAMES,
  TYPES_STYLES,
} from '@filbert-js/types';

export function StyleSheet({
  getRoot,
  createElement,
  findElementByStyleId,
  cssParser,
  css,
}) {
  const _css = css || {
    [TYPES_GLOBAL]: {},
    [TYPES_STYLES]: {},
    [TYPES_KEYFRAMES]: {},
  };
  const root = getRoot();
  function createStyleTag(id, styleType, label) {
    const el = createElement('style');
    [
      ['data-type', 'styled-css'],
      ['id', id],
      ['styled-type', styleType],
      ['styled-component-type', label],
    ].forEach(([key, value]) => value && el.setAttribute(key, value));
    return el;
  }
  function createStyles(id, css, sourceOrder, label) {
    if (!_css[TYPES_STYLES][id]) {
      const el = createStyleTag(id, TYPES_STYLES, label);
      const styles = cssParser({ css, namespace: `.${id}` });
      el.append(styles);
      _css[TYPES_STYLES][id] = styles;

      // ensure source order
      if (sourceOrder) {
        root.insertBefore(el, root.getChildById(sourceOrder));
      } else {
        root.append(el);
      }
    } else {
      // ensure source order
      if (sourceOrder) {
        const el = root.getChildById(id);
        root.insertBefore(el, root.getChildById(sourceOrder));
      }
    }
  }
  function createKeyframes(keyframe) {
    if (!_css[TYPES_KEYFRAMES][keyframe]) {
      const el = createStyleTag(keyframe, TYPES_KEYFRAMES);
      const styles = `@keyframes ${keyframe} {${keyframe[RAW]}}`;
      el.append(styles);
      root.append(el);
      _css[TYPES_KEYFRAMES][keyframe] = styles;
    }
  }
  function createGlobalStyles(id, styles) {
    if (!_css[TYPES_GLOBAL][id]) {
      const el = createStyleTag(id, TYPES_GLOBAL);
      const classBlock = styles.trim();
      el.append(classBlock);
      _css[TYPES_GLOBAL][id] = classBlock;
      root.append(el);
    } else {
      const el = root.getChildById(id);
      const classBlock = styles.trim();

      el.append(classBlock);
      _css[TYPES_GLOBAL][id] = classBlock;
    }
  }
  function removeStyles(hash, type) {
    if (TYPES_STYLES === type && _css[type][hash]) {
      const elUsingCls = findElementByStyleId(hash);
      if (!elUsingCls) {
        delete _css[type][hash];
        root.getChildById(hash).remove();
      }
    } else if (TYPES_GLOBAL === type) {
      delete _css[type][hash];
      root.getChildById(hash).remove();
    }
  }
  function getStyles() {
    return { root, css: _css };
  }

  return {
    getStyles,
    createStyles,
    createKeyframes,
    createGlobalStyles,
    removeStyles,
  };
}
