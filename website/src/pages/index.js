import React from 'react';
const isBrowser = () => ![typeof window, typeof document].includes('undefined');
if (isBrowser()) {
  window.location = '/docs/introduction';
}
export default () => (
  <div>
    <div>loading..</div>
    <div>redirecting you to https://filbert-js.vercel.app</div>
  </div>
);
