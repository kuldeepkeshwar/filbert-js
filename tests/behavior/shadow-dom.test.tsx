// Shadow DOM isolation — filbert can target any DOM root, not just
// document.head. Nobody else does this without hacks.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { styled } from '../helpers/styled';
import { StyleSheetProvider } from '@filbert-js/style-sheet-context';
import { createStylesheet } from '@filbert-js/browser-stylesheet';

describe('Shadow DOM isolation', () => {
  it('attaches the <style> tag to the shadow root, not document.head', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const sheet = createStylesheet({ root: shadow });
    const Btn = styled.button`
      color: red;
    `;

    const mount = document.createElement('div');
    shadow.appendChild(mount);
    const root = createRoot(mount);
    act(() =>
      root.render(
        <StyleSheetProvider stylesheet={sheet}>
          <Btn>x</Btn>
        </StyleSheetProvider>,
      ),
    );

    // The <style> tag lives inside the shadow root, NOT in document.head.
    const shadowStyles = shadow.querySelectorAll('style[data-type="styled-css"]');
    const headStyles = document.head.querySelectorAll('style[data-type="styled-css"]');
    expect(shadowStyles.length).toBeGreaterThanOrEqual(1);
    // Head should NOT have a filbert tag for THIS render (though it may have
    // leftover tags from other tests — only assert on THIS render's styles).
    for (const el of Array.from(headStyles) as HTMLStyleElement[]) {
      const text = (el.textContent || '') + (el.sheet
        ? Array.from(el.sheet.cssRules || []).map((r: CSSRule) => r.cssText).join('')
        : '');
      // Our red-button rule should NOT appear in document.head.
      // (The mount was into shadow → color:red rule lives in shadow.)
      expect(text.indexOf('color:red') === -1 && text.indexOf('color: red') === -1).toBe(true);
    }

    // Cleanup for later tests.
    root.unmount();
    host.remove();
  });

  it('two shadow roots have independent sheets — no bleed', () => {
    const hostA = document.createElement('div');
    const hostB = document.createElement('div');
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);
    const shadowA = hostA.attachShadow({ mode: 'open' });
    const shadowB = hostB.attachShadow({ mode: 'open' });

    const sheetA = createStylesheet({ root: shadowA });
    const sheetB = createStylesheet({ root: shadowB });

    const Red = styled.button`color: red;`;
    const Blue = styled.button`background: blue;`;

    const mountA = document.createElement('div');
    const mountB = document.createElement('div');
    shadowA.appendChild(mountA);
    shadowB.appendChild(mountB);
    const rootA = createRoot(mountA);
    const rootB = createRoot(mountB);
    act(() => {
      rootA.render(
        <StyleSheetProvider stylesheet={sheetA}><Red>a</Red></StyleSheetProvider>,
      );
      rootB.render(
        <StyleSheetProvider stylesheet={sheetB}><Blue>b</Blue></StyleSheetProvider>,
      );
    });

    // A's shadow has the red rule but NOT the blue one.
    const readSheet = (shadow: ShadowRoot): string => {
      const styles = shadow.querySelectorAll('style[data-type="styled-css"]');
      return Array.from(styles)
        .map((el: any) => {
          if (el.sheet && el.sheet.cssRules && el.sheet.cssRules.length)
            return Array.from(el.sheet.cssRules)
              .map((r: any) => r.cssText)
              .join('\n');
          return el.textContent || '';
        })
        .join('\n');
    };
    const aCss = readSheet(shadowA);
    const bCss = readSheet(shadowB);
    expect(aCss).toMatch(/color\s*:\s*red/);
    expect(aCss).not.toMatch(/background\s*:\s*blue/);
    expect(bCss).toMatch(/background\s*:\s*blue/);
    expect(bCss).not.toMatch(/color\s*:\s*red/);

    rootA.unmount(); rootB.unmount();
    hostA.remove(); hostB.remove();
  });
});
