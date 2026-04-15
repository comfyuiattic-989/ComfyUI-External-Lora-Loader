import { app } from "../../scripts/app.js";

// Collapse a widget to zero height so it's invisible but still serialized
function hideWidget(node, widget) {
    widget.computeSize = () => [0, -4];
    widget.type = "hidden";
    node.setSize(node.computeSize());
}

// Inject modal CSS once into document.head
let _stylesInjected = false;
function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const style = document.createElement("style");
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
        .ell-tree-pane {
            width: 210px; min-width: 210px; max-width: 210px;
            border-right: 1px solid var(--border-color, #4e4e4e);
            overflow-y: auto;
            background: var(--comfy-input-bg, #222);
            padding: 4px 0;
        }
        .ell-file-pane {
            flex: 1; overflow-y: auto; padding: 4px 0;
        }
        .ell-tree-row {
            display: flex; align-items: center;
            padding: 5px 8px;
            cursor: pointer;
            color: var(--input-text, #ddd);
            font-size: 13px; user-select: none;
            border-radius: 3px;
        }
        .ell-tree-row:hover { background: var(--border-color, #4e4e4e); }
        .ell-tree-row.ell-tree-selected {
            background: rgba(100,130,200,0.25);
            outline: 1px solid var(--border-color, #666);
        }
        .ell-tree-tri {
            font-size: 11px; min-width: 14px;
            display: inline-block; text-align: center;
            opacity: 0.7; margin-right: 4px;
            flex-shrink: 0;
        }
        .ell-tree-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ell-entry {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 18px; cursor: pointer;
            color: var(--input-text, #ddd); font-size: 13px; user-select: none;
        }
        .ell-entry:hover { background: var(--comfy-input-bg, #222); }
        .ell-entry.ell-selected { background: var(--border-color, #4e4e4e); }
        .ell-entry.ell-file { color: var(--fg-color, #fff); }
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
    document.head.appendChild(style);
}

app.registerExtension({
    name: "ExternalLoraLoader",

    async nodeCreated(node) {
        // Only apply to ExternalLoraLoader nodes
        if (node.comfyClass !== "ExternalLoraLoader") return;

        // --- Widget references ---
        const driveWidget    = node.widgets.find(w => w.name === "drive");
        const subPathWidget  = node.widgets.find(w => w.name === "sub_path");
        const loraNameWidget = node.widgets.find(w => w.name === "lora_name");

        if (!driveWidget || !subPathWidget || !loraNameWidget) return;

        // Render the backend STRING input as a combo so the UI keeps the same
        // dropdown behavior without triggering backend combo-list validation.
        loraNameWidget.type = "combo";
        loraNameWidget.options = { ...(loraNameWidget.options || {}), values: ["none"] };
        loraNameWidget.value = loraNameWidget.value || "none";

        // --- Debounce helper ---
        let debounceTimer = null;
        let pathLabelWidget = null;
        function scheduleRefresh() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => refreshFiles(), 500);
        }

        // --- refreshFiles: POST to list_files API ---
        async function refreshFiles() {
            const drive = driveWidget.value;
            const path  = (subPathWidget.value || "").replace(/\\/g, "/");

            try {
                const resp = await fetch("/external_lora/list_files", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ drive, path }),
                });
                const data = await resp.json();

                if (!resp.ok) {
                    loraNameWidget.options.values = ["none"];
                    loraNameWidget.value = "none";
                    showTempLabel(loraNameWidget, `Server error (${resp.status})`, 2000);
                } else if (data.files && data.files.length > 0) {
                    const prev = loraNameWidget.value;
                    loraNameWidget.options.values = data.files;
                    loraNameWidget.value = data.files.includes(prev) ? prev : "none";
                } else {
                    loraNameWidget.options.values = ["none"];
                    loraNameWidget.value = "none";
                    pathLabelWidget.value = "No file selected";
                    showTempLabel(loraNameWidget, "Path not found", 2000);
                }
            } catch (err) {
                loraNameWidget.options.values = ["none"];
                loraNameWidget.value = "none";
                pathLabelWidget.value = "No file selected";
                showTempLabel(loraNameWidget, "Error fetching files", 2000);
            } finally {
                node.setDirtyCanvas(true, true);
            }
        }

        // --- Temporary label helper ---
        const _labelTimers = new WeakMap();
        function showTempLabel(widget, message, durationMs) {
            clearTimeout(_labelTimers.get(widget));
            const origLabel = widget.label;
            widget.label = message;
            _labelTimers.set(widget, setTimeout(() => { widget.label = origLabel; }, durationMs));
        }

        // 1. Hide drive and sub_path from the canvas
        hideWidget(node, driveWidget);
        hideWidget(node, subPathWidget);

        // 2. Inject CSS (idempotent)
        injectStyles();

        // 3. Path label (read-only display)
        pathLabelWidget = node.addWidget("text", "selected_path", "No file selected", () => {});
        setTimeout(() => {
            if (pathLabelWidget.inputEl) pathLabelWidget.inputEl.readOnly = true;
        }, 0);

        // 4. Browse button
        const browseBtn = node.addWidget("button", "Browse\u2026", null, () => openFileBrowser());

        // 5. Browser navigation state
        const browserState = {
            drive: "", pathSegments: [], selectedFile: null,
            treeRoots: [],           // root tree node objects
            selectedTreeNode: null,  // currently highlighted tree node
        };

        // 6. Modal DOM (built lazily on first open)
        let modalOverlay = null;
        let treePaneEl = null;
        let filePaneEl = null;
        let statusEl = null;
        let selectBtn = null;
        let _boxPositioned = false;

        // Shared keydown handler for Escape key (declared at enclosing scope)
        let onKeyDown = null;

        // Navigation generation counter to discard stale responses
        let navGen = 0;

        // --- Tree node factory ---
        function makeTreeNode(drive, segments, name) {
            return {
                drive, segments, name,
                children: null,   // null=unloaded | []=empty | [...]= loaded
                expanded: false,
                el: null,         // .ell-tree-row DOM element
                childrenEl: null  // children container DOM element
            };
        }

        // --- renderTreeNode(treeNode, depth) ---
        function renderTreeNode(treeNode, depth) {
            const row = document.createElement("div");
            row.className = "ell-tree-row";
            row.style.paddingLeft = (8 + depth * 16) + "px";

            const triangle = document.createElement("span");
            triangle.className = "ell-tree-tri";
            triangle.textContent = "\u25B8"; // ▸

            const label = document.createElement("span");
            label.className = "ell-tree-label";
            label.textContent = treeNode.name;

            row.appendChild(triangle);
            row.appendChild(label);

            const childrenEl = document.createElement("div");
            childrenEl.style.display = "none";

            treeNode.el = row;
            treeNode.childrenEl = childrenEl;

            triangle.addEventListener("click", e => {
                e.stopPropagation();
                if (treeNode.expanded) {
                    collapseTreeNode(treeNode, triangle);
                } else {
                    expandTreeNode(treeNode, triangle, depth);
                }
            });

            row.addEventListener("click", e => {
                e.stopPropagation();
                selectTreeNode(treeNode);
            });

            return { row, childrenEl };
        }

        // --- expandTreeNode(treeNode, triangleEl, depth) ---
        async function expandTreeNode(treeNode, triangleEl, depth) {
            treeNode.expanded = true;
            if (triangleEl) triangleEl.textContent = "\u25BE"; // ▾
            if (treeNode.childrenEl) treeNode.childrenEl.style.display = "";

            // Already loaded — no fetch needed
            if (treeNode.children !== null) return;

            const gen = ++navGen;
            try {
                const resp = await fetch("/external_lora/browse", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ drive: treeNode.drive, path: treeNode.segments.join("/") }),
                });
                const data = await resp.json();
                if (gen !== navGen) return;

                const dirs = data.dirs || [];
                treeNode.children = dirs.map(name =>
                    makeTreeNode(treeNode.drive, [...treeNode.segments, name], name)
                );

                if (treeNode.childrenEl) {
                    treeNode.childrenEl.innerHTML = "";
                    treeNode.children.forEach(childNode => {
                        const { row, childrenEl } = renderTreeNode(childNode, depth + 1);
                        treeNode.childrenEl.appendChild(row);
                        treeNode.childrenEl.appendChild(childrenEl);
                    });
                }
            } catch (err) {
                if (gen !== navGen) return;
                treeNode.children = [];
            }
        }

        // --- collapseTreeNode(treeNode, triangleEl) ---
        function collapseTreeNode(treeNode, triangleEl) {
            treeNode.expanded = false;
            if (triangleEl) triangleEl.textContent = "\u25B8"; // ▸
            if (treeNode.childrenEl) treeNode.childrenEl.style.display = "none";
        }

        // --- selectTreeNode(treeNode) ---
        async function selectTreeNode(treeNode) {
            // Deselect previous
            if (browserState.selectedTreeNode && browserState.selectedTreeNode.el) {
                browserState.selectedTreeNode.el.classList.remove("ell-tree-selected");
            }

            browserState.selectedTreeNode = treeNode;
            browserState.drive = treeNode.drive;
            browserState.pathSegments = treeNode.segments;
            browserState.selectedFile = null;
            if (selectBtn) selectBtn.disabled = true;

            if (treeNode.el) treeNode.el.classList.add("ell-tree-selected");

            const gen = ++navGen;
            try {
                const resp = await fetch("/external_lora/browse", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ drive: treeNode.drive, path: treeNode.segments.join("/") }),
                });
                const data = await resp.json();
                if (gen !== navGen) return;

                const dirs = data.dirs || [];
                const files = data.files || [];

                // Cache children for future expand (no DOM render here)
                if (treeNode.children === null) {
                    treeNode.children = dirs.map(name =>
                        makeTreeNode(treeNode.drive, [...treeNode.segments, name], name)
                    );
                }

                renderFilePane(files);
                if (statusEl) statusEl.textContent = "";
            } catch (err) {
                if (gen !== navGen) return;
                if (statusEl) statusEl.textContent = "Network error";
                renderFilePane([]);
            }
        }

        // --- renderFilePane(files) ---
        function renderFilePane(files) {
            if (!filePaneEl) return;
            filePaneEl.innerHTML = "";

            if (files.length === 0) {
                const empty = document.createElement("div");
                empty.className = "ell-entry";
                empty.style.color = "var(--input-text, #aaa)";
                empty.style.cursor = "default";
                empty.textContent = "No LoRA files found in this folder";
                filePaneEl.appendChild(empty);
                return;
            }

            files.forEach(name => {
                const el = document.createElement("div");
                el.className = "ell-entry ell-file";
                el.dataset.name = name;
                el.textContent = "\uD83D\uDCC4 " + name;
                el.onclick = () => {
                    filePaneEl.querySelectorAll(".ell-entry").forEach(e => e.classList.remove("ell-selected"));
                    el.classList.add("ell-selected");
                    browserState.selectedFile = name;
                    if (selectBtn) selectBtn.disabled = false;
                };
                el.ondblclick = () => {
                    browserState.selectedFile = name;
                    commitSelection();
                };
                filePaneEl.appendChild(el);
            });
        }

        // --- _normDrive: normalize drive strings for comparison ---
        function _normDrive(d) {
            return (d || "").replace(/\\/g, "/").replace(/\/+$/, "") + "/";
        }

        // --- autoExpandToPath(drive, segments) ---
        async function autoExpandToPath(drive, segments) {
            // Find the matching drive root
            let cur = browserState.treeRoots.find(r => _normDrive(r.drive) === _normDrive(drive));
            if (!cur) return;

            // Expand each segment level with a private fetch (does not touch navGen)
            for (let i = 0; i < segments.length; i++) {
                // Load children if not already loaded
                if (cur.children === null) {
                    const path = cur.segments.join("/");
                    try {
                        const resp = await fetch("/external_lora/browse", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ drive: cur.drive, path }),
                        });
                        const data = await resp.json();
                        const dirs = data.dirs || [];
                        cur.children = dirs.map(name =>
                            makeTreeNode(cur.drive, [...cur.segments, name], name)
                        );
                        // Render children into the DOM
                        cur.childrenEl.innerHTML = "";
                        cur.children.forEach(child => {
                            const { row, childrenEl } = renderTreeNode(child, i + 1);
                            cur.childrenEl.appendChild(row);
                            cur.childrenEl.appendChild(childrenEl);
                        });
                    } catch (_) {
                        break;
                    }
                }

                // Expand the current node in the tree UI
                cur.expanded = true;
                if (cur.childrenEl) cur.childrenEl.style.display = "block";
                const tri = cur.el ? cur.el.querySelector(".ell-tree-tri") : null;
                if (tri) tri.textContent = "▾";

                // Move to the next segment
                const next = (cur.children || []).find(c => c.name === segments[i]);
                if (!next) break;
                cur = next;
            }

            // Select the final node through the normal path (this bumps navGen once and shows files)
            await selectTreeNode(cur);

            // Highlight the saved file in the file pane if present
            if (browserState.selectedFile && filePaneEl) {
                const target = browserState.selectedFile;
                filePaneEl.querySelectorAll(".ell-entry.ell-file").forEach(el => {
                    // Use data-name attribute for exact match (see Bug 3 fix)
                    if (el.dataset.name === target) {
                        el.classList.add("ell-selected");
                        if (selectBtn) selectBtn.disabled = false;
                    }
                });
            }
        }

        // --- positionModal() ---
        function positionModal() {
            const box = modalOverlay ? modalOverlay.querySelector(".ell-modal-box") : null;
            if (_boxPositioned || !box) return;
            const initW = Math.min(700, window.innerWidth  * 0.88);
            const initH = Math.min(520, window.innerHeight * 0.80);
            box.style.width  = initW + "px";
            box.style.height = initH + "px";
            box.style.left   = Math.round((window.innerWidth  - initW) / 2) + "px";
            box.style.top    = Math.round((window.innerHeight - initH) / 2) + "px";
            _boxPositioned = true;
        }

        // --- makeDraggable(box, header) ---
        function makeDraggable(box, header) {
            header.addEventListener("pointerdown", (e) => {
                if (e.target.closest(".ell-modal-close")) return;
                const startX = e.clientX - box.offsetLeft;
                const startY = e.clientY - box.offsetTop;
                header.setPointerCapture(e.pointerId);
                document.body.style.userSelect = "none";
                function onMove(ev) {
                    const minV = 40;
                    let left = Math.max(minV - box.offsetWidth,  Math.min(window.innerWidth  - minV, ev.clientX - startX));
                    let top  = Math.max(0,                        Math.min(window.innerHeight - minV, ev.clientY - startY));
                    box.style.left = left + "px";
                    box.style.top  = top  + "px";
                }
                function onUp() {
                    header.removeEventListener("pointermove", onMove);
                    header.removeEventListener("pointerup",   onUp);
                    document.body.style.userSelect = "";
                }
                header.addEventListener("pointermove", onMove);
                header.addEventListener("pointerup",   onUp);
            });
        }

        // --- makeResizable(box, handle) ---
        function makeResizable(box, handle) {
            handle.addEventListener("pointerdown", (e) => {
                e.stopPropagation();
                const startX = e.clientX, startY = e.clientY;
                const initW  = box.offsetWidth, initH = box.offsetHeight;
                handle.setPointerCapture(e.pointerId);
                document.body.style.userSelect = "none";
                function onMove(ev) {
                    const newW = Math.min(window.innerWidth  * 0.95, Math.max(480, initW + (ev.clientX - startX)));
                    const newH = Math.min(window.innerHeight * 0.92, Math.max(350, initH + (ev.clientY - startY)));
                    box.style.width  = newW + "px";
                    box.style.height = newH + "px";
                }
                function onUp() {
                    handle.removeEventListener("pointermove", onMove);
                    handle.removeEventListener("pointerup",   onUp);
                    document.body.style.userSelect = "";
                }
                handle.addEventListener("pointermove", onMove);
                handle.addEventListener("pointerup",   onUp);
            });
        }

        // --- buildModal() ---
        function buildModal() {
            if (modalOverlay) return; // already built

            modalOverlay = document.createElement("div");
            modalOverlay.className = "ell-modal-overlay";
            modalOverlay.style.display = "none";

            const box = document.createElement("div");
            box.className = "ell-modal-box";

            // Header
            const header = document.createElement("div");
            header.className = "ell-modal-header";
            const title = document.createElement("span");
            title.textContent = "Browse for LoRA";
            const closeBtn = document.createElement("button");
            closeBtn.className = "ell-modal-close";
            closeBtn.textContent = "\u2715";
            closeBtn.onclick = closeModal;
            header.appendChild(title);
            header.appendChild(closeBtn);

            // Body (split pane)
            const body = document.createElement("div");
            body.className = "ell-modal-body";

            treePaneEl = document.createElement("div");
            treePaneEl.className = "ell-tree-pane";

            filePaneEl = document.createElement("div");
            filePaneEl.className = "ell-file-pane";

            body.appendChild(treePaneEl);
            body.appendChild(filePaneEl);

            // Footer
            const footer = document.createElement("div");
            footer.className = "ell-modal-footer";
            statusEl = document.createElement("span");
            statusEl.className = "ell-status-text";
            selectBtn = document.createElement("button");
            selectBtn.className = "ell-select-btn";
            selectBtn.textContent = "Select";
            selectBtn.disabled = true;
            selectBtn.onclick = commitSelection;
            footer.appendChild(statusEl);
            footer.appendChild(selectBtn);

            // Resize handle
            const resizeHandle = document.createElement("div");
            resizeHandle.className = "ell-resize-handle";

            box.appendChild(header);
            box.appendChild(body);
            box.appendChild(footer);
            box.appendChild(resizeHandle);
            modalOverlay.appendChild(box);

            document.body.appendChild(modalOverlay);

            // Wire up drag and resize
            makeDraggable(box, header);
            makeResizable(box, resizeHandle);
        }

        // --- openFileBrowser() ---
        function openFileBrowser() {
            buildModal();
            modalOverlay.style.display = "block";
            positionModal();

            const savedDrive = driveWidget.value || "";
            const savedPath  = subPathWidget.value || "";
            const savedFile  = loraNameWidget.value !== "none" ? loraNameWidget.value : null;
            browserState.selectedFile = null;
            if (selectBtn) selectBtn.disabled = true;

            if (onKeyDown) {
                document.removeEventListener("keydown", onKeyDown);
                onKeyDown = null;
            }
            onKeyDown = (e) => { if (e.key === "Escape") closeModal(); };
            document.addEventListener("keydown", onKeyDown);

            const gen = ++navGen;
            if (statusEl) statusEl.textContent = "Loading drives\u2026";

            fetch("/external_lora/browse", {
                method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({})
            })
            .then(r => r.json())
            .then(data => {
                if (gen !== navGen) return;
                const drives = data.dirs || [];
                browserState.treeRoots = drives.map(d => makeTreeNode(d, [], d));
                treePaneEl.innerHTML = "";
                browserState.treeRoots.forEach(rootNode => {
                    const { row, childrenEl } = renderTreeNode(rootNode, 0);
                    treePaneEl.appendChild(row);
                    treePaneEl.appendChild(childrenEl);
                });
                if (statusEl) statusEl.textContent = "";
                if (savedDrive) {
                    browserState.drive = savedDrive;
                    browserState.pathSegments = savedPath ? savedPath.split(/[/\\]/).filter(Boolean) : [];
                    browserState.selectedFile = savedFile;
                    autoExpandToPath(savedDrive, browserState.pathSegments);
                }
            })
            .catch(() => {
                if (gen !== navGen) return;
                if (statusEl) statusEl.textContent = "Failed to load drives";
            });
        }

        function closeModal() {
            if (modalOverlay) modalOverlay.style.display = "none";
            // Remove Escape key handler to avoid memory leak
            if (onKeyDown) {
                document.removeEventListener("keydown", onKeyDown);
                onKeyDown = null;
            }
        }

        function commitSelection() {
            if (!browserState.selectedFile) return;
            const drive    = browserState.drive;
            const subPath  = browserState.pathSegments.join("/");
            const loraName = browserState.selectedFile;

            // Write back to hidden widgets
            driveWidget.value    = drive;
            subPathWidget.value  = subPath;
            loraNameWidget.value = loraName;

            // Ensure selected file is in options so refreshFiles preserves it even on transient error
            if (!loraNameWidget.options.values || !loraNameWidget.options.values.includes(loraName)) {
                loraNameWidget.options.values = ["none", loraName];
            }

            // Update visible path label
            const displayPath = subPath
                ? drive + subPath + "/" + loraName
                : drive + loraName;
            pathLabelWidget.value = displayPath;

            closeModal();

            // Sync lora_name dropdown options so ComfyUI serializes it correctly
            refreshFiles();
            node.setDirtyCanvas(true, true);
        }

        // --- Attach listeners ---
        driveWidget.callback = () => scheduleRefresh();

        const origSubPathCallback = subPathWidget.callback;
        subPathWidget.callback = (...args) => {
            if (origSubPathCallback) origSubPathCallback(...args);
            scheduleRefresh();
        };

        // --- Clear Cache button ---
        const clearCacheBtn = node.addWidget("button", "Clear Cache", null, async () => {
            try {
                const resp = await fetch("/external_lora/clear_cache", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const mb = Number(data.freed_mb || 0);
                const label = mb >= 1024
                    ? `Freed ${(mb / 1024).toFixed(1)} GB`
                    : `Freed ${mb.toFixed(1)} MB`;
                showTempLabel(clearCacheBtn, label, 2000);
            } catch (err) {
                console.error("[ExternalLoraLoader] Clear cache failed:", err);
                showTempLabel(clearCacheBtn, "Cache clear failed", 2000);
            }
        });

        // --- Widget order splice (after all three addWidget calls) ---
        // Final canvas order: drive(hidden), sub_path(hidden), selected_path, Browse…, lora_name, Clear Cache
        {
            const _loraIdx = node.widgets.indexOf(loraNameWidget);
            const _btnIdx  = node.widgets.indexOf(browseBtn);
            const _pathIdx = node.widgets.indexOf(pathLabelWidget);
            node.widgets.splice(_btnIdx, 1);
            node.widgets.splice(_pathIdx, 1);
            node.widgets.splice(_loraIdx, 0, pathLabelWidget);
            node.widgets.splice(_loraIdx + 1, 0, browseBtn);
            node.setSize(node.computeSize());
        }

        // Restore path label from persisted widget values on workflow load
        setTimeout(() => {
            const d = driveWidget.value || "";
            const p = subPathWidget.value || "";
            const f = loraNameWidget.value || "none";
            if (d && f !== "none") {
                const displayPath = p ? d + p + "/" + f : d + f;
                pathLabelWidget.value = displayPath;
                browserState.drive = d;
                browserState.pathSegments = p ? p.split(/[/\\]/).filter(Boolean) : [];
                browserState.selectedFile = f;
            }
        }, 0);

        // --- Initial load ---
        scheduleRefresh();
    }
});
