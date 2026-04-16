# File Browser — Windows Explorer Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the D3 horizontal tidy-tree file browser with a plain-HTML indented tree that looks and behaves like the Windows Explorer left-panel tree view.

**Architecture:** All changes are confined to `web/ext.js`. The D3 dependency, `buildD3Tree()`, and both `rebuildAndUpdate()` implementations are deleted. A new `renderTree()` function walks the existing plain-object tree data and emits `<div>` rows with indent, arrow, icon, and label. `onNodeClick` is re-signed from `(event, d3Node, update)` to `(event, data)` and calls `renderTree()` instead of `rebuildAndUpdate()`. `openFileBrowser()` drops the `loadD3()` call and calls `renderTree()` after loading drives.

**Tech Stack:** Vanilla JS, CSS custom properties (already used by the project). No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `web/ext.js` | All changes — see tasks below |

---

### Task 1: Update CSS in `injectStyles()`

**Files:**
- Modify: `web/ext.js:24-86`

- [ ] **Step 1: Replace the `style.textContent` block**

Replace the entire string assigned to `style.textContent` (lines 24–86) with:

```javascript
    style.textContent = `
        .ell-modal-overlay {
            position: fixed; inset: 0;
            z-index: 9999;
        }
        .ell-modal-box {
            position: fixed;
            background: var(--comfy-menu-bg, #353535);
            border-radius: 8px;
            box-shadow: 0 4px 32px rgba(0,0,0,0.6);
            display: flex; flex-direction: column;
            overflow: hidden;
        }
        .ell-modal-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 10px 14px;
            border-bottom: 1px solid var(--border-color, #4e4e4e);
            font-weight: bold; color: var(--fg-color, #fff);
            cursor: move;
            flex-shrink: 0;
            user-select: none;
        }
        .ell-modal-close {
            background: none; border: none; color: var(--fg-color, #fff);
            cursor: pointer; font-size: 18px; line-height: 1; padding: 2px 6px;
        }
        .ell-modal-body {
            display: flex; flex: 1; min-height: 0; overflow: hidden;
        }
        .ell-tree-container {
            flex: 1; overflow: auto; padding: 4px 0;
            background: var(--comfy-input-bg, #1a1a1a);
            font-family: system-ui, sans-serif;
            font-size: 13px;
        }
        .ell-row {
            display: flex; align-items: center;
            height: 22px; line-height: 22px;
            cursor: pointer;
            white-space: nowrap;
            color: var(--fg-color, #ddd);
            border: 1px solid transparent;
            box-sizing: border-box;
        }
        .ell-row:hover {
            background: rgba(255,255,255,0.07);
        }
        .ell-row-selected {
            background: #0078d4;
            color: #fff;
        }
        .ell-row-selected:hover {
            background: #1084d8;
        }
        .ell-row-arrow {
            display: inline-block;
            width: 14px; text-align: center;
            flex-shrink: 0;
            font-size: 9px;
            color: var(--input-text, #aaa);
        }
        .ell-row-selected .ell-row-arrow { color: #fff; }
        .ell-row-icon {
            display: inline-block;
            width: 20px; text-align: center;
            flex-shrink: 0;
        }
        .ell-row-label {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            padding-right: 8px;
        }
        .ell-modal-footer {
            display: flex; justify-content: space-between; align-items: center;
            padding: 8px 14px;
            border-top: 1px solid var(--border-color, #4e4e4e);
            flex-shrink: 0;
        }
        .ell-status-text { font-size: 12px; color: var(--input-text, #aaa); }
        .ell-select-btn {
            padding: 5px 18px; border-radius: 4px;
            background: var(--comfy-input-bg, #444); color: var(--fg-color, #fff);
            border: 1px solid var(--border-color, #4e4e4e); cursor: pointer;
        }
        .ell-select-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ell-resize-handle {
            position: absolute; right: 0; bottom: 0;
            width: 16px; height: 16px; cursor: se-resize;
            background: linear-gradient(135deg,
                transparent 50%,
                var(--border-color, #666) 50%, var(--border-color, #666) 60%,
                transparent 60%, transparent 70%,
                var(--border-color, #666) 70%, var(--border-color, #666) 80%,
                transparent 80%);
            opacity: 0.6;
        }
    `;
```

- [ ] **Step 2: Verify the edit by reading lines 24–90 of `web/ext.js`**

Confirm: no `.ell-tree-container svg text` rule exists; all new `.ell-row*` rules are present.

- [ ] **Step 3: Commit**

```bash
git add web/ext.js
git commit -m "style: replace D3 SVG CSS with Explorer-style row CSS"
```

---

### Task 2: Add `renderTree()` function

**Files:**
- Modify: `web/ext.js` — insert after the `clearFileSelection` function (currently around line 208)

- [ ] **Step 1: Insert `renderTree()` after `clearFileSelection()`**

The existing `clearFileSelection` function ends around line 212. Insert the new function immediately after it:

```javascript
        // --- renderTree: rebuild the Explorer-style tree DOM ---
        function renderTree() {
            if (!treeContainerEl || !treeRootData) return;
            treeContainerEl.innerHTML = "";

            function renderNode(data, depth) {
                const isFile  = data.type === "file";
                const isDrive = data.type === "drive";

                const row = document.createElement("div");
                row.className = "ell-row" + (data._selected ? " ell-row-selected" : "");
                row.style.paddingLeft = (depth * 16 + 4) + "px";

                // Arrow: ▶ collapsed, ▼ expanded, space for files
                const arrow = document.createElement("span");
                arrow.className = "ell-row-arrow";
                if (isFile) {
                    arrow.textContent = "\u00a0";
                } else {
                    arrow.textContent = data.children !== null ? "\u25bc" : "\u25b6";
                }

                // Icon
                const icon = document.createElement("span");
                icon.className = "ell-row-icon";
                if (isDrive)     icon.textContent = "\uD83D\uDDB4"; // 🖴
                else if (isFile) icon.textContent = "\uD83D\uDCC4"; // 📄
                else             icon.textContent = data.children !== null ? "\uD83D\uDCC2" : "\uD83D\uDCC1"; // 📂 / 📁

                // Label
                const label = document.createElement("span");
                label.className = "ell-row-label";
                label.textContent = data.name;

                row.appendChild(arrow);
                row.appendChild(icon);
                row.appendChild(label);

                row.addEventListener("click", (e) => onNodeClick(e, data));
                if (isFile) {
                    row.addEventListener("dblclick", async (e) => {
                        await onNodeClick(e, data);
                        commitSelection();
                    });
                }

                treeContainerEl.appendChild(row);

                // Recurse into expanded children
                if (data.children) {
                    for (const child of data.children) {
                        renderNode(child, depth + 1);
                    }
                }
            }

            for (const drive of (treeRootData.children || [])) {
                renderNode(drive, 0);
            }
        }
```

- [ ] **Step 2: Verify by reading the inserted block**

Confirm `renderTree` is present, references `treeContainerEl`, `treeRootData`, `onNodeClick`, and `commitSelection`.

- [ ] **Step 3: Commit**

```bash
git add web/ext.js
git commit -m "feat: add renderTree() — plain HTML Explorer-style tree renderer"
```

---

### Task 3: Rewrite `onNodeClick` to use plain data objects

**Files:**
- Modify: `web/ext.js:232-305`

`onNodeClick` currently takes `(event, d, update)` where `d` is a D3 node wrapper. After this task it takes `(event, data)` where `data` is the plain object directly.

- [ ] **Step 1: Replace the entire `onNodeClick` function**

Replace from `async function onNodeClick(event, d, update) {` through the closing `}` (lines 232–305) with:

```javascript
        // --- onNodeClick: file select or folder lazy-load + toggle ---
        async function onNodeClick(event, data) {
            if (data.type === "file") {
                clearFileSelection(treeRootData);
                data._selected = true;
                browserState.drive = data.drive;
                browserState.pathSegments = data.segments.slice(0, -1);
                browserState.selectedFile = data.name;
                if (selectBtn) { selectBtn.disabled = false; selectBtn.textContent = "Select"; }
                if (statusEl) statusEl.textContent = data.name;
                renderTree();
                return;
            }

            // Folder / drive — lazy load on first expand, then toggle
            if (!data._loaded) {
                if (statusEl) statusEl.textContent = "Loading\u2026";
                const path = data.segments.join("/");
                try {
                    const resp = await fetch("/external_lora/browse", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ drive: data.drive, path }),
                    });
                    const json = await resp.json();
                    data._loaded = true;
                    const dirs  = json.dirs  || [];
                    const files = json.files || [];
                    data.children = [
                        ...dirs.map(name => ({
                            name, type: "dir", drive: data.drive,
                            segments: [...data.segments, name],
                            _loaded: false, children: null, _children: null,
                            _id: _nextId(), _selected: false
                        })),
                        ...files.map(name => ({
                            name, type: "file", drive: data.drive,
                            segments: [...data.segments, name],
                            _loaded: true, children: null, _children: null,
                            _id: _nextId(), _selected: false
                        })),
                    ];
                    data._children = null;
                    if (statusEl) statusEl.textContent = "";
                } catch {
                    if (statusEl) statusEl.textContent = "Error loading";
                    return;
                }
            } else {
                // Toggle expand/collapse
                if (data.children !== null) {
                    data._children = data.children;
                    data.children = null;
                } else {
                    data.children = data._children || [];
                    data._children = null;
                }
            }

            renderTree();
        }
```

- [ ] **Step 2: Verify by reading the replaced block**

Confirm: function signature is `(event, data)`, no references to `d.data`, `d.children`, or `rebuildAndUpdate`.

- [ ] **Step 3: Commit**

```bash
git add web/ext.js
git commit -m "refactor: rewrite onNodeClick to use plain data objects, call renderTree"
```

---

### Task 4: Update `autoExpandD3ToPath` to call `renderTree()`

**Files:**
- Modify: `web/ext.js:473-530`

The function body is correct except the final call `rebuildAndUpdate()` must become `renderTree()`.

- [ ] **Step 1: Replace the `rebuildAndUpdate()` call at the end of `autoExpandD3ToPath`**

Find (near line 529):
```javascript
            rebuildAndUpdate();
        }
```

Replace with:
```javascript
            renderTree();
        }
```

Make sure this is the closing line of `autoExpandD3ToPath` and not inside another function.

- [ ] **Step 2: Verify**

Read `autoExpandD3ToPath` from its opening line to its closing `}`. Confirm no remaining `rebuildAndUpdate` calls.

- [ ] **Step 3: Commit**

```bash
git add web/ext.js
git commit -m "refactor: autoExpandD3ToPath — swap rebuildAndUpdate for renderTree"
```

---

### Task 5: Rewrite `openFileBrowser()` — remove D3, call `renderTree()`

**Files:**
- Modify: `web/ext.js:657-733`

- [ ] **Step 1: Replace the entire `openFileBrowser` function**

Replace from `async function openFileBrowser() {` through its closing `}` (lines 657–733) with:

```javascript
        // --- openFileBrowser() ---
        async function openFileBrowser() {
            buildModal();
            modalOverlay.style.display = "block";
            positionModal();

            if (onKeyDown) { document.removeEventListener("keydown", onKeyDown); onKeyDown = null; }
            onKeyDown = (e) => {
                if (e.key === "Escape") closeModal();
                else if (e.key === "Enter" && browserState.selectedFile) commitSelection();
            };
            document.addEventListener("keydown", onKeyDown);

            browserState.selectedFile = null;
            if (selectBtn) { selectBtn.disabled = true; selectBtn.textContent = "Select"; }
            if (statusEl) statusEl.textContent = "Loading drives\u2026";

            try {
                const resp = await fetch("/external_lora/browse", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                });
                const data = await resp.json();
                const drives = data.dirs || [];

                treeRootData = {
                    name: "root", type: "root", drive: "", segments: [],
                    _loaded: true, _id: _nextId(), _selected: false,
                    children: drives.map(d => ({
                        name: d, type: "drive", drive: d, segments: [],
                        _loaded: false, children: null, _children: null,
                        _id: _nextId(), _selected: false
                    }))
                };

                if (statusEl) statusEl.textContent = "";
                renderTree();

                const savedDrive = driveWidget.value || "";
                const savedPath  = subPathWidget.value || "";
                const savedFile  = loraNameWidget.value !== "none" ? loraNameWidget.value : null;
                if (savedDrive) {
                    const segs = savedPath ? savedPath.split(/[/\\]/).filter(Boolean) : [];
                    await autoExpandD3ToPath(savedDrive, segs, savedFile);
                }
            } catch {
                if (statusEl) statusEl.textContent = "Failed to load drives";
            }
        }
```

Note: the `onKeyDown` Enter handler is now inline here (no separate task needed).

- [ ] **Step 2: Verify**

Read the replaced block. Confirm: no `loadD3()`, no `buildD3Tree()`, no `_d3root`, no `_rebuildImpl`, no `_activeRebuild` assignment. Confirm `renderTree()` is called after building `treeRootData`.

- [ ] **Step 3: Commit**

```bash
git add web/ext.js
git commit -m "refactor: openFileBrowser — remove D3, call renderTree, add Enter key commit"
```

---

### Task 6: Remove all D3 infrastructure

**Files:**
- Modify: `web/ext.js` — delete dead code

After Tasks 1–5 the following are unreferenced. Delete them in this order to avoid confusion.

- [ ] **Step 1: Delete `loadD3()` and the `_d3` module variable (lines 10–16)**

Remove:
```javascript
// D3 module cached at module level so it only loads once per page
let _d3 = null;
async function loadD3() {
    if (_d3) return _d3;
    _d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
    return _d3;
}
```

- [ ] **Step 2: Delete `buildD3Tree()` — approximately lines 307–470**

The function starts with `// --- buildD3Tree: render horizontal tidy tree with D3 ---` and ends with its closing `}`. Delete the entire block including the comment.

- [ ] **Step 3: Delete the two `rebuildAndUpdate()` implementations and `_activeRebuild`**

The first `rebuildAndUpdate` definition (using `_d3root`, `_d3update`) is around lines 215–229 — delete it.

The second (the outer dispatcher) is the large block starting with `// Active rebuild implementation` around lines 735–760 — delete it and the `let _activeRebuild = null;` line above it.

- [ ] **Step 4: Delete dead closure variables inside `nodeCreated`**

Remove only `_d3root` and `_d3update` declarations:
```javascript
        let _d3root = null;
        let _d3update = null;
```

**Keep** all of the following — they are still used after the refactor:
- `let treeRootData = null;` — used by `renderTree` and `openFileBrowser`
- `let _idCounter = 0;` and `function _nextId()` — used in `onNodeClick` lazy-load to assign `_id` to new nodes
- `function clearFileSelection(n)` — called in `onNodeClick` (file branch) and `autoExpandD3ToPath`

- [ ] **Step 5: Verify no remaining D3 references**

Search `web/ext.js` for: `_d3`, `loadD3`, `buildD3Tree`, `rebuildAndUpdate`, `_activeRebuild`, `_d3root`, `_d3update`, `cdn.jsdelivr.net`.

Expected findings: none.

Note: the letter sequence `d3` will appear in `drives.map(d =>` and similar — those are fine local variable names, not D3 library references.

- [ ] **Step 6: Commit**

```bash
git add web/ext.js
git commit -m "chore: remove D3 dependency and all D3 infrastructure"
```

---

### Task 7: Smoke-test the full dialog flow

There is no automated test runner for this frontend. Verification is by inspection.

- [ ] **Step 1: Read `web/ext.js` from top to bottom**

Check for:
- No syntax errors (mismatched braces, stray commas)
- `renderTree` is defined before `onNodeClick` and before `autoExpandD3ToPath`
- `onNodeClick` signature is `(event, data)` — not `(event, d, update)`
- `openFileBrowser` calls `renderTree()` and not `buildD3Tree`
- `autoExpandD3ToPath` calls `renderTree()` at the end
- `onKeyDown` handles both Escape and Enter

- [ ] **Step 2: Check `injectStyles()` CSS is valid**

Read the `style.textContent` block. Confirm every `{` has a matching `}` and no rule references removed classes (`.ell-tree-container svg text` must be gone).

- [ ] **Step 3: Final commit if any stray fixes were needed**

```bash
git add web/ext.js
git commit -m "fix: post-refactor cleanup from smoke-test read"
```

Skip this step if no changes were made.
