# LoRA Info Popup — Draggable, Resizable, Session-Persistent

**Date:** 2026-04-18
**File:** `web/ext.js`

## Goal

Make the LoRA Info metadata popup draggable and resizable, with position and size remembered for the duration of the browser session (resets on page refresh).

## State

One module-level variable added:

```js
let _metaPopupGeo = null;  // { left, top, width, height } | null
```

Written on drag-end and resize-end. Never persisted to storage.

## Positioning

`positionMetaPopup(boxEl)` is updated:

1. If `_metaPopupGeo` is set, apply `left/top/width/height` from it, clamped so at least 40px of the popup remains on-screen. Return early.
2. If `_metaPopupGeo` is null, run the existing auto-position logic unchanged (to the right of the main modal, or inset if no room).

## Drag

- CSS: `cursor: move` added to `.ell-meta-popup-header`.
- In `buildMetaPopup()`, attach a `pointerdown` listener to the header.
  - Ignore clicks on `.ell-meta-popup-close`.
  - Set pointer capture; `pointermove` updates `metaPopupEl.style.left/top`.
  - `pointerup` removes listeners and writes final `left/top` into `_metaPopupGeo` (preserving current `width/height`).
- Pattern: identical to existing `makeDraggable()` used by the main modal.

## Resize

- New CSS class `.ell-meta-resize-handle`: absolute bottom-right, `cursor: se-resize`, same diagonal-stripe visual as `.ell-resize-handle`.
- In `buildMetaPopup()`, append a `div.ell-meta-resize-handle` to `metaPopupEl`.
- Attach `pointerdown` on the handle:
  - `pointermove` updates `metaPopupEl.style.width/height`, clamped to min 200×150px.
  - `pointerup` removes listeners and writes final `left/top/width/height` into `_metaPopupGeo`.
- Pattern: identical to existing `makeResizable()` used by the main modal.

## Constraints

| Property | Min |
|----------|-----|
| width    | 200px |
| height   | 150px |

No maximum — browser viewport edge is the practical limit.

## What does not change

- Auto-position logic (used only when no saved geo exists).
- Tab state, fetch logic, render logic — untouched.
- Main modal drag/resize — untouched.
