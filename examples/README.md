# Examples

A ComfyUI custom node that lets you load LoRA files from **any path on any mounted drive** — no server restarts, no manual config edits, no symlinks.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/L4L61XEMBR)

## Features

- **Drive auto-detection** — Automatically detects all mounted drives on Windows, macOS, and Linux at startup
- **Tree-style file browser** — Click Browse to open a modal with a full expandable drive/folder tree; navigate to any location without typing paths
- **Extension filter** — Filter the browser to Safetensors only, all LoRA types, PyTorch files, or all files
- **LoRA metadata popup** — Single-click any `.safetensors` file to open a tabbed info panel showing base model, rank/alpha, training stats, trigger tags, and author notes without loading the file
- **Draggable and resizable modal** — Drag the browser by its header; resize from the bottom-right corner
- **Keyboard navigation** — Press Enter to confirm a selection, Escape to close
- **System RAM caching** — LoRAs are loaded into memory on first use; subsequent runs skip disk I/O entirely
- **LRU eviction** — Configurable cache size cap (per node, per workflow); oldest-used LoRAs are evicted automatically when the limit is reached
- **Cache stats display** — Shows current usage and available headroom, live-updating as LoRAs load
- **Independent strength sliders** — Separate `model_strength` and `clip_strength` controls, matching ComfyUI's native Load LoRA node
- **Clear Cache button** — Flush cached LoRAs directly from the node; shows freed memory in the button label
- **Cross-platform** — Windows (`D:\`), macOS (`/Volumes/MyDrive`), and Linux (`/mnt/nas`) path formats all work

![Example_01--Node.png](<Example_01--Node.png>)