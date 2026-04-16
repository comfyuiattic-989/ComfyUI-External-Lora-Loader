# File Browser — Windows Explorer Style Redesign

**Date:** 2026-04-16
**Scope:** `web/ext.js` only
**Goal:** Replace the D3 horizontal tidy-tree dialog with a single-pane indented tree that looks and behaves like the Windows Explorer left-panel tree.

---

## Visual Structure

Each visible tree node renders as a single `<div class="ell-row">` line:

```
[padding-left: depth × 16px] [arrow] [icon] [label]
```

| Element | Detail |
|---------|--------|
| Indent  | `padding-left: depth * 16px`. Drives are depth 0. |
| Arrow   | `▶` collapsed folder/drive, `▼` expanded, invisible spacer (`\u00a0`) for files. |
| Icon    | `🖴` drive, `📁` closed folder, `📂` open folder, `📄` file. |
| Label   | Node name in system-ui font, ~13px. |
| Row height | 22px line-height, full-width. |
| Hover   | Subtle background tint. |
| Selected file | Blue highlight background + white text (Explorer style). |

Indent guide lines (thin left-border on each depth level) are included.

---

## Behavior

### Expand / Collapse
- Click any drive or folder row to toggle.
- On first expand: fetch `/external_lora/browse` with `{drive, path}`, populate children, then render.
- Subsequent clicks toggle between `children` (visible) and `_children` (stashed) — same pattern as today.
- Status text in footer shows "Loading…" during fetch, "Error loading" on failure.

### File Selection
- Click a file row: highlight it, store in `browserState`, enable Select button, show filename in footer status.
- Double-click a file row: select and commit (same as clicking Select).
- Enter key while a file is highlighted: commit selection. Handled by extending the existing `onKeyDown` document listener (which already handles Escape) to also call `commitSelection()` when `browserState.selectedFile` is set.

### Auto-expand on Open
- If `driveWidget.value` is set when the dialog opens, walk the tree data to expand the saved path and highlight the saved file — same logic as existing `autoExpandD3ToPath`, rewritten without D3 hierarchy objects.

### Keyboard / Close
- Escape key: close without committing.
- `×` button: close without committing.
- Select button: commit `drive`, `sub_path`, `lora_name` to hidden widgets then close.

---

## CSS

Remove all existing D3/SVG-related rules (`.ell-tree-container svg text`).

Add:

| Class | Purpose |
|-------|---------|
| `.ell-row` | Full-width flex row, 22px height, cursor pointer, `white-space: nowrap`, `overflow: hidden` |
| `.ell-row:hover` | Subtle background highlight |
| `.ell-row-selected` | Blue background + white text |
| `.ell-row-arrow` | Fixed-width (~14px) inline-block, text-align center |
| `.ell-row-icon` | Fixed-width (~18px) inline-block |
| `.ell-row-label` | Flex 1, `overflow: hidden`, `text-overflow: ellipsis` |

`.ell-tree-container` keeps its existing scroll + padding rules.

---

## Code Changes — `web/ext.js`

### Remove
- `loadD3()` function and `_d3` module-level variable
- `_d3` import call inside `openFileBrowser()`
- `buildD3Tree()` (~130 lines)
- `rebuildAndUpdate()` (both the outer function and the inner `_rebuildImpl`)
- Module-level variables: `_d3root`, `_d3update`, `_idCounter`, `_activeRebuild`
- `_nextId()` helper
- `clearFileSelection()` — replaced by a simple recursive flag reset inside `renderTree`

### Keep (with edits)
- `browserState`, `treeRootData`
- Lazy-load fetch block inside `onNodeClick` (folder/drive branch) — remove `rebuildAndUpdate()` call, replace with `renderTree()`
- File selection block inside `onNodeClick` — same, replace `rebuildAndUpdate()` with `renderTree()`
- `autoExpandD3ToPath` — remove D3 hierarchy calls, call `renderTree()` at the end
- All modal chrome: `buildModal()`, `makeDraggable()`, `makeResizable()`, `positionModal()`, `openFileBrowser()`, `closeModal()`, `commitSelection()`
- `_idCounter` / `_nextId` — keep both; they're plain JS counters with no D3 dependency, still needed to assign stable `_id` values to new nodes during lazy load

### Add
```
function renderTree()
```
- Clears `treeContainerEl.innerHTML`
- Recursively walks `treeRootData.children` (drives), then each drive's visible subtree
- For each visible node, creates a `.ell-row` div with arrow, icon, label
- Attaches a `click` handler calling `onNodeClick`
- Attaches a `dblclick` handler on file rows that calls `commitSelection()`

---

## Data Model

No change. The existing plain-object tree (`{name, type, drive, segments, _loaded, children, _children, _selected, _id}`) is retained exactly. D3 hierarchy wrappers are never constructed.

---

## Out of Scope
- Sorting (dirs before files is already the server's responsibility)
- Search / filter
- Context menus
- Multiple selection
