# ComfyUI External LoRA Loader

A ComfyUI custom node that lets you load LoRA files from **any path on any mounted drive** — no server restarts, no manual config edits, no symlinks.

---

## The Problem

ComfyUI's built-in Load LoRA node only reads from the `models/lora/` folder inside your ComfyUI installation. If your LoRA library lives on an external hard drive, a NAS, or a second internal drive, your only options are to copy files, create symlinks, or edit config files and restart the server every time you switch locations.

External LoRA Loader solves this by letting you browse to any path directly from the node UI.

---

## Features

- **Drive auto-detection** — Automatically detects all mounted drives on Windows, macOS, and Linux at startup
- **Dynamic file browser** — Type a subdirectory path and the LoRA dropdown updates automatically (500 ms debounce, no button to press)
- **System RAM caching** — LoRAs are loaded into memory on first use; subsequent runs skip disk I/O entirely
- **LRU eviction** — Configurable cache size cap (per node, per workflow); oldest-used LoRAs are evicted automatically when the limit is reached
- **Independent strength sliders** — Separate `model_strength` and `clip_strength` controls, matching ComfyUI's native Load LoRA node
- **Clear Cache button** — Flush cached LoRAs directly from the node; shows freed memory in the button label
- **Cross-platform** — Windows (`D:\`), macOS (`/Volumes/MyDrive`), and Linux (`/mnt/nas`) path formats all work

---

## Requirements

- ComfyUI (any recent version)
- Python 3.8+
- `psutil` (auto-installed by ComfyUI Manager; or `pip install psutil`)

---

## Installation

### Via ComfyUI Manager (recommended)

1. Open ComfyUI Manager → **Install Custom Nodes**
2. Search for **External LoRA Loader**
3. Click Install and restart ComfyUI

### Manual

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/comfyuiattic-989/ComfyUI-External-Lora-Loader
pip install -r ComfyUI-External-Lora-Loader/requirements.txt
```

Restart ComfyUI. The node will appear under **Add Node → loaders → External LoRA Loader**.

---

## Usage

### 1. Add the node

Right-click the canvas → **Add Node → loaders → External LoRA Loader**

Connect it between your checkpoint loader and sampler, the same way you would use the built-in Load LoRA node:

```
Load Checkpoint ──► External LoRA Loader ──► KSampler
                         │
                    CLIP output ──► CLIP Text Encode
```

### 2. Select your drive

The **Drive** dropdown is pre-populated with all mounted drives detected at startup:
- Windows: `C:\`, `D:\`, `E:\`, etc.
- macOS: `/`, `/Volumes/MyDrive`, etc.
- Linux: `/`, `/mnt/nas`, `/media/usb`, etc.

### 3. Enter a subdirectory path

Type the folder path (relative to the drive root) into **Sub Path**. Examples:
- `AI/Models/LoRA/Styles`
- `Users/Bob/loras`
- `LoRA Collection/Characters`

Both forward slashes and backslashes are accepted.

After 500 ms the **LoRA Name** dropdown updates with all `.safetensors` and `.ckpt` files found in that directory.

### 4. Select a LoRA and set strength

Pick a file from the **LoRA Name** dropdown. Adjust:
- **Model Strength** — how strongly the LoRA affects the U-Net (diffusion model)
- **Clip Strength** — how strongly the LoRA affects text conditioning

Both range from −10.0 to 10.0 (default 1.0, step 0.01). Set `lora_name` to `none` to pass the model through unchanged.

### 5. Cache management

The **Max Cache MB** widget controls how much system RAM this node may use for caching. Default is 2048 MB (2 GB). When the limit is reached, the least-recently-used LoRA is evicted.

Click **Clear Cache** at any time to free all cached LoRAs. The button briefly shows how much memory was freed (e.g., `Freed 1.4 GB`).

---

## Node Reference

| Input | Type | Default | Description |
|---|---|---|---|
| `model` | MODEL | — | Incoming diffusion model |
| `clip` | CLIP | — | Incoming CLIP model |
| `drive` | Combo | (detected) | Drive or mount point root |
| `sub_path` | String | `""` | Subdirectory path within the drive |
| `lora_name` | Combo | `none` | LoRA file to load; `none` passes through unchanged |
| `model_strength` | Float | `1.0` | U-Net patch strength (−10 → 10) |
| `clip_strength` | Float | `1.0` | CLIP patch strength (−10 → 10) |
| `max_cache_mb` | Int | `2048` | Maximum RAM to use for caching (128–32768 MB) |

| Output | Type | Description |
|---|---|---|
| `model` | MODEL | Patched diffusion model |
| `clip` | CLIP | Patched CLIP model |

---

## How Caching Works

The first time you queue a workflow with a given LoRA path, the file is read from disk and stored in system RAM. Every subsequent run with the same path skips disk I/O entirely — the tensors are returned directly from memory.

The cache persists for the entire ComfyUI session. LoRAs stay cached across multiple queued prompts and workflow changes until you click **Clear Cache** or restart ComfyUI.

**LRU eviction:** When the total size of cached LoRAs would exceed `max_cache_mb`, the least-recently-used entry is removed to make room for the new one. If a single LoRA is larger than the cache limit, it loads and runs normally but is not cached (a warning is printed to the ComfyUI console).

---

## Platform Notes

| OS | Drive format | Detection method |
|---|---|---|
| Windows | `C:\`, `D:\` | `psutil.disk_partitions()` |
| macOS | `/`, `/Volumes/Name` | Scans `/Volumes/` |
| Linux | `/`, `/mnt/name`, `/media/name` | Scans `/mnt/` and `/media/` |

Drive detection runs once at ComfyUI startup. Drives mounted after startup will not appear in the dropdown until ComfyUI is restarted.

---

## Troubleshooting

**LoRA Name dropdown stays empty / shows "Path not found"**
- Check that the drive and sub_path combination points to a real directory
- Make sure the directory contains `.safetensors` or `.ckpt` files
- Both forward slashes and backslashes work, but avoid trailing slashes

**Node doesn't appear in ComfyUI**
- Confirm `psutil` is installed: `pip install psutil`
- Check the ComfyUI startup console for import errors

**LoRA loads but has no effect**
- Try increasing `model_strength` and `clip_strength`
- Verify the LoRA was trained for the checkpoint you are using

---

## License

MIT — see [LICENSE](LICENSE)
