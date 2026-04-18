"""
api.py — aiohttp route handlers for the External LoRA Loader custom node.

Registers seven routes on ComfyUI's aiohttp server:
  POST /external_lora/list_files  — list .safetensors/.ckpt files in a directory
  POST /external_lora/clear_cache — flush the in-memory LoRA tensor cache
  GET  /external_lora/cache_stats — return current and max cache usage in MB
  GET  /external_lora/loras_folder — return ComfyUI's configured loras folder
  GET  /external_lora/drives      — return detected drive/mount-point list
  POST /external_lora/browse      — browse directories and files interactively
  GET  /external_lora/metadata    — return file stats and embedded safetensors metadata
"""

import os
import glob
import json as _json
import platform
import struct
from datetime import datetime

import psutil
from aiohttp import web

from .cache import LORA_CACHE


# ---------------------------------------------------------------------------
# Drive detection (runs at import time)
# ---------------------------------------------------------------------------

def _detect_drives() -> list:
    system = platform.system()
    if system == "Windows":
        try:
            return [p.mountpoint for p in psutil.disk_partitions()]
        except Exception:
            return ["C:/"]
    elif system == "Darwin":
        return ["/"] + sorted(p for p in glob.glob("/Volumes/*") if os.path.isdir(p))
    else:  # Linux and others
        return ["/"] + sorted(p for p in glob.glob("/media/*") if os.path.isdir(p)) + sorted(p for p in glob.glob("/mnt/*") if os.path.isdir(p))


DRIVE_LIST: list = _detect_drives()


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

def _probe_dir(path: str) -> tuple:
    """Return (accessible: bool, reason: str | None) by attempting to list the directory."""
    try:
        os.listdir(path)
        return True, None
    except PermissionError:
        return False, "Access denied"
    except OSError as e:
        return False, e.strerror if e.strerror else "Unavailable"


def _is_within_drive(full_path: str, drive_list: list) -> bool:
    """Return True if full_path is at or below one of the known drive roots."""
    fp = os.path.normpath(full_path)
    for d in drive_list:
        root = os.path.normpath(d)
        root_prefix = root if root.endswith(os.sep) else root + os.sep
        if fp == root or fp.startswith(root_prefix):
            return True
    return False


_SUPPORTED_EXTENSIONS = {".safetensors", ".ckpt", ".pt", ".pth", ".bin"}


async def _list_files_handler(request: web.Request) -> web.Response:
    """POST /external_lora/list_files

    Request JSON: {"drive": "D:/", "path": "AI/Models/LoRA"}
    Response JSON: {"files": ["none", ...], "error": null | "bad_request" | "forbidden" | "not_found"}
    """
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"files": [], "error": "bad_request"}, status=400)

    drive = body.get("drive", "")
    path = body.get("path", "")

    full_path = os.path.normpath(os.path.join(drive, path))

    if not _is_within_drive(full_path, DRIVE_LIST):
        return web.json_response({"files": [], "error": "forbidden"}, status=403)

    if not os.path.isdir(full_path):
        return web.json_response({"files": [], "error": "not_found"})

    entries = []
    try:
        for name in os.listdir(full_path):
            # Skip Unix dot-prefixed hidden files
            if name.startswith("."):
                continue
            ext = os.path.splitext(name)[1].lower()
            if ext in _SUPPORTED_EXTENSIONS:
                entries.append(name)
    except OSError:
        return web.json_response({"files": [], "error": "not_found"})

    entries.sort()
    entries.insert(0, "none")

    return web.json_response({"files": entries, "error": None})


async def _clear_cache_handler(request: web.Request) -> web.Response:
    """POST /external_lora/clear_cache

    Response JSON: {"status": "cleared", "freed_mb": <float>}
    """
    freed_mb = LORA_CACHE.clear()
    return web.json_response({"status": "cleared", "freed_mb": round(freed_mb, 2)})


async def _cache_stats_handler(request: web.Request) -> web.Response:
    """GET /external_lora/cache_stats

    Response JSON: {"used_mb": float, "max_mb": float}
    """
    return web.json_response({
        "used_mb": round(LORA_CACHE.current_mb(), 2),
        "max_mb":  LORA_CACHE.max_mb,
    })


async def _loras_folder_handler(request: web.Request) -> web.Response:
    """GET /external_lora/loras_folder

    Response JSON: {"drive": "C:\\", "sub_path": "path/to/loras"}
    Returns empty strings if the ComfyUI loras path cannot be determined.
    """
    try:
        import folder_paths
        dirs = folder_paths.get_folder_paths("loras")
        if dirs:
            full = os.path.normpath(dirs[0])
            drive, tail = os.path.splitdrive(full)
            if drive:  # Windows — e.g. "C:"
                drive = drive + os.sep
                sub   = tail.lstrip(os.sep).replace(os.sep, "/")
            else:       # Unix — no drive component
                drive = "/"
                sub   = tail.lstrip("/")
            return web.json_response({"drive": drive, "sub_path": sub})
    except Exception:
        pass
    return web.json_response({"drive": "", "sub_path": ""})


