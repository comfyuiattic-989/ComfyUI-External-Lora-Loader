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
            display: flex; align-items: center; gap: 8px;
            padding: 8px 14px;
            border-top: 1px solid var(--border-color, #4e4e4e);
            flex-shrink: 0;
        }
        .ell-status-text {
            flex: 1; min-width: 0;
            font-size: 12px; color: var(--input-text, #aaa);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ell-select-btn {
            padding: 5px 18px; border-radius: 4px;
            background: var(--comfy-input-bg, #444); color: var(--fg-color, #fff);
            border: 1px solid var(--border-color, #4e4e4e); cursor: pointer;
            flex-shrink: 0;
        }
        .ell-select-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ell-select-btn-active {
            background: #0078d4 !important;
            border-color: #006cbd !important;
            color: #fff !important;
        }
        .ell-ext-filter {
            background: var(--comfy-input-bg, #1a1a1a);
            color: var(--fg-color, #ddd);
            border: 1px solid var(--border-color, #4e4e4e);
            border-radius: 4px;
            font-size: 12px;
            padding: 3px 6px;
            cursor: pointer;
            flex-shrink: 0;
        }
        .ell-row-inaccessible {
            opacity: 0.45;
            cursor: not-allowed;
        }
        .ell-row-inaccessible:hover {
            background: none !important;
        }
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
        .ell-meta-popup {
            position: fixed;
            background: var(--comfy-menu-bg, #353535);
            border-radius: 8px;
            box-shadow: 0 4px 32px rgba(0,0,0,0.6);
            display: flex; flex-direction: column;
            overflow: hidden;
            z-index: 10000;
            font-family: system-ui, sans-serif;
            font-size: 13px;
            color: var(--fg-color, #ddd);
            min-width: 200px;
        }
        .ell-meta-popup-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid var(--border-color, #4e4e4e);
            flex-shrink: 0;
        }
        .ell-meta-popup-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--input-text, #aaa);
            font-weight: bold;
        }
        .ell-meta-popup-close {
            background: none; border: none; color: var(--fg-color, #fff);
            cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px;
        }
        .ell-meta-tabs {
            display: flex;
            border-bottom: 1px solid var(--border-color, #4e4e4e);
            flex-shrink: 0;
        }
        .ell-meta-tab {
            flex: 1;
            background: none; border: none; border-bottom: 2px solid transparent;
            color: var(--input-text, #aaa); cursor: pointer;
            padding: 6px 4px; font-size: 11px;
        }
        .ell-meta-tab:hover { color: var(--fg-color, #ddd); }
        .ell-meta-tab-active {
            color: #fff !important;
            border-bottom-color: #0078d4 !important;
        }
        .ell-meta-body {
            flex: 1; overflow-y: auto; padding: 8px;
            background: var(--comfy-input-bg, #1a1a1a);
        }
        .ell-meta-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 4px 10px;
            align-items: baseline;
        }
        .ell-meta-key {
            color: var(--input-text, #888);
            font-size: 11px;
            text-align: right;
            white-space: nowrap;
        }
        .ell-meta-val {
            color: var(--fg-color, #ddd);
            font-size: 12px;
            word-break: break-word;
        }
        .ell-meta-empty {
            color: var(--input-text, #666);
            font-size: 12px;
            text-align: center;
            padding: 24px 8px;
            font-style: italic;
        }
        .ell-meta-loading {
            color: var(--input-text, #888);
            font-size: 12px;
            text-align: center;
            padding: 24px 8px;
        }
        .ell-meta-tag-list {
            display: flex; flex-wrap: wrap; gap: 4px;
            padding: 2px 0;
        }
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
    document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Module-level state shared across all node instances
// ---------------------------------------------------------------------------

// Cached result of GET /external_lora/loras_folder  (undefined = not fetched yet)
let _lorasFolderCache = undefined;

// Last extension filter the user chose — persists across opens and nodes
let _lastExtFilter = ".safetensors";   // default: Safetensors only

// Metadata popup state (shared across all node instances; only one popup shown at a time)
let metaPopupEl = null;
let _metaActiveTab = "overview";
let _metaFetchSeq  = 0;
let _metaPopupGeo  = null;

async function _fetchLorasFolder() {
    if (_lorasFolderCache) return _lorasFolderCache;  // only cache successes; failures retry next open
    try {
        const resp = await fetch("/external_lora/loras_folder");
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.drive) {
            _lorasFolderCache = { drive: data.drive, sub_path: data.sub_path || "" };
            return _lorasFolderCache;
        }
    } catch {}
    return null;
}

// Convert the filter select value to the API `extensions` param
function _extParam(filter) {
    if (!filter || filter === "")  return null;       // backend uses _SUPPORTED_EXTENSIONS
    if (filter === "*")            return ["*"];      // all files
    return filter.split(",");                         // e.g. ".pt,.pth"
}

// ---------------------------------------------------------------------------
// Metadata popup (module-level; shared across nodes)
// ---------------------------------------------------------------------------

function _escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function _saveMetaPopupGeo() {
    if (!metaPopupEl) return;
    _metaPopupGeo = {
        left:   parseInt(metaPopupEl.style.left,   10),
        top:    parseInt(metaPopupEl.style.top,    10),
        width:  parseInt(metaPopupEl.style.width,  10),
        height: parseInt(metaPopupEl.style.height, 10),
    };
}

function buildMetaPopup() {
    if (metaPopupEl) return;
    metaPopupEl = document.createElement("div");
    metaPopupEl.className = "ell-meta-popup";
    metaPopupEl.style.display = "none";

    const popHeader = document.createElement("div");
    popHeader.className = "ell-meta-popup-header";
    const popTitle = document.createElement("span");
    popTitle.className = "ell-meta-popup-title";
    popTitle.textContent = "LoRA Info";
    const popClose = document.createElement("button");
    popClose.className = "ell-meta-popup-close";
    popClose.textContent = "\u2715";
    popClose.onclick = hideMetaPopup;
    popHeader.appendChild(popTitle);
    popHeader.appendChild(popClose);
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

    const tabBar = document.createElement("div");
    tabBar.className = "ell-meta-tabs";
    for (const [id, label] of [["overview","Overview"],["training","Training"],["tags","Tags"],["about","About"]]) {
        const tab = document.createElement("button");
        tab.className = "ell-meta-tab" + (id === _metaActiveTab ? " ell-meta-tab-active" : "");
        tab.textContent = label;
        tab.dataset.tab = id;
        tab.onclick = () => {
            _metaActiveTab = id;
            metaPopupEl.querySelectorAll(".ell-meta-tab").forEach(t =>
                t.classList.toggle("ell-meta-tab-active", t.dataset.tab === id));
            metaPopupEl.querySelectorAll(".ell-meta-panel").forEach(p =>
                p.style.display = p.dataset.panel === id ? "" : "none");
        };
        tabBar.appendChild(tab);
    }

    const popBody = document.createElement("div");
    popBody.className = "ell-meta-body";
    for (const id of ["overview","training","tags","about"]) {
        const panel = document.createElement("div");
        panel.className = "ell-meta-panel";
        panel.dataset.panel = id;
        panel.style.display = id === _metaActiveTab ? "" : "none";
        popBody.appendChild(panel);
    }

    metaPopupEl.appendChild(popHeader);
    metaPopupEl.appendChild(tabBar);
    metaPopupEl.appendChild(popBody);
    document.body.appendChild(metaPopupEl);
}

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

function _renderMetaPanels(result) {
    if (!metaPopupEl) return;
    const meta   = (result && result.metadata) || {};
    const noMeta = !(result && result.metadata);

    function grid(rows) {
        if (!rows.length) return '<div class="ell-meta-empty">No data</div>';
        return '<div class="ell-meta-grid">' +
            rows.map(([k, v]) =>
                `<span class="ell-meta-key">${_escHtml(k)}</span>` +
                `<span class="ell-meta-val">${v ?? "\u2014"}</span>`
            ).join("") + "</div>";
    }

    const noEmbed = '<div class="ell-meta-empty">No embedded metadata</div>';

    // --- Overview ---
    const ov = [];
    if (result && result.file_size_mb != null) ov.push(["Size", result.file_size_mb + " MB"]);
    if (result && result.modified)             ov.push(["Modified", result.modified.replace("T", " ")]);
    if (meta.ss_base_model_version)            ov.push(["Base model", _escHtml(meta.ss_base_model_version)]);
    const dim   = meta.ss_network_dim;
    const alpha = meta.ss_network_alpha;
    if (dim)   ov.push(["Rank (dim)", _escHtml(dim)]);
    if (alpha) ov.push(["Alpha", _escHtml(alpha)]);
    if (dim && alpha) {
        const d = parseFloat(dim), a = parseFloat(alpha);
        if (d > 0) ov.push(["Eff. scale", (a / d).toFixed(3)]);
    }
    if (meta.ss_network_module)
        ov.push(["Network", _escHtml(meta.ss_network_module.split(".").pop())]);

    // --- Training ---
    const tr = [];
    if (!noMeta) {
        if (meta.ss_steps)            tr.push(["Steps",        _escHtml(meta.ss_steps)]);
        if (meta.ss_epoch)            tr.push(["Epochs",       _escHtml(meta.ss_epoch)]);
        if (meta.ss_num_train_images) tr.push(["Train images", _escHtml(meta.ss_num_train_images)]);
        if (meta.ss_num_reg_images)   tr.push(["Reg images",   _escHtml(meta.ss_num_reg_images)]);
        if (meta.ss_resolution)       tr.push(["Resolution",   _escHtml(meta.ss_resolution)]);
        if (meta.ss_unet_lr)          tr.push(["UNet LR",      _escHtml(meta.ss_unet_lr)]);
        if (meta.ss_text_encoder_lr)  tr.push(["TE LR",        _escHtml(meta.ss_text_encoder_lr)]);
        else if (meta.ss_learning_rate) tr.push(["LR",         _escHtml(meta.ss_learning_rate)]);
    }

    // --- Tags ---
    let tagHtml = noMeta ? noEmbed : "";
    if (!noMeta) {
        let tagFreq = meta.ss_tag_frequency;
        if (typeof tagFreq === "string") {
            try { tagFreq = JSON.parse(tagFreq); } catch { tagFreq = null; }
        }
        if (tagFreq && typeof tagFreq === "object" && !Array.isArray(tagFreq)) {
            const merged = {};
            for (const dir of Object.values(tagFreq)) {
                if (dir && typeof dir === "object") {
                    for (const [tag, count] of Object.entries(dir)) {
                        merged[tag] = (merged[tag] || 0) + Number(count);
                    }
                }
            }
            const sorted = Object.entries(merged).sort((a, b) => b[1] - a[1]).slice(0, 40);
            tagHtml = sorted.length
                ? '<div class="ell-meta-tag-list">' +
                    sorted.map(([tag, cnt]) =>
                        `<span class="ell-meta-tag" title="${cnt} occurrences">${_escHtml(tag)}</span>`
                    ).join("") + "</div>"
                : '<div class="ell-meta-empty">No tags</div>';
        } else {
            tagHtml = '<div class="ell-meta-empty">No tag data</div>';
        }
    }

    // --- About ---
    const ab = [];
    if (!noMeta) {
        const title   = meta["modelspec.title"]       || meta.ss_output_name;
        const author  = meta["modelspec.author"];
        const desc    = meta["modelspec.description"] || meta.ss_training_comment;
        const license = meta["modelspec.license"];
        const tags    = meta["modelspec.tags"];
        if (title)   ab.push(["Title",   _escHtml(title)]);
        if (author)  ab.push(["Author",  _escHtml(author)]);
        if (license) ab.push(["License", _escHtml(license)]);
        if (tags)    ab.push(["Tags",    _escHtml(tags)]);
        if (desc)    ab.push(["Notes",
            `<span style="white-space:pre-wrap;display:block">${_escHtml(desc)}</span>`]);
    }

    const content = {
        overview: grid(ov),
        training: noMeta ? noEmbed : (tr.length ? grid(tr) : '<div class="ell-meta-empty">No training data</div>'),
        tags:     tagHtml,
        about:    noMeta ? noEmbed : (ab.length ? grid(ab) : '<div class="ell-meta-empty">No description</div>'),
    };

    metaPopupEl.querySelectorAll(".ell-meta-panel").forEach(p => {
        p.innerHTML = content[p.dataset.panel] || "";
    });
}

async function showMetaPopup(data, boxEl) {
    buildMetaPopup();
    positionMetaPopup(boxEl);
    metaPopupEl.style.display = "flex";

    // Sync tab active state in case it changed since last open
    metaPopupEl.querySelectorAll(".ell-meta-tab").forEach(t =>
        t.classList.toggle("ell-meta-tab-active", t.dataset.tab === _metaActiveTab));
    metaPopupEl.querySelectorAll(".ell-meta-panel").forEach(p =>
        p.style.display = p.dataset.panel === _metaActiveTab ? "" : "none");

    // Loading state in every panel
    metaPopupEl.querySelectorAll(".ell-meta-panel").forEach(p => {
        p.innerHTML = '<div class="ell-meta-loading">Loading\u2026</div>';
    });

    const seq    = ++_metaFetchSeq;
    const params = new URLSearchParams({
        drive: data.drive,
        path:  data.segments.join("/"),
    });

    let result = null;
    try {
        const resp = await fetch("/external_lora/metadata?" + params);
        if (resp.ok) result = await resp.json();
    } catch {}

    if (seq !== _metaFetchSeq) return; // a newer file was clicked
    if (!metaPopupEl || metaPopupEl.style.display === "none") return;

    _renderMetaPanels(result || {});
}

function hideMetaPopup() {
    if (metaPopupEl) metaPopupEl.style.display = "none";
}

// ---------------------------------------------------------------------------

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

        // nodeCreated fires BEFORE node.configure() writes saved widget values,
        // so loraNameWidget.value is still the default here. onConfigure fires
        // at the END of configure(), after widgets_values are applied — that is
        // the first moment we can see the real saved filename and seed options
        // so ComfyUI's missing-models validator finds the value in the list.
        const _origOnConfigure = node.onConfigure;
        node.onConfigure = function(info) {
            if (_origOnConfigure) _origOnConfigure.call(this, info);
            const v = loraNameWidget.value || "none";
            if (v !== "none" && !loraNameWidget.options.values.includes(v)) {
                loraNameWidget.options.values = ["none", v];
            }
        };

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
            node.setDirtyCanvas(true, true);
            _labelTimers.set(widget, setTimeout(() => {
                widget.label = origLabel;
                node.setDirtyCanvas(true, true);
            }, durationMs));
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
        let modalBoxEl   = null;
        let treeContainerEl = null;
        let statusEl = null;
        let selectBtn = null;
        let _boxPositioned = false;

        // Last folder the user browsed to in THIS node's modal (null = not opened yet)
        let _lastBrowsePath = null;  // { drive: string, segments: string[] }

        // Per-node extension filter — inherits module-level default on first open
        let _extFilter = _lastExtFilter;

        // DOM reference to the extension filter <select> (set once by buildModal)
        let extFilterEl = null;

        // Shared keydown handler for Escape key
        let onKeyDown = null;

        // Tree state (per node instance)
        let treeRootData = null;
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
                const isFile        = data.type === "file";
                const isDrive       = data.type === "drive";
                const isInaccessible = !isFile && data.accessible === false;

                // Client-side extension filter (applied to files only)
                if (isFile && _extFilter && _extFilter !== "*") {
                    const allowed = _extFilter.split(",");
                    const dot = data.name.lastIndexOf(".");
                    const ext = dot >= 0 ? data.name.slice(dot).toLowerCase() : "";
                    if (!allowed.includes(ext)) return;
                }

                const row = document.createElement("div");
                row.className = "ell-row"
                    + (data._selected    ? " ell-row-selected"     : "")
                    + (isInaccessible    ? " ell-row-inaccessible" : "");
                row.style.paddingLeft = (depth * 16 + 4) + "px";
                if (isInaccessible && data.reason) row.title = data.reason;

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

                row.addEventListener("click", (e) => { if (!isInaccessible) onNodeClick(e, data); });
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

        // --- onNodeClick: file select or folder lazy-load + toggle ---
        async function onNodeClick(event, data) {
            if (data.type === "file") {
                clearFileSelection(treeRootData);
                data._selected = true;
                browserState.drive = data.drive;
                browserState.pathSegments = data.segments.slice(0, -1);
                browserState.selectedFile = data.name;
                if (selectBtn) {
                    selectBtn.disabled = false;
                    selectBtn.textContent = "Select";
                    selectBtn.classList.add("ell-select-btn-active");
                }
                if (statusEl) statusEl.textContent = data.name;
                renderTree();
                showMetaPopup(data, modalBoxEl);
                return;
            }

            // Folder / drive — lazy load on first expand, then toggle
            hideMetaPopup();
            if (!data._loaded) {
                if (statusEl) statusEl.textContent = "Loading\u2026";
                const path = data.segments.join("/");
                try {
                    const resp = await fetch("/external_lora/browse", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ drive: data.drive, path, extensions: _extParam(_extFilter) }),
                    });
                    if (!resp.ok) throw new Error(resp.statusText);
                    const json = await resp.json();
                    const dirs  = json.dirs  || [];
                    const files = json.files || [];
                    data.children = [
                        ...dirs.map(d => ({
                            name: d.name, type: "dir", drive: data.drive,
                            segments: [...data.segments, d.name],
                            _loaded: false, children: null, _children: null,
                            _id: _nextId(), _selected: false,
                            accessible: d.accessible, reason: d.reason,
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
                    // Remember this folder as the last browsed location
                    _lastBrowsePath = { drive: data.drive, segments: [...data.segments] };
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

        // --- autoExpandToPath: traverse tree data to saved path ---
        async function autoExpandToPath(drive, segments, savedFile) {
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
                            body: JSON.stringify({ drive: cur.drive, path, extensions: _extParam(_extFilter) }),
                        });
                        if (!resp.ok) throw new Error(resp.statusText);
                        const json = await resp.json();
                        cur._loaded = true;
                        cur.children = [
                            ...(json.dirs || []).map(d => ({
                                name: d.name, type: "dir", drive: cur.drive,
                                segments: [...cur.segments, d.name],
                                _loaded: false, children: null, _children: null,
                                _id: _nextId(), _selected: false,
                                accessible: d.accessible, reason: d.reason,
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
            modalBoxEl = box;

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

            // Body — scrollable tree container
            const body = document.createElement("div");
            body.className = "ell-modal-body";

            treeContainerEl = document.createElement("div");
            treeContainerEl.className = "ell-tree-container";

            body.appendChild(treeContainerEl);

            // Footer
            const footer = document.createElement("div");
            footer.className = "ell-modal-footer";

            // Extension filter select
            extFilterEl = document.createElement("select");
            extFilterEl.className = "ell-ext-filter";
            [
                { value: "",          label: "All LoRA types" },
                { value: ".safetensors", label: "Safetensors" },
                { value: ".ckpt",     label: "Checkpoint" },
                { value: ".pt,.pth",  label: "PyTorch" },
                { value: "*",         label: "All files" },
            ].forEach(({ value, label }) => {
                const opt = document.createElement("option");
                opt.value = value;
                opt.textContent = label;
                extFilterEl.appendChild(opt);
            });

            statusEl = document.createElement("span");
            statusEl.className = "ell-status-text";

            selectBtn = document.createElement("button");
            selectBtn.className = "ell-select-btn";
            selectBtn.textContent = "Select";
            selectBtn.disabled = true;
            selectBtn.onclick = commitSelection;

            footer.appendChild(extFilterEl);
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
            onKeyDown = (e) => {
                if (e.key === "Escape") closeModal();
                else if (e.key === "Enter" && browserState.selectedFile) commitSelection();
            };
            document.addEventListener("keydown", onKeyDown);

            browserState.selectedFile = null;
            if (selectBtn) {
                selectBtn.disabled = true;
                selectBtn.textContent = "Select";
                selectBtn.classList.remove("ell-select-btn-active");
            }
            if (statusEl) statusEl.textContent = "Loading drives\u2026";

            // Sync filter select to current per-node value
            if (extFilterEl) {
                extFilterEl.value = _extFilter;
                // Wire change handler (safe to re-attach; handler is idempotent via replace)
                extFilterEl.onchange = async () => {
                    _extFilter = extFilterEl.value;
                    _lastExtFilter = _extFilter;
                    // Re-init the tree so new folders load with the updated filter
                    treeRootData = null;
                    await _initTree();
                };
            }

            await _initTree();
        }

        // Fetch drives, rebuild treeRootData, then navigate to the best-known path.
        // Called on first open and on filter change.
        async function _initTree() {
            if (statusEl) statusEl.textContent = "Loading drives\u2026";
            try {
                const resp = await fetch("/external_lora/browse", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                });
                if (!resp.ok) throw new Error(resp.statusText);
                const data = await resp.json();
                const drives = data.dirs || [];

                treeRootData = {
                    name: "root", type: "root", drive: "", segments: [],
                    _loaded: true, _id: _nextId(), _selected: false,
                    children: drives.map(d => ({
                        name: d.name, type: "drive", drive: d.name, segments: [],
                        _loaded: false, children: null, _children: null,
                        _id: _nextId(), _selected: false,
                        accessible: d.accessible, reason: d.reason,
                    }))
                };

                if (statusEl) statusEl.textContent = "";
                renderTree();

                // Navigation priority:
                // 1. Last folder the user manually browsed to (within this session)
                // 2. The folder of the currently-selected LoRA (from widget values)
                // 3. ComfyUI's loras folder (first open, nothing saved)
                const savedDrive = driveWidget.value || "";
                const savedPath  = subPathWidget.value || "";
                const savedFile  = loraNameWidget.value !== "none" ? loraNameWidget.value : null;

                if (_lastBrowsePath && _lastBrowsePath.drive) {
                    await autoExpandToPath(_lastBrowsePath.drive, _lastBrowsePath.segments, savedFile);
                } else if (savedDrive && (savedFile || savedPath)) {
                    // Navigate to the saved location even when no file is selected yet
                    const segs = savedPath ? savedPath.split(/[/\\]/).filter(Boolean) : [];
                    await autoExpandToPath(savedDrive, segs, savedFile);
                } else {
                    const lf = await _fetchLorasFolder();
                    if (lf && lf.drive) {
                        const segs = lf.sub_path ? lf.sub_path.split("/").filter(Boolean) : [];
                        await autoExpandToPath(lf.drive, segs, null);
                    }
                }
            } catch {
                if (statusEl) statusEl.textContent = "Failed to load drives";
            }
        }

        function closeModal() {
            if (modalOverlay) modalOverlay.style.display = "none";
            hideMetaPopup();
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

            // Remember this location for the next modal open
            _lastBrowsePath = { drive, segments: [...browserState.pathSegments] };

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
                refreshCacheStats();   // update stats line after clearing
            } catch (err) {
                console.error("[ExternalLoraLoader] Clear cache failed:", err);
                showTempLabel(clearCacheBtn, "Cache clear failed", 2000);
            }
        });

        // --- Cache stats display (sits below Clear Cache button) ---
        const cacheStatsWidget = node.addWidget("text", "cache_stats", "\u2014", () => {});
        setTimeout(() => {
            if (cacheStatsWidget.inputEl) {
                cacheStatsWidget.inputEl.readOnly              = true;
                cacheStatsWidget.inputEl.style.color           = "#888";
                cacheStatsWidget.inputEl.style.fontSize        = "11px";
                cacheStatsWidget.inputEl.style.textAlign       = "center";
                cacheStatsWidget.inputEl.style.cursor          = "default";
                cacheStatsWidget.inputEl.style.userSelect      = "none";
                cacheStatsWidget.inputEl.style.pointerEvents   = "none";
            }
        }, 0);

        const maxCacheMbWidget = node.widgets.find(w => w.name === "max_cache_mb");

        async function refreshCacheStats() {
            try {
                const resp = await fetch("/external_lora/cache_stats");
                if (!resp.ok) return;
                const d = await resp.json();
                const maxMb   = maxCacheMbWidget ? maxCacheMbWidget.value : d.max_mb;
                const availMb = maxMb - d.used_mb;
                const fmtUsed = mb => mb >= 1024
                    ? `${(mb / 1024).toFixed(1)} GB`
                    : `${Number(mb).toFixed(0)} MB`;
                cacheStatsWidget.value =
                    `${fmtUsed(d.used_mb)} used \u00b7 ${Number(availMb).toFixed(0)} MB avail`;
                node.setDirtyCanvas(true, true);
            } catch {}
        }

        if (maxCacheMbWidget) {
            const _origMaxCacheCallback = maxCacheMbWidget.callback;
            maxCacheMbWidget.callback = (...args) => {
                if (_origMaxCacheCallback) _origMaxCacheCallback(...args);
                refreshCacheStats();
            };
        }

        refreshCacheStats();

        // Poll cache stats every 10 s so the display stays current as LoRAs are loaded
        const _statsInterval = setInterval(refreshCacheStats, 10_000);
        const _origOnRemoved = node.onRemoved;
        node.onRemoved = function() {
            clearInterval(_statsInterval);
            if (_origOnRemoved) _origOnRemoved.call(this);
        };

        // --- Widget order splice ---
        // Final canvas order: drive(hidden), sub_path(hidden), selected_path, Browse…, lora_name, …, Clear Cache, cache_stats
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
