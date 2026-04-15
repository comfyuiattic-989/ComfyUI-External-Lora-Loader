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
            background: rgba(0,0,0,0.65);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
        }
        .ell-modal-box {
            background: var(--comfy-menu-bg, #353535);
            border-radius: 8px;
            box-shadow: 0 4px 32px rgba(0,0,0,0.6);
            width: min(680px, 90vw);
            display: flex; flex-direction: column;
            overflow: hidden;
            max-height: 80vh;
        }
        .ell-modal-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 10px 14px;
            border-bottom: 1px solid var(--border-color, #4e4e4e);
            font-weight: bold; color: var(--fg-color, #fff);
        }
        .ell-modal-close {
            background: none; border: none; color: var(--fg-color, #fff);
            cursor: pointer; font-size: 18px; line-height: 1; padding: 2px 6px;
        }
        .ell-breadcrumb-bar {
            display: flex; flex-wrap: wrap; gap: 2px; align-items: center;
            padding: 6px 14px;
            background: var(--comfy-input-bg, #222);
            border-bottom: 1px solid var(--border-color, #4e4e4e);
            min-height: 32px;
        }
        .ell-crumb {
            color: var(--fg-color, #ddd); cursor: pointer;
            padding: 2px 4px; border-radius: 3px; font-size: 13px;
        }
        .ell-crumb:hover { background: var(--border-color, #4e4e4e); }
        .ell-crumb-sep { color: var(--border-color, #4e4e4e); padding: 0 2px; user-select: none; }
        .ell-file-list {
            overflow-y: auto; flex: 1;
            max-height: 420px; padding: 4px 0;
        }
        .ell-entry {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 18px; cursor: pointer;
            color: var(--input-text, #ddd); font-size: 13px; user-select: none;
        }
        .ell-entry:hover { background: var(--comfy-input-bg, #222); }
        .ell-entry.ell-selected { background: var(--border-color, #4e4e4e); }
        .ell-entry.ell-dir  { color: #7eb8f7; }
        .ell-entry.ell-file { color: var(--fg-color, #fff); }
        .ell-modal-footer {
            display: flex; justify-content: space-between; align-items: center;
            padding: 8px 14px;
            border-top: 1px solid var(--border-color, #4e4e4e);
        }
        .ell-status-text { font-size: 12px; color: var(--input-text, #aaa); }
        .ell-select-btn {
            padding: 5px 18px; border-radius: 4px;
            background: var(--comfy-input-bg, #444); color: var(--fg-color, #fff);
            border: 1px solid var(--border-color, #4e4e4e); cursor: pointer;
        }
        .ell-select-btn:disabled { opacity: 0.4; cursor: not-allowed; }
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
        const pathLabelWidget = node.addWidget("text", "selected_path", "No file selected", () => {});
        setTimeout(() => {
            if (pathLabelWidget.inputEl) pathLabelWidget.inputEl.readOnly = true;
        }, 0);

        // 4. Browse button
        const browseBtn = node.addWidget("button", "Browse\u2026", null, () => openFileBrowser());

        // 5. Browser navigation state
        const browserState = { drive: "", pathSegments: [], selectedFile: null };

        // 6. Modal DOM (built lazily on first open)
        let modalOverlay = null;
        let fileListEl = null;
        let breadcrumbEl = null;
        let statusEl = null;
        let selectBtn = null;

        // Issue 2: shared keydown handler for Escape key (declared at enclosing scope)
        let onKeyDown = null;

        // Issue 3: navigation generation counter to discard stale responses
        let navGen = 0;

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

            // Breadcrumb
            breadcrumbEl = document.createElement("div");
            breadcrumbEl.className = "ell-breadcrumb-bar";

            // File list
            fileListEl = document.createElement("div");
            fileListEl.className = "ell-file-list";

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

            box.appendChild(header);
            box.appendChild(breadcrumbEl);
            box.appendChild(fileListEl);
            box.appendChild(footer);
            modalOverlay.appendChild(box);

            // Close on overlay click (outside box)
            modalOverlay.addEventListener("click", (e) => {
                if (e.target === modalOverlay) closeModal();
            });

            document.body.appendChild(modalOverlay);
        }

        function openFileBrowser() {
            buildModal();
            modalOverlay.style.display = "flex";
            // Restore state from widget values so re-open continues from last location
            const savedDrive = driveWidget.value || "";
            const savedPath  = subPathWidget.value || "";
            const savedFile  = loraNameWidget.value !== "none" ? loraNameWidget.value : null;
            browserState.drive = savedDrive;
            browserState.pathSegments = savedPath ? savedPath.split(/[/\\]/).filter(Boolean) : [];
            browserState.selectedFile = savedFile;

            // Issue 2: register Escape key handler
            onKeyDown = (e) => { if (e.key === "Escape") closeModal(); };
            document.addEventListener("keydown", onKeyDown);

            navigateTo(browserState.drive, browserState.pathSegments);
        }

        function closeModal() {
            if (modalOverlay) modalOverlay.style.display = "none";
            // Issue 2: remove Escape key handler to avoid memory leak
            if (onKeyDown) {
                document.removeEventListener("keydown", onKeyDown);
                onKeyDown = null;
            }
        }

        async function navigateTo(drive, segments) {
            browserState.drive = drive;
            browserState.pathSegments = segments;
            browserState.selectedFile = null;
            if (selectBtn) { selectBtn.disabled = true; }
            if (statusEl)  { statusEl.textContent = "Loading\u2026"; }

            renderBreadcrumb(drive, segments);

            // Issue 3: capture generation token before async work
            const gen = ++navGen;

            const path = segments.join("/");
            try {
                const resp = await fetch("/external_lora/browse", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ drive, path }),
                });
                const data = await resp.json();
                // Issue 3: discard stale responses
                if (gen !== navGen) return;
                if (!resp.ok) {
                    if (statusEl) statusEl.textContent = `Error: ${data.error || resp.status}`;
                    renderList([], []);
                    return;
                }
                renderList(data.dirs || [], data.files || []);
                if (statusEl) statusEl.textContent = "";
            } catch (err) {
                // Issue 3: discard stale responses
                if (gen !== navGen) return;
                if (statusEl) statusEl.textContent = "Network error";
                renderList([], []);
            }
        }

        function renderBreadcrumb(drive, segments) {
            if (!breadcrumbEl) return;
            breadcrumbEl.innerHTML = "";

            // "Drives" root crumb
            const rootCrumb = document.createElement("span");
            rootCrumb.className = "ell-crumb";
            rootCrumb.textContent = "Drives";
            rootCrumb.onclick = () => navigateTo("", []);
            breadcrumbEl.appendChild(rootCrumb);

            if (drive) {
                const sep1 = document.createElement("span");
                sep1.className = "ell-crumb-sep";
                sep1.textContent = "\u203a";
                breadcrumbEl.appendChild(sep1);

                const driveCrumb = document.createElement("span");
                driveCrumb.className = "ell-crumb";
                driveCrumb.textContent = drive;
                driveCrumb.onclick = () => navigateTo(drive, []);
                breadcrumbEl.appendChild(driveCrumb);

                segments.forEach((seg, idx) => {
                    const sep = document.createElement("span");
                    sep.className = "ell-crumb-sep";
                    sep.textContent = "\u203a";
                    breadcrumbEl.appendChild(sep);

                    const crumb = document.createElement("span");
                    crumb.className = "ell-crumb";
                    crumb.textContent = seg;
                    crumb.onclick = () => navigateTo(drive, segments.slice(0, idx + 1));
                    breadcrumbEl.appendChild(crumb);
                });
            }
        }

        function renderList(dirs, files) {
            if (!fileListEl) return;
            fileListEl.innerHTML = "";

            if (dirs.length === 0 && files.length === 0) {
                const empty = document.createElement("div");
                empty.className = "ell-entry";
                empty.style.color = "var(--input-text, #aaa)";
                empty.style.cursor = "default";
                // At root level (no drive) show helpful text; inside a folder show different text
                empty.textContent = browserState.drive
                    ? "No LoRA files found in this folder"
                    : "No drives detected";
                fileListEl.appendChild(empty);
                return;
            }

            dirs.forEach(name => {
                const el = document.createElement("div");
                el.className = "ell-entry ell-dir";
                el.textContent = "\uD83D\uDCC1 " + name;
                // Issue 4: only onclick for directories; ondblclick removed to prevent double-navigation
                el.onclick = () => navigateTo(browserState.drive, [...browserState.pathSegments, name]);
                fileListEl.appendChild(el);
            });

            files.forEach(name => {
                const el = document.createElement("div");
                el.className = "ell-entry ell-file";
                el.textContent = "\uD83D\uDCC4 " + name;
                el.onclick = () => {
                    // Deselect all, select this
                    fileListEl.querySelectorAll(".ell-entry").forEach(e => e.classList.remove("ell-selected"));
                    el.classList.add("ell-selected");
                    browserState.selectedFile = name;
                    if (selectBtn) selectBtn.disabled = false;
                };
                el.ondblclick = () => {
                    browserState.selectedFile = name;
                    commitSelection();
                };
                fileListEl.appendChild(el);
            });
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
