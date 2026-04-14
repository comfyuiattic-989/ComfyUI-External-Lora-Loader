import { app } from "../../scripts/app.js";

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
                    showTempLabel(loraNameWidget, "Path not found", 2000);
                }
            } catch (err) {
                loraNameWidget.options.values = ["none"];
                loraNameWidget.value = "none";
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

        // --- Initial load ---
        scheduleRefresh();
    }
});
