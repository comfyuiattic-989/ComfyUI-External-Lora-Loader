"""
cache.py — Thread-safe LRU cache for loaded LoRA tensor dicts.

Uses a single module-level LORA_CACHE singleton. Thread safety is provided
by a threading.Lock on all mutating operations. Cache size is bounded by
max_mb (set at construction or via set_max_mb); LRU entries are evicted
when the limit is exceeded.
"""

import logging
import threading
from collections import OrderedDict

_log = logging.getLogger(__name__)


class LoraCache:
    def __init__(self, max_mb: float = 2048):
        self._cache: OrderedDict = OrderedDict()  # path -> tensor dict, LRU order (oldest first)
        self._sizes: dict = {}                    # path -> bytes
        self._current_bytes: int = 0
        self._lock = threading.Lock()
        self.max_mb = max_mb

    def set_max_mb(self, max_mb: float) -> None:
        """Update the cache size limit (thread-safe)."""
        with self._lock:
            self.max_mb = max_mb

    def get(self, path: str):
        """Return cached tensor dict for path, or None on miss. Moves hit to end (MRU)."""
        with self._lock:
            if path not in self._cache:
                return None
            # Move to end to mark as most-recently used
            self._cache.move_to_end(path)
            return self._cache[path]

    def put(self, path: str, tensors: dict) -> None:
        """Store tensors in cache, evicting LRU entries as needed to stay within max_mb."""
        if not tensors:
            return

        with self._lock:
            incoming_bytes = sum(
                t.nelement() * t.element_size()
                for t in tensors.values()
                if hasattr(t, "nelement")
            )

            if incoming_bytes == 0:
                return

            max_bytes = int(self.max_mb * 1024 * 1024)

            if incoming_bytes > max_bytes:
                _log.warning(
                    "[LoraCache] WARNING: LoRA at '%s' is %.1f MB, which exceeds the cache limit of "
                    "%.1f MB. It will not be cached.",
                    path,
                    incoming_bytes / (1024 * 1024),
                    self.max_mb,
                )
                return

            # If already cached, remove the old entry first so we can re-insert at end
            if path in self._cache:
                self._current_bytes -= self._sizes[path]
                del self._cache[path]
                del self._sizes[path]

            # Evict oldest entries until the new item fits
            while self._current_bytes + incoming_bytes > max_bytes and self._cache:
                evicted_path, _ = self._cache.popitem(last=False)  # pop from front (LRU)
                self._current_bytes -= self._sizes.pop(evicted_path)

            # Store new entry at end (MRU position)
            self._cache[path] = tensors
            self._sizes[path] = incoming_bytes
            self._current_bytes += incoming_bytes

    def clear(self) -> float:
        """Flush all cached entries. Returns the amount of memory freed in MB."""
        with self._lock:
            freed_bytes = self._current_bytes
            self._cache.clear()
            self._sizes.clear()
            self._current_bytes = 0
            freed_mb = freed_bytes / (1024 * 1024)
        return freed_mb

    def current_mb(self) -> float:
        """Return current cache size in MB."""
        with self._lock:
            return self._current_bytes / (1024 * 1024)


LORA_CACHE = LoraCache()