async def _drives_handler(request: web.Request) -> web.Response:
    """GET /external_lora/drives

    Response JSON: {"drives": [...]}
    """
    return web.json_response({"drives": DRIVE_LIST})


async def _browse_handler(request: web.Request) -> web.Response:
    """POST /external_lora/browse

    Request JSON: {"drive": "D:/", "path": "AI/Models"}
    Response JSON: {"dirs": [...], "files": [...], "error": null | "not_found" | "forbidden" | "bad_request"}

    Special sentinel: if drive is empty or missing, returns the drive list as dirs.
    """
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"dirs": [], "files": [], "error": "bad_request"}, status=400)

    drive = body.get("drive", "")
    path  = body.get("path", "")

    # Resolve extension filter for this request
    extensions_raw = body.get("extensions", None)
    if extensions_raw == ["*"]:
        ext_filter = None  # accept every non-hidden file
    elif extensions_raw:
        ext_filter = {e.lower() for e in extensions_raw if e.startswith(".")}
    else:
        ext_filter = _SUPPORTED_EXTENSIONS

    # Root sentinel: no drive → return probed drive list
    if not drive:
        entries = []
        for d in DRIVE_LIST:
            accessible, reason = _probe_dir(d)
            entries.append({"name": d, "accessible": accessible, "reason": reason})
        return web.json_response({"dirs": entries, "files": [], "error": None})

    full_path = os.path.normpath(os.path.join(drive, path))

    # Security: must be within a known drive
    if not _is_within_drive(full_path, DRIVE_LIST):
        return web.json_response({"dirs": [], "files": [], "error": "forbidden"}, status=403)

    if not os.path.isdir(full_path):
        return web.json_response({"dirs": [], "files": [], "error": "not_found"})

    dirs, files = [], []
    try:
        for name in os.listdir(full_path):
            if name.startswith("."):
                continue
            entry = os.path.join(full_path, name)
            if os.path.isdir(entry):
                accessible, reason = _probe_dir(entry)
                dirs.append({"name": name, "accessible": accessible, "reason": reason})
            elif ext_filter is None or os.path.splitext(name)[1].lower() in ext_filter:
                files.append(name)
    except OSError:
        return web.json_response({"dirs": [], "files": [], "error": "not_found"})

    dirs.sort(key=lambda d: d["name"])
    files.sort()
    return web.json_response({"dirs": dirs, "files": files, "error": None})


async def _metadata_handler(request: web.Request) -> web.Response:
    """GET /external_lora/metadata?drive=<drive>&path=<relative_path>

    Returns file system stats and, for .safetensors files, the embedded
    __metadata__ dict parsed from the safetensors header.

    Response JSON:
      { "file_size_mb": float, "modified": "YYYY-MM-DDTHH:MM:SS",
        "metadata": dict | null, "error": str | null }
    """
    drive = request.rel_url.query.get("drive", "")
    path  = request.rel_url.query.get("path", "")

    if not drive and not path:
        return web.json_response({"file_size_mb": None, "modified": None,
                                  "metadata": None, "error": "missing path"})

    full_path = os.path.normpath(os.path.join(drive, path))

    if not _is_within_drive(full_path, DRIVE_LIST):
        return web.json_response({"file_size_mb": None, "modified": None,
                                  "metadata": None, "error": "forbidden"})

    if not os.path.isfile(full_path):
        return web.json_response({"file_size_mb": None, "modified": None,
                                  "metadata": None, "error": "not_found"})

    stat = os.stat(full_path)
    size_mb  = round(stat.st_size / (1024 * 1024), 2)
    modified = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%dT%H:%M:%S")

    metadata = None
    if full_path.lower().endswith(".safetensors"):
        try:
            with open(full_path, "rb") as f:
                raw = f.read(8)
                if len(raw) == 8:
                    header_len = struct.unpack_from("<Q", raw)[0]
                    # Sanity-check: reject absurdly large headers (>64 MB)
                    if header_len <= 64 * 1024 * 1024:
                        header = _json.loads(f.read(header_len))
                        metadata = header.get("__metadata__", {})
        except Exception:
            pass

    return web.json_response({
        "file_size_mb": size_mb,
        "modified":     modified,
        "metadata":     metadata,
        "error":        None,
    })


# ---------------------------------------------------------------------------
# Route registration
# ---------------------------------------------------------------------------

def register_routes(routes) -> None:
    """Wire handlers onto ComfyUI's aiohttp router.

    Call as: register_routes(PromptServer.instance.routes)
    """
    routes.post("/external_lora/list_files")(_list_files_handler)
    routes.post("/external_lora/clear_cache")(_clear_cache_handler)
    routes.get("/external_lora/cache_stats")(_cache_stats_handler)
    routes.get("/external_lora/loras_folder")(_loras_folder_handler)
    routes.get("/external_lora/drives")(_drives_handler)
    routes.post("/external_lora/browse")(_browse_handler)
    routes.get("/external_lora/metadata")(_metadata_handler)
