/* F-EDITOR-UX-04 compatibility shim.
   Media, structured graphics and interactive-component editing now live in editor.js.
   This file stays loaded by the current index.html to avoid changing the public loader. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('edit') !== '1') return;
  if (!window.__editorialConsoleV04) return;
  // editor.js already exposes the compatibility surface at window.__editorialAssets.
})();
