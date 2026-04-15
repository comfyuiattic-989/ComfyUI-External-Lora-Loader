"""
api.py — aiohttp route handlers for the External LoRA Loader custom node.

Registers four routes on ComfyUI's aiohttp server:
  POST /external_lora/list_files  — list .safetensors/.ckpt files in a directory
  POST /external_lora/clear_cache — flush the in-memory LoRA tensor cache
  GET  /external_lora/drives      — return detected drive/mount-point list
  POST /external_lora/browse      — browse directories and files interactively
"""

import os
import glob
import platform

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

def _is_within_drive(full_path: str, drive_list: list) -> bool:
    """Return True if full_path is at or below one of the known drive roots."""
    fp = os.path.normpath(full_path)
    for d in drive_list:
        root = os.path.normpath(d)
        root_prefix = root if root.endswith(os.sep) else root + os.sep
        if fp == root or fp.startswith(root_prefix):
            return True
    return False


_SUPPORTED_EXTENSIONS = {".safetensors", ".ckpt"}


async def _list_files_handler(request: web.Request) -> web.Response:
    """POST /external_lora/list_files

    Request JSON: {"drive": "D:/", "path": "AI/Models/LoRA"}
    Response JSON: {"files": ["none", ...], "error": null | "not_found"}
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

    # Root sentinel: no drive → return drive list
    if not drive:
        return web.json_response({"dirs": DRIVE_LIST, "files": [], "error": None})

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
                dirs.append(name)
            elif os.path.splitext(name)[1].lower() in _SUPPORTED_EXTENSIONS:
                files.append(name)
    except OSError:
        return web.json_response({"dirs": [], "files": [], "error": "not_found"})

    dirs.sort()
    files.sort()
    return web.json_response({"dirs": dirs, "files": files, "error": None})


# ---------------------------------------------------------------------------
# Route registration
# ---------------------------------------------------------------------------

def register_routes(routes) -> None:
    """Wire handlers onto ComfyUI's aiohttp router.

    Call as: register_routes(PromptServer.instance.routes)
    """
    routes.post("/external_lora/list_files")(_list_files_handler)
    routes.post("/external_lora/clear_cache")(_clear_cache_handler)
    routes.get("/external_lora/drives")(_drives_handler)
    routes.post("/external_lora/browse")(_browse_handler)
