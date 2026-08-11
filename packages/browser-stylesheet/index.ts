// Host adapter: wires StyleSheet up to a DOM root (document.head by default)
// + native <style> tags. Accepts a `root` option so callers can target a
// Shadow Root, an iframe's head, or any other Element / DocumentFragment.
//
//   // Inside a Web Component's connectedCallback:
//   const shadow = this.attachShadow({ mode: 'open' });
//   const sheet = createStylesheet({ root: shadow });
//   ReactDOM.createRoot(shadow).render(
//     <StyleSheetProvider stylesheet={sheet}><App /></StyleSheetProvider>
//   );
import { StyleSheet, type StyleSheetAPI } from '@filbert-js/stylesheet';
import { createParser } from '@filbert-js/css-parser';

const cssParser = createParser();
const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

// `root` accepts anything that has an `.append(child)` — real DOM Elements,
// Shadow Roots, DocumentFragments.
export interface BrowserStyleSheetOptions {
  root?: Element | ShadowRoot | DocumentFragment;
}

function ownerDoc(root?: Element | ShadowRoot | DocumentFragment | null): Document | null {
  if (!root) return typeof document !== 'undefined' ? document : null;
  const owner = (root as any).ownerDocument;
  return owner || (typeof document !== 'undefined' ? document : null);
}

export const createStylesheet = (options: BrowserStyleSheetOptions = {}): StyleSheetAPI => {
  const providedRoot = options.root;
  const host = isBrowser()
    ? {
        getRoot: () => (providedRoot || document.head) as any,
        createElement: (type: string) =>
          (ownerDoc(providedRoot) || document).createElement(type) as any,
      }
    : {
        // Non-browser env with no explicit root — minimal shim so StyleSheet
        // doesn't crash. Real SSR should use server-stylesheet.
        getRoot: () => ({ append: () => {} } as any),
        createElement: () => ({ append: () => {}, setAttribute: () => {} } as any),
      };
  return StyleSheet({
    ...host,
    cssParser,
  });
};
