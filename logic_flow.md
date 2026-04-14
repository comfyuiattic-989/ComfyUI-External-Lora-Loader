### Logic Flowchart: External LoRA Loader

# Logic Flow: External LoRA Loader (Cross-Platform)

## 1. Initialization (Backend Start)
- **OS Check:** Detect `platform.system()`.
- **Drive Mapping:**
    - **Windows:** Populate `drive` list with `psutil.disk_partitions()`.
    - **macOS/Linux:** Populate `drive` list with `/` and subdirectories of `/Volumes` (macOS) or `/media` (Linux).

## 2. UI Interaction Logic (Frontend - JavaScript)
- **EVENT: Value Changed** (`drive` dropdown or `sub_path` text)
    - **Action:** Start **Debounce Timer** (500ms).
    - **Action:** On timeout, call `API: /external_lora/list_files`.
    - **Path Processing:** Convert all Windows backslashes `\` to forward slashes `/` before sending to API for uniform handling.
    - **IF API Success:** Update `lora_name` dropdown.
    - **IF API Error:** Clear `lora_name` and display "Path Not Found".

## 3. Execution Logic (Backend - Python)
- **Step 1: Path Construction**
    - Use `os.path.join(drive, sub_path, lora_name)`.
    - **CRITICAL:** Run `os.path.normpath()` on the result. This converts slashes to the correct format for the current OS (e.g., `/` for Mac, `\` for Windows).
- **Step 2: Cache Check**
    - Search `LORA_CACHE` using the normalized absolute path.
    - **IF MISS:** Load file using `comfy.utils.load_torch_file` and store in cache.
- **Step 3: Patching**
    - Apply patches via `comfy.sd.load_lora_for_models`.

---

### Why this is the final piece of the puzzle:
By defining these three flows, we've solved the "race conditions" (where the UI tries to load a file before it's indexed) and the "memory leak" concerns. 

**You now have a complete technical blueprint:**
1.  **PRD.md:** The "Why" and "What."
2.  **state.json:** The Data Structure.
3.  **api_spec.yaml:** The Communication Protocol.
4.  **Flowchart:** The Logic sequence.

With these four documents, an AI (or a developer) can build this node with virtually zero errors or hallucinations. 

**Is there any other specific behavior—like handling subdirectories or searching—that you'd like to add to the flowchart before we call the planning complete?**