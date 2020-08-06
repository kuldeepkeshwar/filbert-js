# @filbert-js/website

## 0.0.10

### Patch Changes

- 4affc53: remove pragma annotation dependency

## 0.0.9

### Patch Changes

- 002e3f5: - Prepend #**PURE** comment to help minifiers with dead code elimination (=DCE)
  - Remove `StyleSheetContext` from `styled` api
  - Refactored website(sidebar)
- Updated dependencies [002e3f5]
  - @filbert-js/core@0.0.8

## 0.0.8

### Patch Changes

- 28ecee8: - Add `babel-plugin-filbert`/ `gatsby-browser.js` to `gatsby-plugin-filbert`
  - remove `babel-plugin-filbert`/ `gatsby-browser.js` from `website`
  - Fix `jsx` API: handle null `props` case & `children`
- Updated dependencies [28ecee8]
  - @filbert-js/core@0.0.7

## 0.0.7

### Patch Changes

- 9965e28: Make Gatsby plugin filbert work.
  - move `packages/gatsby-plugin-filbert/src/gatsby-ssr.js` to `packages/gatsby-plugin-filbert/gatsby-ssr.js` for gatsby to resolve plugin.
- Updated dependencies [9965e28]
  - gatsby-plugin-filbert@0.0.6

## 0.0.6

### Patch Changes

- Updated dependencies [fa304df]
  - @filbert-js/core@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies [0ef9584]
  - @filbert-js/core@0.0.5
  - @filbert-js/autoprefixer@0.0.5
  - @filbert-js/browser-stylesheet@0.0.5
  - @filbert-js/css-parser@0.0.5
  - gatsby-plugin-filbert@0.0.5
  - @filbert-js/style-sheet-context@0.0.5
