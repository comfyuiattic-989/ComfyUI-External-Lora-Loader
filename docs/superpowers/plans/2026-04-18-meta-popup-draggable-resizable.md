# LoRA Info Popup — Draggable, Resizable, Session-Persistent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the LoRA Info metadata popup draggable and resizable, with position/size remembered for the browser session.

**Architecture:** All changes are in `web/ext.js`. A module-level `_metaPopupGeo` variable stores `{ left, top, width, height }` and is written on every drag/resize end. `positionMetaPopup` uses it when set; otherwise falls back to existing auto-position logic. Drag is wired to the popup header; resize to a new handle div in the bottom-right corner. Both patterns mirror the existing main-modal implementations in the same file.

**Tech Stack:** Vanilla JS, Pointer Events API, CSS custom properties (already in use)

---

### Task 1: Add `_metaPopupGeo` state and `_saveMetaPopupGeo` helper

**Files:**
- Modify: `web/ext.js` (module-level state block ~line 251, and just before `buildMetaPopup` ~line 285)

- [ ] **Step 1: Add module-level variable**

In `web/ext.js`, find the line:
```js
let _metaFetchSeq  = 0;
```
Add one line immediately after it:
```js
let _metaPopupGeo  = null;
```

- [ ] **Step 2: Add `_saveMetaPopupGeo` helper**

Find the line:
```js
function buildMetaPopup() {
```
Insert the following function immediately before it:
```js
function _saveMetaPopupGeo() {
    if (!metaPopupEl) return;
    _metaPopupGeo = {
        left:   parseInt(metaPopupEl.style.left,   10),
        top:    parseInt(metaPopupEl.style.top,    10),
        width:  parseInt(metaPopupEl.style.width,  10),
        height: parseInt(metaPopupEl.style.height, 10),
    };
}

```

- [ ] **Step 3: Commit**

```bash
git add web/ext.js
git commit -m "feat: add _metaPopupGeo state and _saveMetaPopupGeo helper"
```

---

### Task 2: Update `positionMetaPopup` to use saved geometry

**Files:**
- Modify: `web/ext.js` (`positionMetaPopup` function)

- [ ] **Step 1: Replace the function body**

Find the entire function:
```js
function positionMetaPopup(boxEl) {
    if (!metaPopupEl || !boxEl) return;
    const rect = boxEl.getBoundingClientRect();
    const popW = 280;
    const gap  = 8;
    const vpW  = window.innerWidth;

    let left;
    if (rect.right + gap + popW <= vpW) {
        left = rect.right + gap;
        metaPopupEl.style.opacity = "1";
    } else {
        left = Math.max(rect.right - popW - 4, rect.left);
        metaPopupEl.style.opacity = "0.96";
    }
    const headerH = 41, footerH = 46;
    metaPopupEl.style.left   = left + "px";
    metaPopupEl.style.top    = (rect.top + headerH) + "px";
    metaPopupEl.style.width  = popW + "px";
    metaPopupEl.style.height = Math.max(200, rect.height - headerH - footerH) + "px";
}
```

Replace it with:
```js
function positionMetaPopup(boxEl) {
    if (!metaPopupEl) return;
    if (_metaPopupGeo) {
        metaPopupEl.style.left    = Math.max(0, Math.min(window.innerWidth  - 40, _metaPopupGeo.left)) + "px";
        metaPopupEl.style.top     = Math.max(0, Math.min(window.innerHeight - 40, _metaPopupGeo.top))  + "px";
        metaPopupEl.style.width   = (_metaPopupGeo.width  || 280) + "px";
        metaPopupEl.style.height  = (_metaPopupGeo.height || 300) + "px";
        metaPopupEl.style.opacity = "1";
        return;
    }
    if (!boxEl) return;
    const rect = boxEl.getBoundingClientRect();
    const popW = 280;
    const gap  = 8;
    const vpW  = window.innerWidth;

    let left;
    if (rect.right + gap + popW <= vpW) {
        left = rect.right + gap;
        metaPopupEl.style.opacity = "1";
    } else {
        left = Math.max(rect.right - popW - 4, rect.left);
        metaPopupEl.style.opacity = "0.96";
    }
    const headerH = 41, footerH = 46;
    metaPopupEl.style.left   = left + "px";
    metaPopupEl.style.top    = (rect.top + headerH) + "px";
    metaPopupEl.style.width  = popW + "px";
    metaPopupEl.style.height = Math.max(200, rect.height - headerH - footerH) + "px";
}
```

- [ ] **Step 2: Commit**

```bash
git add web/ext.js
git commit -m "feat: positionMetaPopup uses saved geometry when available"
```

---

### Task 3: Add CSS for drag cursor and resize handle

**Files:**
- Modify: `web/ext.js` (`injectStyles` CSS block)

