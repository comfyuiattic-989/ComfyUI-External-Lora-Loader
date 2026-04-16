import { app } from "../../scripts/app.js";

// Collapse a widget to zero height so it's invisible but still serialized
function hideWidget(node, widget) {
    widget.computeSize = () => [0, -4];
    widget.type = "hidden";
    node.setSize(node.computeSize());
}

// D3 module cached at module level so it only loads once per page
let _d3 = null;
async function loadD3() {
    if (_d3) return _d3;
    _d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
    return _d3;
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
            user-select: none;
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
            white-space: nowrap;
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
        };

        // 6. Modal DOM (built lazily on first open)
        let modalOverlay = null;
        let treeContainerEl = null;
        let statusEl = null;
        let selectBtn = null;
        let _boxPositioned = false;

        // Shared keydown handler for Escape key
        let onKeyDown = null;

        // D3 tree state (per node instance)
        let treeRootData = null;
        let _d3root = null;
        let _d3update = null;
        let _idCounter = 0;

        function _nextId() { return ++_idCounter; }

        // --- _normDrive: normalize drive strings for comparison ---
        function _normDrive(d) {
            return (d || "").replace(/\\/g, "/").replace(/\/+$/, "") + "/";
        }

        // --- clearFileSelection: recursively clears _selected on all nodes ---
        function clearFileSelection(n) {
            if (!n) return;
            n._selected = false;
            [...(n.children || []), ...(n._children || [])].forEach(clearFileSelection);
        }

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
                    row.addEventListener("dblclick", (e) => {
                        e.stopPropagation();
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

        // --- rebuildAndUpdate: rebuilds D3 hierarchy from treeRootData ---
        function rebuildAndUpdate() {
            if (!_d3root || !_d3update || !treeRootData) return;
            const oldById = new Map();
            _d3root.descendants().forEach(n => oldById.set(n.data._id, { x: n.x, y: n.y }));
            const newRoot = _d3.hierarchy(treeRootData, d => d.children);
            newRoot.descendants().forEach(n => {
                const old = oldById.get(n.data._id);
                if (old) { n.x0 = old.x; n.y0 = old.y; }
                else { n.x0 = _d3root.x0 || 0; n.y0 = _d3root.y0 || 0; }
            });
            newRoot.x0 = _d3root.x0 || 0;
            newRoot.y0 = _d3root.y0 || 0;
            _d3root = newRoot;
            _d3update(_d3root);
        }

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
                    if (!resp.ok) throw new Error(resp.statusText);
                    const json = await resp.json();
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
                    data._loaded = true;
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

        // --- buildD3Tree: render horizontal tidy tree with D3 ---
        async function buildD3Tree(containerEl, rootData) {
            const d3 = await loadD3();

            // Clear previous render
            containerEl.innerHTML = "";

            const width = containerEl.clientWidth || 600;
            const margin = { top: 20, right: 160, bottom: 20, left: 80 };

            const svg = d3.select(containerEl).append("svg")
                .attr("width", "100%")
                .style("font", "13px sans-serif")
                .style("user-select", "none")
                .style("background", "transparent");

            const g = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            let root = d3.hierarchy(rootData, d => d.children);
            root.x0 = 0;
            root.y0 = 0;
            // Position virtual root off-screen so drives start at x=0
            root.y = -margin.left;

            const treeLayout = d3.tree().nodeSize([24, 160]);

            const linkGroup = g.append("g")
                .attr("fill", "none")
                .attr("stroke", "#555")
                .attr("stroke-opacity", 0.4)
                .attr("stroke-width", 1.5);
            const nodeGroup = g.append("g")
                .attr("cursor", "pointer")
                .attr("pointer-events", "all");

            function update(source) {
                treeLayout(root);

                // Skip virtual root: only render drive nodes and below
                const allNodes = root.descendants();
                const nodes = allNodes.slice(1);
                const links = root.links().filter(l => l.source !== root);

                // Offset y so drives start at the left edge
                const yOffset = margin.left;
                nodes.forEach(d => { d.y = d.y - yOffset; });

                // Compute SVG dimensions from node extents
                const xs = nodes.map(d => d.x);
                const minX = nodes.length ? Math.min(...xs) : 0;
                const maxX = nodes.length ? Math.max(...xs) : 0;
                const treeHeight = maxX - minX + margin.top + margin.bottom + 40;
                const ys = nodes.map(d => d.y);
                const maxY = nodes.length ? Math.max(...ys) : 0;
                const treeWidth = maxY + margin.left + margin.right + 160;

                svg.attr("height", treeHeight)
                   .attr("width", Math.max(treeWidth, width));
                g.attr("transform", `translate(${margin.left},${margin.top - minX + 20})`);

                // --- Links ---
                const link = linkGroup.selectAll("path").data(links, d => d.target.data._id);

                const linkEnter = link.enter().append("path")
                    .attr("d", () => {
                        const sx = source.x0 !== undefined ? source.x0 : 0;
                        const sy = source.y0 !== undefined ? source.y0 - yOffset : 0;
                        return d3.linkHorizontal()({ source: [sy, sx], target: [sy, sx] });
                    });

                link.merge(linkEnter).transition().duration(250)
                    .attr("d", d => d3.linkHorizontal()({
                        source: [d.source.y, d.source.x],
                        target: [d.target.y, d.target.x]
                    }));

                link.exit().transition().duration(250)
                    .attr("d", () => {
                        const sx = source.x !== undefined ? source.x : 0;
                        const sy = source.y !== undefined ? source.y : 0;
                        return d3.linkHorizontal()({ source: [sy, sx], target: [sy, sx] });
                    }).remove();

                // --- Nodes ---
                const node = nodeGroup.selectAll("g.node").data(nodes, d => d.data._id);

                const nodeEnter = node.enter().append("g")
                    .attr("class", "node")
                    .attr("transform", () => {
                        const sx = source.x0 !== undefined ? source.x0 : 0;
                        const sy = source.y0 !== undefined ? source.y0 - yOffset : 0;
                        return `translate(${sy},${sx})`;
                    })
                    .attr("opacity", 0)
                    .on("click", (event, d) => onNodeClick(event, d, update));

                // Circle marker
                nodeEnter.append("circle")
                    .attr("r", 5)
                    .attr("fill", d => d.data.type === "file"
                        ? "var(--comfy-input-bg, #555)"
                        : (d.data._children || (d.data.children && d.data.children.length) ? "#555" : "#999"))
                    .attr("stroke", d => d.data.type === "file" ? "#7eb8f7" : "#555")
                    .attr("stroke-width", d => d.data.type === "file" ? 2 : 1);

                // Label
                nodeEnter.append("text")
                    .attr("dy", "0.32em")
                    .attr("x", d => (d.data.type !== "file" && !d.children) ? -8 : 8)
                    .attr("text-anchor", d => (d.data.type !== "file" && !d.children) ? "end" : "start")
                    .attr("fill", d => d.data.type === "file" ? "#7eb8f7" : "var(--fg-color, #ddd)")
                    .text(d => d.data.name)
                    .clone(true).lower()
                    .attr("stroke", "var(--comfy-menu-bg, #353535)")
                    .attr("stroke-width", 3);

                const nodeMerge = node.merge(nodeEnter);

                nodeMerge.transition().duration(250)
                    .attr("transform", d => `translate(${d.y},${d.x})`)
                    .attr("opacity", 1);

                // Update circle fill/stroke on state change
                nodeMerge.select("circle")
                    .attr("fill", d => {
                        if (d.data.type === "file") return d.data._selected ? "#7eb8f7" : "var(--comfy-input-bg, #555)";
                        return d.data.children && d.data.children.length ? "#555" : "#999";
                    })
                    .attr("stroke", d => d.data.type === "file" ? "#7eb8f7" : "#555");

                // Update text
                nodeMerge.select("text:not([stroke])")
                    .attr("x", d => (d.data.type !== "file" && !d.children) ? -8 : 8)
                    .attr("text-anchor", d => (d.data.type !== "file" && !d.children) ? "end" : "start")
                    .attr("fill", d => {
                        if (d.data.type === "file") return d.data._selected ? "#fff" : "#7eb8f7";
                        return "var(--fg-color, #ddd)";
                    })
                    .attr("font-weight", d => d.data._selected ? "bold" : "normal");

                node.exit().transition().duration(250)
                    .attr("transform", () => {
                        const sx = source.x !== undefined ? source.x : 0;
                        const sy = source.y !== undefined ? source.y : 0;
                        return `translate(${sy},${sx})`;
                    })
                    .attr("opacity", 0)
                    .remove();

                // Save old positions for next transition
                allNodes.forEach(d => { d.x0 = d.x; d.y0 = d.y; });
            }

            // Initial render
            update(root);

            // Expose root reference for rebuildAndUpdate
            return {
                get root() { return root; },
                set root(r) { root = r; },
                update
            };
        }

        // --- autoExpandD3ToPath: traverse tree data to saved path ---
        async function autoExpandD3ToPath(drive, segments, savedFile) {
            if (!treeRootData) return;
            let cur = (treeRootData.children || []).find(c => _normDrive(c.drive) === _normDrive(drive));
            if (!cur) return;

            for (let i = 0; i < segments.length; i++) {
                if (!cur._loaded) {
                    const path = cur.segments.join("/");
                    try {
                        const resp = await fetch("/external_lora/browse", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ drive: cur.drive, path })
                        });
                        const json = await resp.json();
                        cur._loaded = true;
                        cur.children = [
                            ...(json.dirs  || []).map(name => ({
                                name, type: "dir",  drive: cur.drive,
                                segments: [...cur.segments, name],
                                _loaded: false, children: null, _children: null,
                                _id: _nextId(), _selected: false
                            })),
                            ...(json.files || []).map(name => ({
                                name, type: "file", drive: cur.drive,
                                segments: [...cur.segments, name],
                                _loaded: true,  children: null, _children: null,
                                _id: _nextId(), _selected: false
                            })),
                        ];
                    } catch {
                        break;
                    }
                }
                const next = (cur.children || []).find(c => c.name === segments[i]);
                if (!next) break;
                cur = next;
            }

            // Highlight saved file
            if (savedFile && cur.children) {
                const fileNode = cur.children.find(c => c.type === "file" && c.name === savedFile);
                if (fileNode) {
                    clearFileSelection(treeRootData);
                    fileNode._selected = true;
                    browserState.drive = fileNode.drive;
                    browserState.pathSegments = fileNode.segments.slice(0, -1);
                    browserState.selectedFile = fileNode.name;
                    if (selectBtn) {
                        selectBtn.disabled = false;
                        selectBtn.textContent = "Select";
                    }
                    if (statusEl) statusEl.textContent = savedFile;
                }
            }

            renderTree();
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

            // Body — single full-width D3 tree container
            const body = document.createElement("div");
            body.className = "ell-modal-body";

            treeContainerEl = document.createElement("div");
            treeContainerEl.className = "ell-tree-container";

            body.appendChild(treeContainerEl);

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
        async function openFileBrowser() {
            buildModal();
            modalOverlay.style.display = "block";
            positionModal();

            if (onKeyDown) { document.removeEventListener("keydown", onKeyDown); onKeyDown = null; }
            onKeyDown = (e) => { if (e.key === "Escape") closeModal(); };
            document.addEventListener("keydown", onKeyDown);

            browserState.selectedFile = null;
            if (selectBtn) { selectBtn.disabled = true; selectBtn.textContent = "Select"; }
            if (statusEl) statusEl.textContent = "Loading drives\u2026";

            const d3 = await loadD3();

            try {
                const resp = await fetch("/external_lora/browse", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                });
                const data = await resp.json();
                const drives = data.dirs || [];

                // Build virtual root (not rendered; drives are the top-level nodes)
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

                // Build D3 tree
                const result = await buildD3Tree(treeContainerEl, treeRootData);
                _d3root = result.root;
                _d3update = result.update;

                // Patch rebuildAndUpdate to use the result object's root setter
                const _resultRef = result;
                // Override module-level rebuildAndUpdate to keep result.root in sync
                const _rebuildImpl = () => {
                    if (!_d3root || !_d3update || !_d3 || !treeRootData) return;
                    const oldRoot = _d3root;
                    const oldById = new Map();
                    oldRoot.descendants().forEach(n => oldById.set(n.data._id, { x: n.x, y: n.y }));
                    const newRoot = _d3.hierarchy(treeRootData, d => d.children);
                    newRoot.descendants().forEach(n => {
                        const old = oldById.get(n.data._id);
                        if (old) { n.x0 = old.x; n.y0 = old.y; }
                        else { n.x0 = oldRoot.x0 || 0; n.y0 = oldRoot.y0 || 0; }
                    });
                    newRoot.x0 = oldRoot.x0 || 0;
                    newRoot.y0 = oldRoot.y0 || 0;
                    _d3root = newRoot;
                    _resultRef.root = newRoot;
                    _d3update(newRoot);
                };
                // Replace the closure-captured rebuildAndUpdate implementation
                _activeRebuild = _rebuildImpl;

                // Auto-expand if saved path exists
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

        // Active rebuild implementation (set after buildD3Tree so it has access to the result ref)
        let _activeRebuild = null;

        // Override rebuildAndUpdate to dispatch to the active implementation
        function rebuildAndUpdate() {
            if (_activeRebuild) {
                _activeRebuild();
            } else {
                // Fallback before first open
                if (!_d3root || !_d3update || !_d3 || !treeRootData) return;
                const oldRoot = _d3root;
                const oldById = new Map();
                oldRoot.descendants().forEach(n => oldById.set(n.data._id, { x: n.x, y: n.y }));
                const newRoot = _d3.hierarchy(treeRootData, d => d.children);
                newRoot.descendants().forEach(n => {
                    const old = oldById.get(n.data._id);
                    if (old) { n.x0 = old.x; n.y0 = old.y; }
                    else { n.x0 = oldRoot.x0 || 0; n.y0 = oldRoot.y0 || 0; }
                });
                newRoot.x0 = oldRoot.x0 || 0;
                newRoot.y0 = oldRoot.y0 || 0;
                _d3root = newRoot;
                _d3update(newRoot);
            }
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
