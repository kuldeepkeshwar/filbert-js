---
"babel-plugin-filbert": patch
"@filbert-js/core": patch
"@filbert-js/website": patch
---

- Prepend #__PURE__ comment to help minifiers with dead code elimination (=DCE)
- Remove `StyleSheetContext` from `styled` api
- Refactored website(sidebar)
