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
    el.setAttribute('data-type', 'styled-css');
    el.setAttribute('id', id);
    el.setAttribute('styled-type', styleType);
    label && el.setAttribute('styled-component-type', label);
    return el;
  }
  function createStyles(id, css, sourceAfter, label) {
    if (!_css[TYPES_STYLES][id]) {
      const el = createStyleTag(id, TYPES_STYLES, label);
      const classBlock = cssParser({ css, namespace: `.${id}` });
      el.append(classBlock);
      _css[TYPES_STYLES][id] = classBlock;

      // ensure source order
      if (sourceAfter) {
        root.insertBefore(el, root.getChildById(sourceAfter));
      } else {
        root.append(el);
      }
    } else {
      // ensure source order
      if (sourceAfter) {
        const el = root.getChildById(id);
        root.insertBefore(el, root.getChildById(sourceAfter));
      }
    }
  }
  function createKeyframes(keyframe) {
    if (!_css[TYPES_KEYFRAMES][keyframe]) {
      const el = createStyleTag(keyframe, TYPES_KEYFRAMES);
      const classBlock = `@keyframes ${keyframe} {${keyframe[RAW]}}`;
      el.append(classBlock);
      root.append(el);
      _css[TYPES_KEYFRAMES][keyframe] = classBlock;
    }
  }
  function createGlobalStyles(id, css) {
    if (!_css[TYPES_GLOBAL][id]) {
      const el = createStyleTag(id, TYPES_GLOBAL);
      const classBlock = css.trim();
      el.append(classBlock);
      _css[TYPES_GLOBAL][id] = classBlock;
      root.append(el);
    } else {
      const el = root.getChildById(id);
      const classBlock = css.trim();

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
