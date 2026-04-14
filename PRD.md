# Product Requirements Document: External LoRA Loader
**Status:** v1.0 - Draft  
**Target Platform:** ComfyUI

## 1. Project Overview
The **External LoRA Loader** is a custom node for ComfyUI designed to solve the limitation of local-only model storage. It provides a dynamic interface to load, cache, and apply LoRAs from any connected drive or network path without requiring global configuration changes.

## 2. Problem Statement
* **Storage Fragmentation:** Users often store massive LoRA libraries on external HDDs or NAS devices that aren't part of the default ComfyUI path.
* **UI Rigidity:** Standard nodes require server restarts or manual YAML editing to recognize new directories.
* **Performance Bottlenecks:** Loading from external or mechanical drives repeatedly causes significant workflow delays.

## 3. Goals & Objectives
* Enable on-the-fly directory navigation through the ComfyUI web interface.
* Implement a System RAM caching layer to eliminate disk I/O latency on subsequent loads.
* Provide a reactive JavaScript-driven UI that updates file lists based on path inputs.

## 4. Functional Requirements

### 4.1 Drive & Path Selection
* **Drive Auto-Detection:** The node must detect all mounted drive letters (Windows) or mount points (Linux/macOS) automatically using the `psutil` library.
* **Manual Path Input:** A text input for sub-folders (e.g., `AI/Models/LoRA/Style`).

### 4.2 Dynamic File Listing
* **Real-time Backend API:** A custom server route to scan the selected directory for `.safetensors` and `.ckpt` files.
* **Reactive Dropdown:** A dropdown menu that updates immediately when the path is changed via a JavaScript/Python bridge.

### 4.3 Memory Management (Caching)
* **RAM Storage:** Loaded tensors must stay in system memory to avoid re-reading from slow disks.
* **Persistence:** The cache should persist throughout the session until the server is restarted or the cache is cleared.

### 4.4 Patching Engine
* **Integration:** Seamless integration with ComfyUI's internal `model_patcher`.
* **Controls:** Adjustable Strength parameters for both Model (U-Net) and CLIP.

## 5. Technical Architecture
* **Backend:** Python 3.x, `psutil` (drive detection), `aiohttp` (custom API route).
* **Frontend:** Vanilla JavaScript (ES6+), ComfyUI `app.js` extension API, LiteGraph.js hooks.
* **Storage Interface:** `comfy.utils.load_torch_file` for optimized tensor loading.

## 6. User Experience (UX) Flow
1.  User adds the **External LoRA Loader** node to the workspace.
2.  User selects a drive (e.g., `D:/`) from the auto-populated dropdown.
3.  User types a folder name; the "LoRA Name" dropdown populates automatically without a page refresh.
4.  User selects a specific LoRA file.
5.  **First execution:** The node reads from the external disk (Initial latency).
6.  **Subsequent executions:** The node pulls from the RAM Cache (Instantaneous).

## 7. Constraints & Risks
* **Memory Overflow:** Users with limited RAM may experience crashes if too many large LoRAs are cached simultaneously.
* **Path Security:** The node allows filesystem access; it is intended for local single-user environments.
* **OS Compatibility:** Must handle difference between Windows backslashes (`\`) and Unix forward-slashes (`/`).