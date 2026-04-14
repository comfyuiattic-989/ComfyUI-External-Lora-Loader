# Development Constraints: External LoRA Loader

These constraints are non-negotiable architectural boundaries. All generated code must adhere to these rules to ensure compatibility, security, and performance.

# Development Constraints: External LoRA Loader

## 1. Environment & Library Constraints
- **Standard Libraries:** `psutil`, `os`, `platform`, `pathlib`, and `aiohttp` only.
- **ComfyUI Core:** Must use `comfy.utils.load_torch_file`.

## 2. Cross-Platform Handling (Critical)
- **Normalization:** ALL file paths must be processed through `os.path.normpath()` before any disk operation.
- **Slash Agnosticism:** The frontend must accept both `/` and `\` but the backend must normalize them based on the host OS.
- **Hidden Files:** The file-scanning logic must ignore files starting with `.` (e.g., `.DS_Store` on macOS) to prevent loading errors.
- **Drive Logic:** The backend must provide a fallback for non-Windows systems where "Drives" are actually "Mount Points" (e.g., `/Volumes/`).

## 3. Performance & Memory
- **Global Cache:** `LORA_CACHE` dictionary must be session-persistent.
- **Async API:** All server-client communication must be non-blocking.
- **Debouncing:** 500ms minimum delay on the `sub_path` text field.

## 4. UI/UX Consistency
- **Naming:** Follow `state.json` naming conventions for all widgets.
- **Fault Tolerance:** Return `{"files": []}` if a path is invalid; never throw a 500 error.

## 5. Coding Style
- **Python:** Follow PEP8 naming conventions for variables and functions.
- **JavaScript:** Use ES6 modules (import/export) as per ComfyUI's modern extension architecture.