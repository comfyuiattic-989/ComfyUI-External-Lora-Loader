# This file contains the ExternalLoraLoader node class.

import os
from .api import DRIVE_LIST
from .cache import LORA_CACHE


class ExternalLoraLoader:
    RETURN_TYPES = ("MODEL", "CLIP")
    FUNCTION = "execute"
    CATEGORY = "loaders"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "drive": (DRIVE_LIST or ["C:/"],),
                "sub_path": ("STRING", {"default": "", "multiline": False}),
                # Keep this as a STRING on the backend so ComfyUI does not
                # validate against a stale static combo list before execution.
                "lora_name": ("STRING", {"default": "none", "multiline": False}),
                "model_strength": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.01}),
                "clip_strength": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.01}),
                "max_cache_mb": ("INT", {"default": 2048, "min": 128, "max": 32768, "step": 128}),
            }
        }

    def execute(self, model, clip, drive, sub_path, lora_name, model_strength, clip_strength, max_cache_mb):
        # 1. If lora_name is "none", return unchanged
        if lora_name == "none":
            return (model, clip)

        # 2. Build normalized path
        full_path = os.path.normpath(os.path.join(drive, sub_path, lora_name))

        if not os.path.isfile(full_path):
            raise FileNotFoundError(
                f"[ExternalLoraLoader] LoRA file not found: {full_path!r}"
            )

        # 3. Update cache size limit
        if LORA_CACHE.max_mb != max_cache_mb:
            LORA_CACHE.set_max_mb(max_cache_mb)

        # 4. Cache lookup
        tensors = LORA_CACHE.get(full_path)

        # 5. Cache miss: load from disk
        if tensors is None:
            import comfy.utils
            tensors = comfy.utils.load_torch_file(full_path, safe_load=True)
            LORA_CACHE.put(full_path, tensors)

        # 6. Apply LoRA patch
        import comfy.sd
        model_patched, clip_patched = comfy.sd.load_lora_for_models(
            model, clip, tensors, model_strength, clip_strength
        )

        return (model_patched, clip_patched)