- [ ] **Step 1: Add `cursor: move` to header and `.ell-meta-resize-handle` rule**

In the `injectStyles` function, find the last CSS rule before the closing backtick of `style.textContent`. It ends with:
```css
        .ell-meta-tag {
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 2px 8px;
            font-size: 11px;
            color: var(--fg-color, #ddd);
            cursor: default;
            white-space: nowrap;
        }
    `;
```

Replace just those last two lines (closing brace and backtick) with:
```css
        .ell-meta-tag {
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 2px 8px;
            font-size: 11px;
            color: var(--fg-color, #ddd);
            cursor: default;
            white-space: nowrap;
        }
        .ell-meta-popup-header { cursor: move; }
        .ell-meta-resize-handle {
            position: absolute; right: 0; bottom: 0;
            width: 14px; height: 14px; cursor: se-resize;
            background: linear-gradient(135deg,
                transparent 50%,
                var(--border-color, #666) 50%, var(--border-color, #666) 60%,
                transparent 60%, transparent 70%,
                var(--border-color, #666) 70%, var(--border-color, #666) 80%,
                transparent 80%);
            opacity: 0.5;
        }
    `;
```

- [ ] **Step 2: Commit**

```bash
git add web/ext.js
git commit -m "feat: add drag cursor and resize handle CSS for meta popup"
```

---

### Task 4: Wire drag to the popup header

**Files:**
- Modify: `web/ext.js` (`buildMetaPopup` function)

- [ ] **Step 1: Add drag listener after header is assembled**

In `buildMetaPopup`, find the lines:
```js
    popHeader.appendChild(popTitle);
    popHeader.appendChild(popClose);
```

Add the following drag wiring immediately after them:
```js
    popHeader.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".ell-meta-popup-close")) return;
        const startX = e.clientX - metaPopupEl.offsetLeft;
        const startY = e.clientY - metaPopupEl.offsetTop;
        popHeader.setPointerCapture(e.pointerId);
        document.body.style.userSelect = "none";
        function onMove(ev) {
            metaPopupEl.style.left = Math.max(40 - metaPopupEl.offsetWidth, Math.min(window.innerWidth  - 40, ev.clientX - startX)) + "px";
            metaPopupEl.style.top  = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - startY)) + "px";
        }
        function onUp() {
            popHeader.removeEventListener("pointermove", onMove);
            popHeader.removeEventListener("pointerup",   onUp);
            document.body.style.userSelect = "";
            _saveMetaPopupGeo();
        }
        popHeader.addEventListener("pointermove", onMove);
        popHeader.addEventListener("pointerup",   onUp);
    });
```

- [ ] **Step 2: Commit**

```bash
git add web/ext.js
git commit -m "feat: make LoRA Info popup draggable"
```

---

### Task 5: Add resize handle to the popup

**Files:**
- Modify: `web/ext.js` (`buildMetaPopup` function)

- [ ] **Step 1: Append resize handle before `document.body.appendChild`**

In `buildMetaPopup`, find:
```js
    document.body.appendChild(metaPopupEl);
```

Insert the following immediately before it:
```js
    const metaResizeHandle = document.createElement("div");
    metaResizeHandle.className = "ell-meta-resize-handle";
    metaResizeHandle.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const initW  = metaPopupEl.offsetWidth, initH = metaPopupEl.offsetHeight;
        metaResizeHandle.setPointerCapture(e.pointerId);
        document.body.style.userSelect = "none";
        function onMove(ev) {
            metaPopupEl.style.width  = Math.max(200, initW + (ev.clientX - startX)) + "px";
            metaPopupEl.style.height = Math.max(150, initH + (ev.clientY - startY)) + "px";
        }
        function onUp() {
            metaResizeHandle.removeEventListener("pointermove", onMove);
            metaResizeHandle.removeEventListener("pointerup",   onUp);
            document.body.style.userSelect = "";
            _saveMetaPopupGeo();
        }
        metaResizeHandle.addEventListener("pointermove", onMove);
        metaResizeHandle.addEventListener("pointerup",   onUp);
    });
    metaPopupEl.appendChild(metaResizeHandle);
```

- [ ] **Step 2: Verify manually in ComfyUI**

Open the file browser, click a `.safetensors` file to trigger the LoRA Info popup, then:
- Drag the popup header — it should move freely and stay put when released
- Drag the bottom-right resize handle — popup should resize, respecting 200×150px minimum
- Click a different file — popup should reappear at the last position/size (not re-auto-position)
- Close the file browser and reopen — popup should reappear at saved position on next file click

- [ ] **Step 3: Commit**

```bash
git add web/ext.js
git commit -m "feat: make LoRA Info popup resizable with session-persistent geometry"
```
